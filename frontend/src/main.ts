import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useBackendStatusStore } from '@/stores/backendStatusStore';
import { useFairyStore } from '@/stores/fairyStore';
import { useWindowModeStore, type WindowMode } from '@/stores/windowModeStore';
import { installConsoleInterceptor } from '@/modules/installConsoleInterceptor';
import './styles/global.css';

/**
 * 动态注入 Source Han Serif CN 子集字体的 @font-face 规则。
 *
 * 字体文件位于 public/fonts/SourceHanSerifCN-Regular.subset.woff2，作为静态资源
 * 不参与 Vite 打包，便于后续继续调整子集范围或替换为新的字体版本。
 *
 * 不在 CSS 中直接写 url() 的原因：
 *   - Vite base 配置为 './'，且 Electron 生产环境通过 loadFile (file:// 协议)
 *     加载 dist/index.html。CSS 中绝对路径 '/fonts/...' 在 file:// 下会被
 *     解析为 file:///fonts/... (磁盘根)，加载失败。
 *   - 用 new URL(path, window.location.href) 可同时兼容 dev server
 *     (http://localhost:xxxx) 和 Electron file:// 协议。该模式参考
 *     src/modules/fairy/petLoader.ts 的实现。
 */
function injectSerifFontFace() {
  const fontUrl = new URL('fonts/SourceHanSerifCN-Regular.subset.woff2', window.location.href).href;
  const style = document.createElement('style');
  style.textContent = [
    '@font-face {',
    "  font-family: 'Source Han Serif CN';",
    `  src: url('${fontUrl}') format('woff2');`,
    '  font-style: normal;',
    '  font-weight: 400;',
    '  font-display: swap;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

declare global {
  interface Window {
    desktopFairy?: {
      getWindowMode?: () => Promise<string>;
      getFairyPreferences?: () => Promise<{ enabled?: boolean }>;
      resetFairyPosition?: () => Promise<{ x: number; y: number; width: number; height: number }>;
      beginFairyDrag?: (payload: { screenX: number; screenY: number }) => void;
      updateFairyDrag?: (payload: { screenX: number; screenY: number }) => void;
      endFairyDrag?: () => void;
      setFairyMouseIgnore?: (ignore: boolean) => void;
      setFairyDragging?: (dragging: boolean) => void;
      setFairyEnabled?: (enabled: boolean) => void;
      onForceDisableResidentChat?: (callback: () => void) => void;
      onEnableFairyFromTray?: (callback: () => void) => void;
      onBackendReady?: (callback: () => void) => void;
      getFilePaths?: () => Promise<FilePathsResult>;
      readBackendLog?: (lines: number) => Promise<BackendLogResult>;
      // 最小化行为偏好
      getMinimizePrefs?: () => Promise<MinimizePrefs>;
      setMinimizePrefs?: (prefs: Partial<MinimizePrefs>) => Promise<MinimizePrefs>;
      executeMinimize?: (behavior: MinimizeBehavior) => Promise<void>;
      onAskMinimize?: (callback: () => void) => void;
      // 文件选择对话框
      showOpenFileDialog?: () => Promise<string[] | null>;
      // 截图捕获（options: { hideWindow?: boolean }）
      captureScreenshot?: (options?: { hideWindow?: boolean }) => Promise<string | null>;
      // 读取文件为 Data URL（图片预览）
      readFileAsDataUrl?: (filePath: string) => Promise<string | null>;
      // 读取文件为文本（文本预览）
      readFileAsText?: (filePath: string) => Promise<string | null>;
    };
  }
}

export type MinimizeBehavior = 'taskbar' | 'tray';

export interface MinimizePrefs {
  behavior: MinimizeBehavior;
  askAgain: boolean;
}

/** 后端 SessionFileReferenceVO 对应的前端类型 */
export interface SessionFileReference {
  fileReferenceId: string;
  sessionId: string;
  absolutePath: string;
  originalFileName: string;
  contentType: string;
  fileSize: number;
  lastKnownModifiedTime: string;
  status: string;
  createTime: string;
  updateTime: string;
}

export interface FilePathsResult {
  home: string;
  localAppData: string;
  userData: string;
  paths: Array<{
    key: string;
    label: string;
    path: string;
    description: string;
  }>;
}

export interface BackendLogResult {
  path: string;
  content: string;
  exists: boolean;
  message?: string;
  fileSize?: number;
  lines?: number;
}

function resolveWindowModeFromLocation(): WindowMode | null {
  const queryMode = new URLSearchParams(window.location.search).get('windowMode');
  if (queryMode === 'fairy' || queryMode === 'workbench') {
    return queryMode;
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashMode = new URLSearchParams(hash).get('windowMode');
  if (hashMode === 'fairy' || hashMode === 'workbench') {
    return hashMode;
  }

  return null;
}

async function resolveInitialWindowMode(): Promise<WindowMode> {
  const locationMode = resolveWindowModeFromLocation();
  if (locationMode) {
    return locationMode;
  }

  const bridgeMode = await window.desktopFairy?.getWindowMode?.();
  return bridgeMode === 'fairy' || bridgeMode === 'workbench' ? bridgeMode : 'workbench';
}

async function preloadFairyNativePreferences(fairyStore: ReturnType<typeof useFairyStore>) {
  const nativePreferences = await window.desktopFairy?.getFairyPreferences?.();
  if (typeof nativePreferences?.enabled === 'boolean') {
    fairyStore.hydrateEnabled(nativePreferences.enabled);
  }
}

async function bootstrap() {
  injectSerifFontFace();
  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  // 设置 activePinia，让组件外部（如 console 拦截器）能调用 useLoggerStore()
  setActivePinia(pinia);

  // 安装 console 拦截器（捕获所有日志到 loggerStore）
  installConsoleInterceptor();

  const appearanceStore = useAppearanceStore();
  const fairyStore = useFairyStore();
  const windowModeStore = useWindowModeStore();
  const backendStatusStore = useBackendStatusStore();

  await preloadFairyNativePreferences(fairyStore);

  appearanceStore.initializeAppearance();
  appearanceStore.initializeSync();
  fairyStore.initializeSync();
  fairyStore.syncNativeWindowState();
  window.desktopFairy?.onForceDisableResidentChat?.(() => {
    fairyStore.setResidentChatEnabled(false);
    fairyStore.setEnabled(false);
  });
  window.desktopFairy?.onEnableFairyFromTray?.(() => {
    fairyStore.setEnabled(true);
  });
  // 监听后端就绪 IPC 通知（Electron 环境下主进程发送）
  window.desktopFairy?.onBackendReady?.(() => {
    backendStatusStore.markReady();
  });
  windowModeStore.setWindowMode(await resolveInitialWindowMode());

  app.mount('#app');
}

void bootstrap();
