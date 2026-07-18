import { ref } from 'vue';

type FairyStoreLike = {
  position: { x: number; y: number } | null;
  setPosition: (nextPosition: { x: number; y: number } | null) => void;
  commitPosition: () => void;
};

interface DragControllerOptions {
  fairyStore: FairyStoreLike;
  hideOverlay: () => void;
  onDragStateChange: (dragging: boolean) => void;
  onDragCommitted?: () => void;
  useNativeWindowDrag?: boolean | (() => boolean);
}

export function useFairyDragController({
  fairyStore,
  hideOverlay,
  onDragStateChange,
  onDragCommitted,
  useNativeWindowDrag = false,
}: DragControllerOptions) {
  const shellRef = ref<HTMLElement | null>(null);
  const suppressClick = ref(false);

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
    };

    const handlePointerEnd = () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
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

      finishDrag();
    };

    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerEnd, true);
    window.addEventListener('pointercancel', handlePointerEnd, true);
    window.addEventListener('blur', handlePointerEnd);
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
