import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useBackendStatusStore } from '@/stores/backendStatusStore';
import { useFairyStore } from '@/stores/fairyStore';
import { useWindowModeStore, type WindowMode } from '@/stores/windowModeStore';
import { installConsoleInterceptor } from '@/modules/installConsoleInterceptor';
import './styles/global.css';
// 业务/IPC 类型与 window.desktopFairy 全局声明已迁移至 @/types/electron；
// 此处 import type 同时确保该模块（含 declare global 增强）被纳入类型检查程序。
import type { SessionFileReference } from '@/types/electron';

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

  // 带超时的 IPC 调用，防止主进程卡死导致永久白屏
  try {
    const bridgeMode = await Promise.race([
      window.desktopFairy?.getWindowMode?.(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getWindowMode timeout')), 5000),
      ),
    ]);
    return bridgeMode === 'fairy' || bridgeMode === 'workbench' ? bridgeMode : 'workbench';
  } catch {
    // IPC 超时或失败，降级为 workbench 模式
    console.warn('[bootstrap] Failed to resolve window mode, falling back to workbench');
    return 'workbench';
  }
}

async function preloadFairyNativePreferences(fairyStore: ReturnType<typeof useFairyStore>) {
  try {
    const nativePreferences = await window.desktopFairy?.getFairyPreferences?.();
    if (typeof nativePreferences?.enabled === 'boolean') {
      fairyStore.hydrateEnabled(nativePreferences.enabled);
    }
  } catch (error) {
    // IPC 调用失败不阻断启动，降级使用 localStorage 中的值
    console.warn('[bootstrap] Failed to preload fairy native preferences:', error);
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
  window.desktopFairy?.onBackendNotReady?.(() => {
    backendStatusStore.markNotReady();
  });
  windowModeStore.setWindowMode(await resolveInitialWindowMode());

  app.mount('#app');
}

// 启动应用，捕获未处理异常防止白屏
void bootstrap().catch((error) => {
  console.error('[bootstrap] Fatal error during startup:', error);
  // 降级：即使初始化失败也尝试 mount 应用
  const appRoot = document.getElementById('app');
  if (appRoot && !appRoot.innerHTML) {
    appRoot.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#1f2329;"><h2>启动失败</h2><p>应用初始化遇到错误，请重启。</p><pre style="font-size:12px;color:#8a9099;">' + String(error) + '</pre></div>';
  }
});
