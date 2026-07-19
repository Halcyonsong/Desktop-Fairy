import { computed, onBeforeUnmount, ref } from 'vue';
import { ensureModel, type DownloadProgress } from './vosk/voskModelManager';
import { useLoggerStore } from '@/stores/loggerStore';
import { VOSK_TIMING } from '@/config/uiConstants';

// 运行时动态加载 vosk-browser，避免把 5MB+ 的语音识别运行时代码并入初始依赖图。
// 这里使用 import type 只保留类型信息，不会触发静态打包进入主入口。
import type { Model } from 'vosk-browser';
import type { RecognizerMessage } from 'vosk-browser/dist/interfaces';

const LOGGER_SOURCE = 'useVoskVoiceController';

function logInfo(message: string, details?: unknown) {
  const logger = useLoggerStore();
  logger.info(LOGGER_SOURCE, message, details);
  console.log(`[${LOGGER_SOURCE}] ${message}`, details ?? '');
}

function logError(message: string, details?: unknown) {
  const logger = useLoggerStore();
  logger.error(LOGGER_SOURCE, message, details);
  console.error(`[${LOGGER_SOURCE}] ${message}`, details ?? '');
}

// vosk-browser 的 KaldiRecognizer 类型是从 Model['KaldiRecognizer'] 派生的
type KaldiRecognizer = Model['KaldiRecognizer'] extends new (...args: never[]) => infer R ? R : never;

/**
 * 动态加载 vosk-browser 运行时。
 *
 * 设计目标：
 *   - 首屏不加载 5MB+ 的语音识别运行时代码
 *   - 只有用户第一次真正点击麦克风开始语音输入时才请求该 chunk
 *   - 模块结果缓存到进程内变量，后续复用，不重复 import
 */
let voskRuntimePromise: Promise<typeof import('vosk-browser')> | null = null;

async function loadVoskRuntime() {
  if (!voskRuntimePromise) {
    voskRuntimePromise = import('vosk-browser');
  }
  return voskRuntimePromise;
}

/**
 * Vosk 中文模型输出后处理
 *
 * Vosk 中文 small 模型的两个特点：
 *   1. 词之间用空格分隔（"喂 喂 喂 您好你 是 什么 模型"）
 *   2. 没有标点符号
 *
 * 后处理逻辑：
 *   - 去掉中文字符之间的空格（"喂 喂" → "喂喂"）
 *   - 保留英文单词之间的空格（"hello world" → "hello world"）
 *   - 保留中英文之间的单个空格（"你好 world" → "你好 world"）
 */
function postProcessChinese(text: string): string {
  if (!text) return text;
  let result = text;
  let prev = '';
  // 循环处理，直到没有变化（处理连续多个空格的情况）
  while (prev !== result) {
    prev = result;
    // 中文+空格+中文 → 中文+中文
    result = result.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2');
  }
  return result;
}

/**
 * 规则法加标点
 *
 * 策略（保守，宁可少加也不错加）：
 *   - 句末标点：每个 result 事件代表 Vosk 判定的一句话，末尾加句号
 *     - 若文本以问词结尾（"什么/吗/呢/谁/哪"），加问号
 *     - 否则加句号
 *   - 句中逗号：在 partialresult 间隔 > 500ms 处加逗号（代表说话停顿）
 *
 * 不处理的：
 *   - 感叹号（无法判断语气）
 *   - 分号、冒号等复杂标点
 */
function addPunctuation(text: string, options: { isSentenceEnd?: boolean } = {}): string {
  if (!text) return text;

  const { isSentenceEnd = false } = options;
  let result = text.trim();

  // 如果已经有标点结尾，不重复加
  const lastChar = result[result.length - 1];
  if (/[。，！？；：、,.!?;:]/.test(lastChar)) {
    return result;
  }

  if (isSentenceEnd) {
    // 句末：根据句尾词判断问句
    // 常见问句结尾词
    const questionPatterns = [
      /吗[？?]?$/,
      /呢[？?]?$/,
      /吧[？?]?$/,
      /谁[？?]?$/,
      /什么[？?]?$/,
      /怎么[？?]?$/,
      /为什么[？?]?$/,
      /哪[？?]?$/,
      /是不是[？?]?$/,
      /有没有[？?]?$/,
      /行不行[？?]?$/,
      /好不好[？?]?$/,
      /对不对[？?]?$/,
    ];
    const isQuestion = questionPatterns.some((p) => p.test(result));
    result = isQuestion ? `${result}？` : `${result}。`;
  }

  return result;
}



