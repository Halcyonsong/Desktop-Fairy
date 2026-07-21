import { watch } from 'vue';
import type { useModelSourceStore } from '@/stores/modelSourceStore';
import type { useBackendStatusStore } from '@/stores/backendStatusStore';
import type { useWorkbenchStore } from '@/stores/workbenchStore';

/**
 * FloatingFairy 初始化阶段的低风险启动守卫。
 *
 * 设计目标：
 *   - 把与 UI 无关的"数据是否已加载 / 是否重复并发请求"逻辑从大组件中抽离
 *   - 保留当前行为：静默失败，不打断精灵展示
 *   - 通过 Promise 锁避免初始化阶段重复请求会话列表和模型源
 *   - 等待后端 ready 后再加载，避免后端未启动时请求失败
 */
export function useFairyBootstrap(options: {
  workbenchStore: ReturnType<typeof useWorkbenchStore>;
  modelSourceStore: ReturnType<typeof useModelSourceStore>;
  backendStatusStore: ReturnType<typeof useBackendStatusStore>;
}) {
  const { workbenchStore, modelSourceStore, backendStatusStore } = options;

  let ensureSessionListLoading: Promise<void> | null = null;
  let ensureModelSourceLoading: Promise<void> | null = null;

  /**
   * 等待后端 ready（Electron 环境下由 IPC 通知触发）
   * 非 Electron 环境直接返回
   */
  function waitForBackendReady(): Promise<void> {
    if (backendStatusStore.ready) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const stop = watch(
        () => backendStatusStore.ready,
        (ready) => {
          if (ready) {
            stop();
            resolve();
          }
        },
      );
    });
  }

  async function ensureSessionListLoaded() {
    if (workbenchStore.sessions.length > 0) {
      return;
    }

    if (ensureSessionListLoading) {
      return ensureSessionListLoading;
    }

    ensureSessionListLoading = (async () => {
      try {
        // 等待后端 ready 后再加载会话列表，避免请求失败
        await waitForBackendReady();
        await workbenchStore.bootstrap();
      } catch {
        // 保持静默，避免影响精灵展示
      } finally {
        ensureSessionListLoading = null;
      }
    })();

    return ensureSessionListLoading;
  }

  async function ensureModelSourceLoaded() {
    if (modelSourceStore.sources.length > 0 && (modelSourceStore.selectedChatModelConfig || !modelSourceStore.selectedChatSourceCode)) {
      return;
    }

    if (ensureModelSourceLoading) {
      return ensureModelSourceLoading;
    }

    ensureModelSourceLoading = (async () => {
      try {
        // 等待后端 ready 后再加载模型源
        await waitForBackendReady();
        await modelSourceStore.bootstrap();
      } catch {
        // 保持静默，避免影响精灵展示
      } finally {
        ensureModelSourceLoading = null;
      }
    })();

    return ensureModelSourceLoading;
  }

  return {
    ensureSessionListLoaded,
    ensureModelSourceLoaded,
  };
}
