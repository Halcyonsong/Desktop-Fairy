import { onBeforeUnmount, ref } from 'vue';

type FairyStoreLike = {
  position: { x: number; y: number } | null;
  setPosition: (nextPosition: { x: number; y: number } | null) => void;
  commitPosition: () => void;
};

interface DragControllerOptions {
  fairyStore: FairyStoreLike;
  hideOverlay: () => void;
  onDragStateChange: (dragging: boolean) => void;
  onDragMove?: (deltaX: number) => void;
  onDragCommitted?: () => void;
  useNativeWindowDrag?: boolean | (() => boolean);
}

export function useFairyDragController({
  fairyStore,
  hideOverlay,
  onDragStateChange,
  onDragMove,
  onDragCommitted,
  useNativeWindowDrag = false,
}: DragControllerOptions) {
  const shellRef = ref<HTMLElement | null>(null);
  const suppressClick = ref(false);

  // 保存拖拽期间的清理函数，用于组件卸载时强制清理全局监听器
  // 避免用户在拖拽过程中关闭精灵开关导致 4 个全局监听器永久泄漏
  let activeCleanup: (() => void) | null = null;

  onBeforeUnmount(() => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  });

  function shouldUseNativeWindowDrag() {
    return typeof useNativeWindowDrag === 'function' ? useNativeWindowDrag() : useNativeWindowDrag;
  }

  function clampPosition(x: number, y: number, elementWidth: number, elementHeight: number) {
    const maxX = Math.max(window.innerWidth - elementWidth - 8, 8);
    const maxY = Math.max(window.innerHeight - elementHeight - 8, 8);

    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    };
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const shell = shellRef.value ?? target.closest('.floating-fairy-shell');
    if (!(shell instanceof HTMLElement)) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startScreenX = event.screenX;
    const startScreenY = event.screenY;
    const startPosition = fairyStore.position
      ? { ...fairyStore.position }
      : {
          x: shellRect.left,
          y: shellRect.top,
        };

    let moved = false;
    let finished = false;
    const nativeDragEnabled =
      shouldUseNativeWindowDrag() && typeof window !== 'undefined' && typeof window.desktopFairy?.beginFairyDrag === 'function';

    onDragStateChange(true);
    hideOverlay();
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      // 某些情况下 setPointerCapture 可能失败（如元素已脱离文档），不影响后续拖拽
    }

    const finishDrag = () => {
      if (finished) {
        return;
      }
      finished = true;
      onDragStateChange(false);

      if (!moved) {
        return;
      }

      if (nativeDragEnabled) {
        window.desktopFairy?.endFairyDrag?.();
        window.desktopFairy?.setFairyDragging?.(false);
      } else {
        fairyStore.commitPosition();
      }

      onDragCommitted?.();

      window.setTimeout(() => {
        suppressClick.value = false;
      }, 0);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (!moved && Math.abs(deltaX) + Math.abs(deltaY) > 4) {
        moved = true;
        suppressClick.value = true;

        if (nativeDragEnabled) {
          // 触发原生拖拽，主进程会启动光标轮询定时器接管后续窗口移动
          window.desktopFairy?.setFairyDragging?.(true);
          window.desktopFairy?.beginFairyDrag?.({
            screenX: startScreenX,
            screenY: startScreenY,
          });
          // native drag 模式下，移除 pointermove 监听器，窗口移动完全由主进程轮询接管
          // 避免窗口 setPosition 产生的额外 pointermove 事件干扰（buttons 异常、坐标不一致等）
          window.removeEventListener('pointermove', handlePointerMove, true);
          // 但保留一个 mousemove 监听用于跟踪拖动方向（仅用于切换精灵动作，不操作位置）
          window.addEventListener('mousemove', handleNativeDragDirection, true);
          return;
        }
      }

      if (!moved) {
        return;
      }

      moveEvent.preventDefault();

      const nextPosition = clampPosition(
        startPosition.x + deltaX,
        startPosition.y + deltaY,
        shellRect.width,
        shellRect.height,
      );

      fairyStore.setPosition(nextPosition);

      // 通知拖动方向（用于切换精灵动作）
      if (deltaX !== 0) {
        onDragMove?.(deltaX);
      }
    };

    // native drag 模式下用于跟踪拖动方向的监听器
    const handleNativeDragDirection = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.screenX - startScreenX;
      if (deltaX !== 0) {
        onDragMove?.(deltaX);
      }
    };

    const handlePointerEnd = () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('mousemove', handleNativeDragDirection, true);
      window.removeEventListener('pointerup', handlePointerEnd, true);
      window.removeEventListener('pointercancel', handlePointerEnd, true);
      window.removeEventListener('blur', handlePointerEnd);

      try {
        if (target.hasPointerCapture?.(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
      } catch {
        // 释放 pointer capture 失败不影响拖拽结束
      }

      // 拖拽正常结束，清空 cleanup 引用，避免 onBeforeUnmount 重复清理
      activeCleanup = null;

      finishDrag();
    };

    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerEnd, true);
    window.addEventListener('pointercancel', handlePointerEnd, true);
    window.addEventListener('blur', handlePointerEnd);

    // 注册 cleanup，用于组件卸载时强制清理 4 个全局监听器
    // 不直接复用 handlePointerEnd 是为了避免重复触发 finishDrag（onDragStateChange 等）
    // 这里只移除监听器，状态收尾交给 finishDrag 在 pointerup 时处理
    activeCleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('mousemove', handleNativeDragDirection, true);
      window.removeEventListener('pointerup', handlePointerEnd, true);
      window.removeEventListener('pointercancel', handlePointerEnd, true);
      window.removeEventListener('blur', handlePointerEnd);

      try {
        if (target.hasPointerCapture?.(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
      } catch {
        // 忽略
      }

      // 组件卸载时也要通知拖拽状态结束，避免上层状态卡在 dragging=true
      onDragStateChange(false);
    };
  }

  function shouldSuppressClick() {
    return suppressClick.value;
  }

  return {
    shellRef,
    handlePointerDown,
    shouldSuppressClick,
  };
}