/**
 * 基于 vosk-browser 的本地离线语音输入封装
 *
 * 特性：
 *   - 完全离线，不依赖 Google 服务（解决 Electron 问题）
 *   - 首次使用时从 alphacephei.com 下载模型（~42MB），缓存到 IndexedDB
 *   - 流式识别，实时返回中间结果（partialresult）
 *   - 中文识别（vosk-model-small-cn-0.22）
 *
 * 相比 Web Speech API 的优势：
 *   - Electron 中可正常工作
 *   - 无需网络（首次下载后）
 *   - 无需 Google API Key
 *
 * 劣势：
 *   - 首次需下载模型（42MB）
 *   - 识别准确率略低于 Google 服务
 */

export interface VoskVoiceInputOptions {
  /** 最终结果回调 */
  onFinalResult?: (transcript: string) => void;
  /** 中间结果回调 */
  onInterimResult?: (transcript: string) => void;
  /** 状态变化回调 */
  onStateChange?: (listening: boolean) => void;
  /** 错误回调 */
  onError?: (error: string, message: string) => void;
  /** 模型下载进度回调 */
  onDownloadProgress?: (progress: DownloadProgress) => void;
}

export function useVoskVoiceController(options: VoskVoiceInputOptions = {}) {
  const {
    onFinalResult,
    onInterimResult,
    onStateChange,
    onError,
    onDownloadProgress,
  } = options;

  // Web Audio API + vosk-browser 在所有现代浏览器中都支持
  const isSupported = computed(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean(
      navigator.mediaDevices
        && typeof navigator.mediaDevices.getUserMedia === 'function'
        && window.AudioContext
        && typeof window.Worker !== 'undefined',
    );
  });

  const isListening = ref(false);
  const isLoading = ref(false);
  const loadingMessage = ref('');
  const downloadProgress = ref<DownloadProgress | null>(null);
  const interimText = ref('');
  const finalText = ref('');
  const errorMessage = ref('');

  let model: Model | null = null;
  let recognizer: KaldiRecognizer | null = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let recognizerNode: ScriptProcessorNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;

  // 标点恢复相关状态
  // partialresult 停顿检测：超过此间隔认为说话停顿，加逗号
  // 阈值集中到 config/uiConstants.ts，便于统一调整
  const PAUSE_THRESHOLD_MS = VOSK_TIMING.pauseThresholdMs;
  let lastPartialTime = 0;
  let lastPartialText = '';

  /**
   * 加载模型（带缓存）
   */
  async function loadModel(): Promise<string> {
    if (model?.ready) {
      // 已加载，返回空字符串占位
      return '';
    }

    isLoading.value = true;
    loadingMessage.value = '正在准备语音识别模型...';
    downloadProgress.value = null;

    try {
      logInfo('开始加载模型');
      const result = await ensureModel((progress) => {
        downloadProgress.value = progress;
        loadingMessage.value = `正在下载语音识别模型... ${progress.percent}%`;
        onDownloadProgress?.(progress);
      });
      logInfo(`模型准备完成 (fromCache: ${result.fromCache}, modelUrl: ${result.modelUrl})`);

      if (!model) {
        loadingMessage.value = '正在加载模型...';
        logInfo('调用 createModel（这一步可能耗时 10-20 秒）');
        const startTime = Date.now();

        // 每 5 秒打印一次心跳，确认是否卡死
        const heartbeatTimer = setInterval(() => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          logInfo(`createModel 进行中，已等待 ${elapsed} 秒`);
        }, 5000);

        // 超时 timer id 需在 try 外声明，便于 finally 块访问清理
        let timeoutId: number | undefined;
        try {
          // 首次真正使用语音输入时再动态加载 vosk-browser 运行时，避免进入初始主包
          const { createModel } = await loadVoskRuntime();

          // 加 120 秒超时，避免永久卡死
          const modelPromise = createModel(result.modelUrl);
          // 超时后底层 createModel 仍在运行，附加空 catch 防止 unhandled rejection
          modelPromise.catch(() => {});
          // 成功路径也要清理 timer，避免：
          //   1. 成功后 timer 仍占用 120 秒，超时后触发 reject（被 modelPromise.catch 静默吞掉，但浪费内存）
          //   2. 产生不必要的 unhandledrejection 事件
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error('createModel 超时（120 秒）')), 120000);
          });
          model = await Promise.race([modelPromise, timeoutPromise]);
        } catch (error) {
          // 超时或 createModel 失败：显式清空 model，确保下次 start 会重新加载
          model = null;
          throw error;
        } finally {
          clearInterval(heartbeatTimer);
          // 无论成功还是超时，都清理 timer
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
          }
        }

        logInfo(`模型加载成功，耗时 ${((Date.now() - startTime) / 1000).toFixed(1)} 秒`);
      } else {
        logInfo('模型已存在，跳过 createModel');
      }

      isLoading.value = false;
      loadingMessage.value = '';
      downloadProgress.value = null;
      return result.modelUrl;
    } catch (error) {
      isLoading.value = false;
      loadingMessage.value = '';
      downloadProgress.value = null;
      const message = `模型加载失败：${error instanceof Error ? error.message : String(error)}`;
      errorMessage.value = message;
      logError('loadModel failed:', error);
      throw new Error(message);
    }
  }

  /**
   * 创建识别器并开始监听
   */
  async function start() {
    if (!isSupported.value) {
      const message = '当前环境不支持语音识别';
      errorMessage.value = message;
      onError?.('not-supported', message);
      return;
    }

    if (isListening.value) {
      return;
    }

    errorMessage.value = '';
    interimText.value = '';

    try {
      // 1. 确保模型已加载
      await loadModel();
      if (!model) {
        throw new Error('模型加载失败');
      }

      // 2. 获取麦克风
      loadingMessage.value = '正在获取麦克风权限...';
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000,
        } as MediaTrackConstraints,
      });
      loadingMessage.value = '';

      // 3. 创建识别器
      recognizer = new model.KaldiRecognizer(16000);
      recognizer.on('result', (message: RecognizerMessage) => {
        if (message.event !== 'result') {
          return;
        }
        const rawText = message.result.text;
        if (rawText) {
          // 后处理：去掉中文词之间的空格 + 句末加标点
          const cleaned = postProcessChinese(rawText);
          const text = addPunctuation(cleaned, { isSentenceEnd: true });
          finalText.value += text;
          interimText.value = '';
          onFinalResult?.(text);
          // 重置停顿检测
          lastPartialTime = 0;
          lastPartialText = '';
        }
      });
      recognizer.on('partialresult', (message: RecognizerMessage) => {
        if (message.event !== 'partialresult') {
          return;
        }
        const rawPartial = message.result.partial;
        if (rawPartial) {
          // 后处理：去掉中文词之间的空格
          const partial = postProcessChinese(rawPartial);
          const now = Date.now();

          // 停顿检测：如果距上次 partialresult 超过阈值，且本次文本有新增，加逗号
          // 但只在 finalText 末尾没有标点时才加（避免重复）
          if (
            lastPartialTime > 0
            && now - lastPartialTime > PAUSE_THRESHOLD_MS
            && lastPartialText
            && partial !== lastPartialText
            && finalText.value
          ) {
            // 给上一段已确认的文本加逗号
            const lastChar = finalText.value[finalText.value.length - 1];
            if (!/[。，！？；：、,.!?;:]/.test(lastChar)) {
              finalText.value = `${finalText.value}，`;
            }
          }

          lastPartialTime = now;
          lastPartialText = partial;
          interimText.value = partial;
          onInterimResult?.(partial);
        }
      });

      // 4. 设置音频处理
      audioContext = new AudioContext();
      // 检查 AudioContext 状态，可能需要用户交互后才能 resume
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      sourceNode = audioContext.createMediaStreamSource(mediaStream);
      // createScriptProcessor 已废弃但仍可用，AudioWorklet 更现代但实现复杂
      recognizerNode = audioContext.createScriptProcessor(4096, 1, 1);
      recognizerNode.onaudioprocess = (event) => {
        try {
          if (recognizer) {
            recognizer.acceptWaveform(event.inputBuffer);
          }
        } catch (error) {
          console.error('[useVoskVoiceController] acceptWaveform failed:', error);
        }
      };

      // 连接音频图
      sourceNode.connect(recognizerNode);
      // ScriptProcessorNode 必须连接 destination 才会处理音频
      // 但我们不希望听到自己的声音，所以用 GainNode 控制
      const muteGain = audioContext.createGain();
      muteGain.gain.value = 0;
      recognizerNode.connect(muteGain);
      muteGain.connect(audioContext.destination);

      isListening.value = true;
      onStateChange?.(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorMessage.value = `启动失败：${message}`;
      console.error('[useVoskVoiceController] start failed:', error);
      onError?.('start-failed', message);
      cleanup();
    }
  }

  /**
   * 停止监听
   */
  function stop() {
    if (!isListening.value) {
      return;
    }

    cleanup();
    isListening.value = false;
    interimText.value = '';
    onStateChange?.(false);
  }

  function toggle() {
    if (isListening.value) {
      stop();
    } else {
      start();
    }
  }

  /**
   * 清理资源
   */
  function cleanup() {
    try {
      if (recognizerNode) {
        recognizerNode.disconnect();
        recognizerNode = null;
      }
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      if (recognizer) {
        recognizer.remove();
        recognizer = null;
      }
    } catch (error) {
      console.warn('[useVoskVoiceController] cleanup error:', error);
    }
  }

  function clearText() {
    interimText.value = '';
    finalText.value = '';
    errorMessage.value = '';
  }

  onBeforeUnmount(() => {
    cleanup();
    if (model) {
      model.terminate();
      model = null;
    }
  });

  return {
    isSupported,
    isListening,
    isLoading,
    loadingMessage,
    downloadProgress,
    interimText,
    finalText,
    errorMessage,
    start,
    stop,
    toggle,
    clearText,
  };
}
