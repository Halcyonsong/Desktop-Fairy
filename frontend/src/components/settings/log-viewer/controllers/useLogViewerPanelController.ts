import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useDesktopFairyAPI } from '@/api/useDesktopFairyAPI';
import { copyText } from '@/utils/clipboard';
import { LOG_VIEWER, UI_TIMING } from '@/config/uiConstants';

interface UseLogViewerPanelControllerOptions {
  activeTab: Ref<'frontend' | 'backend'>;
  exportFrontendLogs: () => string;
}

/**
 * 日志查看面板控制器。
 *
 * 负责：
 * - 复制按钮反馈状态
 * - 后端日志加载/复制
 * - 切换到后端日志 tab 时的首次自动加载
 */
export function useLogViewerPanelController(options: UseLogViewerPanelControllerOptions) {
  const { activeTab, exportFrontendLogs } = options;
  const desktopFairy = useDesktopFairyAPI();

  const copyButtonTitle = ref('复制全部');
  const copyResetTimer = ref<number | null>(null);
  const COPY_FEEDBACK_DURATION_MS = UI_TIMING.copyFeedbackResetMs;

  // 后端日志复制按钮独立反馈状态
  const backendCopyButtonTitle = ref('复制全部');
  const backendCopyResetTimer = ref<number | null>(null);

  const backendLogs = ref('');
  const backendLogPath = ref('');
  const backendLogLoading = ref(false);
  const backendLogError = ref('');
  const backendLogLines = ref<number>(LOG_VIEWER.backendLogDefaultLines);

  const backendLogArray = computed(() => {
    if (!backendLogs.value) return [];
    return backendLogs.value.split('\n');
  });

  function flashCopyButton(success: boolean) {
    if (copyResetTimer.value !== null) {
      window.clearTimeout(copyResetTimer.value);
    }
    copyButtonTitle.value = success ? '已复制！' : '复制失败';
    copyResetTimer.value = window.setTimeout(() => {
      copyButtonTitle.value = '复制全部';
      copyResetTimer.value = null;
    }, COPY_FEEDBACK_DURATION_MS);
  }

  function flashBackendCopyButton(success: boolean) {
    if (backendCopyResetTimer.value !== null) {
      window.clearTimeout(backendCopyResetTimer.value);
    }
    backendCopyButtonTitle.value = success ? '已复制！' : '复制失败';
    backendCopyResetTimer.value = window.setTimeout(() => {
      backendCopyButtonTitle.value = '复制全部';
      backendCopyResetTimer.value = null;
    }, COPY_FEEDBACK_DURATION_MS);
  }

  async function copyAllLogs() {
    const text = exportFrontendLogs();
    await copyText(text, {
      onSuccess: () => flashCopyButton(true),
      onFail: () => flashCopyButton(false),
    });
  }

  async function loadBackendLogs() {
    if (!desktopFairy.isAvailable()) {
      backendLogError.value = '此功能仅在 Electron 桌面应用环境下可用。';
      return;
    }
    backendLogLoading.value = true;
    backendLogError.value = '';
    try {
      const result = await desktopFairy.readBackendLog(backendLogLines.value);
      backendLogs.value = result.content;
      backendLogPath.value = result.path;
    } catch (e) {
      backendLogError.value = e instanceof Error ? e.message : String(e);
      backendLogs.value = '';
    } finally {
      backendLogLoading.value = false;
    }
  }

  async function copyBackendLogs() {
    const text = backendLogs.value;
    await copyText(text, {
      onSuccess: () => flashBackendCopyButton(true),
      onFail: () => flashBackendCopyButton(false),
    });
  }

  watch(activeTab, (tab) => {
    if (tab === 'backend' && !backendLogs.value && !backendLogLoading.value) {
      void loadBackendLogs();
    }
  });

  onBeforeUnmount(() => {
    if (copyResetTimer.value !== null) {
      window.clearTimeout(copyResetTimer.value);
      copyResetTimer.value = null;
    }
    if (backendCopyResetTimer.value !== null) {
      window.clearTimeout(backendCopyResetTimer.value);
      backendCopyResetTimer.value = null;
    }
  });

  return {
    copyButtonTitle,
    backendCopyButtonTitle,
    backendLogs,
    backendLogPath,
    backendLogLoading,
    backendLogError,
    backendLogLines,
    backendLogArray,
    copyAllLogs,
    loadBackendLogs,
    copyBackendLogs,
  };
}
