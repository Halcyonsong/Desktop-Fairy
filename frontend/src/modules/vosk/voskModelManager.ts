import { useLoggerStore } from '@/stores/loggerStore';

// ===== 常量 =====

// 模型 zip 文件的同源 URL，由 Vite 插件提供
// Worker fetch 同源 URL 最稳定（blob: URL 会卡住，远程 URL 慢）
// vosk-browser 的 createModel 直接支持 zip 格式
const MODEL_URL = '/vosk-model.zip';
// 上传 zip 到 Node 端保存到磁盘
const MODEL_UPLOAD_URL = '/vosk-model-zip';
// 模型下载源
// ModelScope（阿里云魔搭社区）镜像：国内访问快、支持 CORS
// 原始源 alphacephei.com 不支持 CORS，浏览器无法直接 fetch
const MODEL_MIRROR_URLS: string[] = [
  'https://www.modelscope.cn/models/Bovin12/vosk-model-small-cn-0.22/resolve/master/vosk-model-small-cn-0.22.zip',
];
// 模型 zip 大约 42MB，小于此值视为无效缓存
const MODEL_MIN_SIZE = 20 * 1024 * 1024;

// ===== 类型 =====

export interface DownloadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface ModelLoadResult {
  modelUrl: string;
  fromCache: boolean;
}

// ===== 日志 =====

function logInfo(msg: string, details?: unknown) {
  const logger = useLoggerStore();
  logger.info('voskModelManager', msg, details);
  console.log(`[voskModelManager] ${msg}`, details ?? '');
}

function logWarn(msg: string, err?: unknown) {
  const logger = useLoggerStore();
  logger.warn('voskModelManager', msg, err);
  console.warn(`[voskModelManager] ${msg}`, err ?? '');
}

// ===== 下载锁 =====

let ensureModelPromise: Promise<ModelLoadResult> | null = null;

// ===== 一次性清理旧的 IndexedDB 缓存 =====
let oldCacheCleaned = false;
async function cleanupOldIndexedDBCache() {
  if (oldCacheCleaned) return;
  oldCacheCleaned = true;
  try {
    const req = indexedDB.deleteDatabase('vosk-models');
    req.onsuccess = () => logInfo('已清理旧的 IndexedDB 模型缓存');
    req.onerror = () => logWarn('清理旧 IndexedDB 缓存失败');
    req.onblocked = () => logWarn('清理旧 IndexedDB 缓存被阻塞');
  } catch {
    // ignore
  }
}
cleanupOldIndexedDBCache();

// ===== 核心 API =====

/**
 * 检查本地是否已有模型文件（HEAD 请求 Vite 中间件）
 */
async function checkLocalModel(): Promise<{ exists: boolean; size: number }> {
  try {
    const res = await fetch(MODEL_URL, { method: 'HEAD' });
    if (res.ok) {
      const len = Number(res.headers.get('Content-Length') || '0');
      return { exists: len >= MODEL_MIN_SIZE, size: len };
    }
    return { exists: false, size: 0 };
  } catch {
    return { exists: false, size: 0 };
  }
}

/**
 * 下载 zip 并上传到 Node 端保存到磁盘
 */
async function downloadAndSaveModel(
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  let lastError: unknown = null;

  for (const url of MODEL_MIRROR_URLS) {
    try {
      logInfo(`尝试下载源: ${url}`);
      const zipBlob = await downloadWithProgress(url, onProgress);
      logInfo(`下载完成，开始上传到本地存储`);

      const saveRes = await fetch(MODEL_UPLOAD_URL, {
        method: 'POST',
        body: zipBlob,
        headers: { 'Content-Type': 'application/zip' },
      });
      if (!saveRes.ok) {
        const text = await saveRes.text();
        throw new Error(`保存失败: ${saveRes.status} ${text}`);
      }
      const result = await saveRes.json();
      logInfo(`模型已保存到本地，大小: ${result.size} 字节`);
      return;
    } catch (err) {
      logWarn(`下载源失败 ${url}`, err);
      lastError = err;
    }
  }
  throw new Error(`所有下载源均失败: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/**
 * 带进度下载
 */
async function downloadWithProgress(
  url: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<Blob> {
  logInfo(`开始下载: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const total = Number(response.headers.get('Content-Length') || '0');
  logInfo(`响应大小: ${(total / 1024 / 1024).toFixed(2)} MB`);

  if (!response.body || !total) {
    const blob = await response.blob();
    logInfo(`下载完成（无法获取进度），共 ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastLoggedPercent = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      const percent = Math.round((loaded / total) * 100);
      // 每 5% 打一次日志，避免日志爆炸
      const logStep = Math.floor(percent / 5) * 5;
      if (logStep > lastLoggedPercent) {
        lastLoggedPercent = logStep;
        logInfo(`下载进度: ${percent}% (${(loaded / 1024 / 1024).toFixed(2)} / ${(total / 1024 / 1024).toFixed(2)} MB)`);
      }
      onProgress?.({ loaded, total, percent });
    }
  }

  const blob = new Blob(chunks);
  logInfo(`下载完成，共 ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
  return blob;
}

// ===== 对外 API =====

/**
 * 获取模型 URL，优先从本地文件读取，不存在则下载
 * 内部加锁，并发调用时只下载一次
 */
export async function ensureModel(
  onProgress?: (progress: DownloadProgress) => void,
): Promise<ModelLoadResult> {
  if (ensureModelPromise) {
    logInfo('检测到已有下载任务进行中，复用现有任务');
    return ensureModelPromise;
  }

  ensureModelPromise = (async () => {
    try {
      const local = await checkLocalModel();
      if (local.exists) {
        logInfo(`命中本地缓存，文件大小 ${(local.size / 1024 / 1024).toFixed(2)} MB`);
        return { modelUrl: MODEL_URL, fromCache: true };
      }

      logInfo('本地无缓存，开始下载模型');
      await downloadAndSaveModel(onProgress);
      return { modelUrl: MODEL_URL, fromCache: false };
    } finally {
      ensureModelPromise = null;
    }
  })();

  return ensureModelPromise;
}

/**
 * 清除本地模型缓存
 */
export async function clearModelCache(): Promise<void> {
  logWarn('clearModelCache: 请手动删除 %LOCALAPPDATA%/DesktopFairy/models/ 目录');
}
