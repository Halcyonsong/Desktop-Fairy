// 桌面精灵拖动控制器
// 职责：
//   1. 接收渲染进程的拖动 IPC（drag-begin / drag-update / drag-end）
//   2. 优先使用 Windows native API 拖动（GetCursorPos + MoveWindow）
//      全程物理像素坐标系操作，绕开 Electron 的 DIP 转换，从根本上解决 DPI 缩放导致的拖动问题
//   3. native 不可用时降级到 Electron 轮询方案（getCursorScreenPoint + setPosition）
//   4. 边界限制（clampFairyPosition），保证窗口始终在工作区内
//   5. 拖动期间的鼠标穿透状态切换
//
// 为什么不用 WM_NCLBUTTONDOWN(HTCAPTION)：
//   - 该方案要求窗口有非客户区（caption），但精灵窗口是 frame: false，没有 caption
//   - Windows 会忽略对 frameless 窗口的 HTCAPTION 请求，导致无法拖动
//
// 为什么用 GetCursorPos + MoveWindow 而不是 Electron API：
//   - screen.getCursorScreenPoint() 在 DPI 缩放下的行为不一致（可能返回物理像素）
//   - BrowserWindow.getBounds()/setPosition() 返回 DIP（设备独立像素）
//   - 混合不同坐标系会导致"方向性受限"（往右下能动、往左上不动）
//   - GetCursorPos 和 MoveWindow 都是物理像素，坐标系一致，问题根治

const { BrowserWindow, screen } = require('electron');

const FAIRY_WINDOW_WIDTH = 520;
const FAIRY_WINDOW_HEIGHT = 620;
const DRAG_POLL_INTERVAL_MS = 16;
const DRAG_JITTER_THRESHOLD_PX = 1;

// Windows API 常量
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_NOSIZE = 0x0001;

/**
 * POINT 结构体定义（koffi.struct）
 * @typedef {Object} POINT
 * @property {number} x
 * @property {number} y
 */
/**
 * RECT 结构体定义（koffi.struct）
 * @typedef {Object} RECT
 * @property {number} left
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 */

/**
 * 初始化 Windows native 拖动 API
 * @returns {{beginDrag: (hwnd: number) => {x:number,y:number}, pollMove: (hwnd: number, startX: number, startY: number) => {moved: boolean, x?: number, y?: number}} | null}
 */
function loadNativeDragApi() {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    const koffi = require('koffi');

    // 定义结构体
    const POINT = koffi.struct('POINT', {
      x: 'int32',
      y: 'int32',
    });
    const RECT = koffi.struct('RECT', {
      left: 'int32',
      top: 'int32',
      right: 'int32',
      bottom: 'int32',
    });

    const user32 = koffi.load('user32.dll');
    const GetCursorPos = user32.func('bool __stdcall GetCursorPos(_Out_ POINT *lpPoint)');
    const GetWindowRect = user32.func('bool __stdcall GetWindowRect(int hWnd, _Out_ RECT *lpRect)');
    const MoveWindow = user32.func('bool __stdcall MoveWindow(int hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint)');

    /**
     * 获取物理像素坐标系下的窗口矩形
     */
    function getWindowRect(hwnd) {
      // koffi 的 _Out_ 参数：传入空对象，koffi 自动填充
      const rect = {};
      const status = GetWindowRect(hwnd, rect);
      if (!status) {
        return null;
      }
      return {
        x: rect.left,
        y: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
      };
    }

    /**
     * 获取物理像素坐标系下的光标位置
     */
    function getCursorPos() {
      const point = {};
      const status = GetCursorPos(point);
      if (!status) {
        return null;
      }
      return { x: point.x, y: point.y };
    }

    return {
      /**
       * 获取窗口当前位置和光标位置，用于计算 offset
       * @returns {{windowX, windowY, cursorX, cursorY, width, height} | null}
       */
      beginDrag(hwnd) {
        const winRect = getWindowRect(hwnd);
        const cursor = getCursorPos();
        if (!winRect || !cursor) {
          return null;
        }
        return {
          windowX: winRect.x,
          windowY: winRect.y,
          cursorX: cursor.x,
          cursorY: cursor.y,
          width: winRect.width,
          height: winRect.height,
        };
      },

      /**
       * 轮询鼠标移动，如果鼠标移动了，按 delta 移动窗口
       * @param {number} hwnd - 窗口句柄
       * @param {number} startCursorX - 开始时光标 x
       * @param {number} startCursorY - 开始时光标 y
       * @param {number} startWindowX - 开始时窗口 x
       * @param {number} startWindowY - 开始时窗口 y
       * @param {number} windowWidth - 窗口宽度（物理像素）
       * @param {number} windowHeight - 窗口高度（物理像素）
       * @returns {{moved: boolean, x: number, y: number} | null}
       */
      pollMove(hwnd, startCursorX, startCursorY, startWindowX, startWindowY, windowWidth, windowHeight) {
        const cursor = getCursorPos();
        if (!cursor) {
          return null;
        }

        const deltaX = cursor.x - startCursorX;
        const deltaY = cursor.y - startCursorY;

        // 新窗口位置 = 初始窗口位置 + 鼠标位移
        // 全程物理像素，坐标系统一，不会有 DPI 转换问题
        const newX = startWindowX + deltaX;
        const newY = startWindowY + deltaY;

        // 不做边界限制，让用户能自由拖动
        // （如果需要边界限制，可以在这里调用 getMonitorRect + clamp）
        MoveWindow(hwnd, newX, newY, windowWidth, windowHeight, false);

        return { moved: deltaX !== 0 || deltaY !== 0, x: newX, y: newY };
      },

      /**
       * 获取窗口当前位置（物理像素）
       */
      getWindowRect,

      /**
       * 获取显示器工作区（物理像素）用于边界限制
       * 当前未实现边界限制，保留接口以便后续扩展，返回 null 表示不限制
       */
      getMonitorWorkArea() {
        // 边界限制暂未实现（Windows 原生拖动不强制边界），
        // 此处不调用 getWindowRect 以避免无意义的物理像素读取
        return null;
      },
    };
  } catch (error) {
    console.warn('[fairyDragController] koffi 加载失败，降级到 Electron 轮询方案:', error?.message || error);
    return null;
  }
}

