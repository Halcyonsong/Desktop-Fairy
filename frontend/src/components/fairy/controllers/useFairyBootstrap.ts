import type { useModelSourceStore } from '@/stores/modelSourceStore';
import type { useWorkbenchStore } from '@/stores/workbenchStore';

/**
 * FloatingFairy 初始化阶段的低风险启动守卫。
 *
 * 设计目标：
 *   - 把与 UI 无关的“数据是否已加载 / 是否重复并发请求”逻辑从大组件中抽离
 *   - 保留当前行为：静默失败，不打断精灵展示
 *   - 通过 Promise 锁避免初始化阶段重复请求会话列表和模型源
 */
export function useFairyBootstrap(options: {
  workbenchStore: ReturnType<typeof useWorkbenchStore>;
  modelSourceStore: ReturnType<typeof useModelSourceStore>;
}) {
  const { workbenchStore, modelSourceStore } = options;

  let ensureSessionListLoading: Promise<void> | null = null;
  let ensureModelSourceLoading: Promise<void> | null = null;

  async function ensureSessionListLoaded() {
    if (workbenchStore.sessions.length > 0) {
      return;
    }

    if (ensureSessionListLoading) {
      return ensureSessionListLoading;
    }

    ensureSessionListLoading = (async () => {
      try {
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
