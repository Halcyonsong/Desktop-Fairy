import { onBeforeUnmount, onMounted, ref, watch, type ComputedRef } from 'vue';

interface MouseIgnoreControllerOptions {
  /**
   * 是否为原生精灵窗口（Electron 独立窗口）
   * 仅原生窗口需要处理 setIgnoreMouseEvents
   */
  isNativeFairyWindow: ComputedRef<boolean> | (() => boolean);
  /**
   * 拖动状态：拖动中强制不穿透，避免拖动时丢失鼠标事件
   */
  isDragging: ComputedRef<boolean> | (() => boolean);
  /**
   * 是否有交互元素被固定显示（气泡、输入框、会话选择器等）
   * 有交互元素时强制不穿透，让用户能点击
   */
  interactivePinned: ComputedRef<boolean> | (() => boolean);
}

/**
 * 桌面精灵鼠标穿透管理
 *
 * 职责：
 *   1. 在原生精灵窗口中，根据交互状态切换 setIgnoreMouseEvents
 *   2. 鼠标悬停在交互元素上时不穿透，悬停在空白区域时穿透
 *   3. 拖动期间强制不穿透
 *
 * 设计说明：
 *   - 仅在 isNativeFairyWindow 为 true 时生效，工作台内嵌精灵不处理
 *   - 通过 elementFromPoint 检测鼠标下是否为交互元素
 *   - 交互元素需标记 data-fairy-interactive="true"
 */
export function useFairyMouseIgnoreController(options: MouseIgnoreControllerOptions) {
  const isPinned = ref(false);

  function resolveValue<T>(source: T | (() => T)): T {
    return typeof source === 'function' ? (source as () => T)() : source;
  }

  function getIsNative() {
    const source = options.isNativeFairyWindow;
    if (typeof source === 'function') {
      return source();
    }
    // ComputedRef
    return (source as ComputedRef<boolean>).value;
  }

  function getIsDragging() {
    const source = options.isDragging;
    if (typeof source === 'function') {
      return source();
    }
    return (source as ComputedRef<boolean>).value;
  }

  function getInteractivePinned() {
    const source = options.interactivePinned;
    if (typeof source === 'function') {
      return source();
    }
    return (source as ComputedRef<boolean>).value;
  }

  function syncPinnedState() {
    isPinned.value = getInteractivePinned();
    syncToNative();
  }

  function syncToNative() {
    if (!getIsNative() || typeof window === 'undefined') {
      return;
    }

    const shouldIgnore = !(isPinned.value || getIsDragging());
    window.desktopFairy?.setFairyMouseIgnore?.(!shouldIgnore);
  }

  function syncFromPoint(clientX: number, clientY: number) {
    if (!getIsNative() || typeof window === 'undefined') {
      return;
    }

    // 拖动中或固定显示时，强制不穿透
    if (isPinned.value || getIsDragging()) {
      window.desktopFairy?.setFairyMouseIgnore?.(false);
      return;
    }

    const target = document.elementFromPoint(clientX, clientY);
    const interactive = target instanceof HTMLElement && !!target.closest('[data-fairy-interactive="true"]');
    window.desktopFairy?.setFairyMouseIgnore?.(!interactive);
  }

  function handleNativeMouseMove(event: MouseEvent) {
    syncFromPoint(event.clientX, event.clientY);
  }

  function handleNativeMouseLeave() {
    if (!getIsNative() || typeof window === 'undefined') {
      return;
    }

    if (isPinned.value || getIsDragging()) {
      return;
    }

    window.desktopFairy?.setFairyMouseIgnore?.(true);
  }

  onMounted(() => {
    if (!getIsNative() || typeof window === 'undefined') {
      return;
    }

    window.desktopFairy?.setFairyMouseIgnore?.(true);
    window.addEventListener('mousemove', handleNativeMouseMove);
    window.addEventListener('mouseleave', handleNativeMouseLeave);
  });

  onBeforeUnmount(() => {
    if (!getIsNative() || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('mousemove', handleNativeMouseMove);
    window.removeEventListener('mouseleave', handleNativeMouseLeave);
    window.desktopFairy?.setFairyMouseIgnore?.(true);
  });

  // 交互状态变化时同步穿透状态
  watch(
    () => [getInteractivePinned(), getIsDragging()] as const,
    () => {
      syncToNative();
    },
  );

  return {
    isPinned,
    syncPinnedState,
    syncFromPoint,
    handleNativeMouseMove,
    handleNativeMouseLeave,
  };
}