/**
 * 将窗口位置限制在指定显示器的工作区内（Electron DIP 坐标系）
 */
function clampFairyPosition(x, y, width = FAIRY_WINDOW_WIDTH, height = FAIRY_WINDOW_HEIGHT) {
  const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
  const workArea = display.workArea;
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  return {
    x: Math.min(Math.max(workArea.x, Math.round(x)), maxX),
    y: Math.min(Math.max(workArea.y, Math.round(y)), maxY),
  };
}

/**
 * 创建拖动控制器
 */
function createFairyDragController(getFairyWindow) {
  // native 方案状态
  let nativeSession = null;
  let dragTimer = null;
  let dragLastCursor = null;
  let dragging = false;

  // 轮询 fallback 方案状态
  let dragSession = null;

  const nativeApi = loadNativeDragApi();
  if (nativeApi) {
    console.log('[fairyDragController] native 拖动已启用（GetCursorPos + MoveWindow）');
  } else {
    console.log('[fairyDragController] 使用 Electron 轮询方案');
  }

  // ============ native 方案（物理像素坐标）============

  function startNativePolling(hwnd) {
    stopTimer();
    dragTimer = setInterval(() => {
      if (!nativeSession) {
        stopTimer();
        return;
      }
      const result = nativeApi.pollMove(
        hwnd,
        nativeSession.startCursorX,
        nativeSession.startCursorY,
        nativeSession.startWindowX,
        nativeSession.startWindowY,
        nativeSession.windowWidth,
        nativeSession.windowHeight,
      );
      if (result?.moved) {
        // 更新 dragLastCursor 用于抖动抑制（虽然 native 方案不做抑制）
        dragLastCursor = { x: result.x, y: result.y };
      }
    }, DRAG_POLL_INTERVAL_MS);
  }

  // ============ 轮询 fallback 方案（Electron DIP 坐标）============

  function updatePositionByCursor(pointerScreenX, pointerScreenY) {
    const fairyWindow = getFairyWindow();
    if (!dragSession || !fairyWindow || fairyWindow.isDestroyed()) {
      return;
    }

    const next = clampFairyPosition(
      dragSession.offsetX + pointerScreenX,
      dragSession.offsetY + pointerScreenY,
      dragSession.windowWidth,
      dragSession.windowHeight,
    );

    fairyWindow.setPosition(next.x, next.y, false);
  }

  function stopTimer() {
    if (dragTimer) {
      clearInterval(dragTimer);
      dragTimer = null;
    }
    dragLastCursor = null;
  }

  function startPollingDrag() {
    stopTimer();
    dragTimer = setInterval(() => {
      const win = getFairyWindow();
      if (!dragSession || !win || win.isDestroyed()) {
        stopTimer();
        return;
      }
      const cursor = screen.getCursorScreenPoint();

      if (dragLastCursor) {
        const deltaX = cursor.x - dragLastCursor.x;
        const deltaY = cursor.y - dragLastCursor.y;
        if (Math.abs(deltaX) < DRAG_JITTER_THRESHOLD_PX && Math.abs(deltaY) < DRAG_JITTER_THRESHOLD_PX) {
          return;
        }
      }

      updatePositionByCursor(cursor.x, cursor.y);
      dragLastCursor = { x: cursor.x, y: cursor.y };
    }, DRAG_POLL_INTERVAL_MS);
  }

  // ============ 公共接口 ============

  function beginDrag(event, payload) {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    const fairyWindow = getFairyWindow();
    if (!targetWindow || targetWindow !== fairyWindow || targetWindow.isDestroyed()) {
      return;
    }

    dragging = true;
    targetWindow.setIgnoreMouseEvents(false);
    targetWindow.moveTop();

    // native 方案：全物理像素坐标操作
    if (nativeApi) {
      try {
        const hwndBuf = targetWindow.getNativeWindowHandle();
        const hwndNumber = hwndBuf.readInt32LE(0);
        if (hwndNumber === 0) {
          throw new Error('getNativeWindowHandle 返回空句柄');
        }

        const init = nativeApi.beginDrag(hwndNumber);
        if (!init) {
          throw new Error('native beginDrag 返回空');
        }

        nativeSession = {
          hwnd: hwndNumber,
          startCursorX: init.cursorX,
          startCursorY: init.cursorY,
          startWindowX: init.windowX,
          startWindowY: init.windowY,
          windowWidth: init.width,
          windowHeight: init.height,
        };

        startNativePolling(hwndNumber);
        return;
      } catch (error) {
        console.warn('[fairyDragController] native 拖动失败，降级到 Electron 轮询:', error?.message || error);
        // 继续往下走，降级到 Electron 轮询方案
      }
    }

    // Electron 轮询 fallback：DIP 坐标系
    const cursorPoint = screen.getCursorScreenPoint();
    const bounds = targetWindow.getBounds();

    dragSession = {
      offsetX: bounds.x - cursorPoint.x,
      offsetY: bounds.y - cursorPoint.y,
      windowWidth: bounds.width,
      windowHeight: bounds.height,
    };

    dragLastCursor = { x: cursorPoint.x, y: cursorPoint.y };
    startPollingDrag();
  }

  function updateDrag(event, payload) {
    if (nativeApi) {
      return; // native 方案由 16ms 轮询驱动，忽略渲染进程 pointer 事件
    }

    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    const fairyWindow = getFairyWindow();
    if (!targetWindow || targetWindow !== fairyWindow || targetWindow.isDestroyed() || !dragSession) {
      return;
    }

    const pointerScreenX = Number(payload?.screenX);
    const pointerScreenY = Number(payload?.screenY);
    const cursorPoint = screen.getCursorScreenPoint();
    const finalX = Number.isFinite(pointerScreenX) ? pointerScreenX : cursorPoint.x;
    const finalY = Number.isFinite(pointerScreenY) ? pointerScreenY : cursorPoint.y;

    updatePositionByCursor(finalX, finalY);
  }

  function endDrag() {
    stopTimer();
    dragging = false;
    nativeSession = null;
    dragSession = null;
    const fairyWindow = getFairyWindow();
    if (fairyWindow && !fairyWindow.isDestroyed()) {
      fairyWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }

  function setMouseIgnore(event, ignore) {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    const fairyWindow = getFairyWindow();
    if (!targetWindow || targetWindow !== fairyWindow || targetWindow.isDestroyed()) {
      return;
    }

    if (dragging) {
      targetWindow.setIgnoreMouseEvents(false);
      return;
    }

    targetWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  }

  function setDragging(event, draggingValue) {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    const fairyWindow = getFairyWindow();
    if (!targetWindow || targetWindow !== fairyWindow || targetWindow.isDestroyed()) {
      return;
    }

    dragging = Boolean(draggingValue);
    targetWindow.setIgnoreMouseEvents(!dragging, { forward: !dragging });
  }

  function isDragging() {
    return dragging;
  }

  function isNativeDragEnabled() {
    return nativeApi !== null;
  }

  return {
    beginDrag,
    updateDrag,
    endDrag,
    setMouseIgnore,
    setDragging,
    stopTimer,
    isDragging,
    isNativeDragEnabled,
  };
}

module.exports = {
  FAIRY_WINDOW_WIDTH,
  FAIRY_WINDOW_HEIGHT,
  clampFairyPosition,
  createFairyDragController,
};
