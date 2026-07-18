const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BACKEND_HEALTH_URL = 'http://127.0.0.1:18765/api/health';
const FRONTEND_DEV_URL = 'http://127.0.0.1:5173';
const WORKBENCH_WINDOW_MODE = 'workbench';
const FAIRY_WINDOW_MODE = 'fairy';
const FAIRY_WINDOW_WIDTH = 520;
const FAIRY_WINDOW_HEIGHT = 620;

let backendProcess = null;
let mainWindow = null;
let fairyWindow = null;
let tray = null;
let isQuitting = false;
let fairyDragSession = null;
let fairyDragging = false;
let fairyWindowEnabled = false;
let fairyDragTimer = null;
let fairyDragLastCursor = null;

function isDevMode() {
  return !app.isPackaged;
}

function resolveProjectRoot() {
  return path.resolve(__dirname, '..', '..');
}

function resolveResourcesRoot(projectRoot) {
  if (isDevMode()) {
    return projectRoot;
  }
  return process.resourcesPath;
}

function resolveJavaExecutable(resourcesRoot) {
  const bundledJavaPath = path.join(resourcesRoot, 'runtime', 'jre', 'bin', 'java.exe');
  if (fs.existsSync(bundledJavaPath)) {
    return bundledJavaPath;
  }

  return 'java';
}

function resolveBackendJarPath(resourcesRoot) {
  if (isDevMode()) {
    const targetDir = path.join(resourcesRoot, 'target');
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Backend target directory not found: ${targetDir}`);
    }

    const jarFile = fs
      .readdirSync(targetDir)
      .filter((name) => name.endsWith('.jar'))
      .filter((name) => !name.endsWith('.jar.original'))
      .filter((name) => !name.includes('sources'))
      .filter((name) => !name.includes('javadoc'))
      .sort((a, b) => b.localeCompare(a))[0];

    if (!jarFile) {
      throw new Error(`No runnable backend jar found in: ${targetDir}`);
    }

    return path.join(targetDir, jarFile);
  }

  const packagedJarPath = path.join(resourcesRoot, 'backend', 'Desktop-Fairy.jar');
  if (!fs.existsSync(packagedJarPath)) {
    throw new Error(`Packaged backend jar not found: ${packagedJarPath}`);
  }
  return packagedJarPath;
}

function resolveFrontendEntry(windowMode) {
  if (isDevMode()) {
    return { type: 'url', value: `${FRONTEND_DEV_URL}/?windowMode=${windowMode}` };
  }

  const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (!fs.existsSync(distIndexPath)) {
    throw new Error(`Packaged frontend dist entry not found: ${distIndexPath}`);
  }

  return {
    type: 'file',
    value: distIndexPath,
    query: { windowMode },
  };
}

function createTrayImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#8db3ff"/>
          <stop offset="100%" stop-color="#5b7cff"/>
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#g)"/>
      <path d="M16 7.5l2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8z" fill="#ffffff"/>
    </svg>
  `;

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`);
}

function getFairyStateFilePath() {
  return path.join(app.getPath('userData'), 'fairy-window-state.json');
}

function getFairyPreferencesFilePath() {
  return path.join(app.getPath('userData'), 'fairy-preferences.json');
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getDefaultFairyBounds() {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  return {
    width: FAIRY_WINDOW_WIDTH,
    height: FAIRY_WINDOW_HEIGHT,
    x: Math.round(workArea.x + workArea.width - FAIRY_WINDOW_WIDTH - 24),
    y: Math.round(workArea.y + workArea.height - FAIRY_WINDOW_HEIGHT - 24),
  };
}

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

function normalizeFairyBounds(candidate) {
  const fallback = getDefaultFairyBounds();
  if (!candidate || typeof candidate !== 'object') {
    return fallback;
  }

  const x = Number(candidate.x);
  const y = Number(candidate.y);
  const nextPosition = clampFairyPosition(
    Number.isFinite(x) ? x : fallback.x,
    Number.isFinite(y) ? y : fallback.y,
    FAIRY_WINDOW_WIDTH,
    FAIRY_WINDOW_HEIGHT,
  );

  return {
    width: FAIRY_WINDOW_WIDTH,
    height: FAIRY_WINDOW_HEIGHT,
    x: nextPosition.x,
    y: nextPosition.y,
  };
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readFairyBounds() {
  return normalizeFairyBounds(readJsonFile(getFairyStateFilePath(), null));
}

function persistFairyBounds() {
  if (!fairyWindow || fairyWindow.isDestroyed()) {
    return;
  }

  try {
    const statePath = getFairyStateFilePath();
    const normalizedBounds = normalizeFairyBounds(fairyWindow.getBounds());
    ensureParentDir(statePath);
    fs.writeFileSync(statePath, JSON.stringify(normalizedBounds, null, 2), 'utf8');
  } catch {
    // ignore persistence failures
  }
}

function readFairyPreferences() {
  const raw = readJsonFile(getFairyPreferencesFilePath(), {});
  return {
    enabled: Boolean(raw && typeof raw === 'object' ? raw.enabled : false),
  };
}

function persistFairyPreferences() {
  try {
    const preferencesPath = getFairyPreferencesFilePath();
    ensureParentDir(preferencesPath);
    fs.writeFileSync(preferencesPath, JSON.stringify({ enabled: fairyWindowEnabled }, null, 2), 'utf8');
  } catch {
    // ignore persistence failures
  }
}

function resetFairyBounds() {
  const nextBounds = getDefaultFairyBounds();

  try {
    const statePath = getFairyStateFilePath();
    ensureParentDir(statePath);
    fs.writeFileSync(statePath, JSON.stringify(nextBounds, null, 2), 'utf8');
  } catch {
    // ignore persistence failures
  }

  if (fairyWindow && !fairyWindow.isDestroyed()) {
    fairyWindow.setBounds(nextBounds, false);
  }

  return nextBounds;
}

function checkBackendHealth() {
  return new Promise((resolve, reject) => {
    const request = http.get(BACKEND_HEALTH_URL, (response) => {
      response.resume();
      if (response.statusCode === 200) {
        resolve(true);
        return;
      }
      reject(new Error(`Backend health check failed with status ${response.statusCode}`));
    });

    request.on('error', reject);
    request.setTimeout(3000, () => {
      request.destroy(new Error('Backend health check timed out'));
    });
  });
}

async function waitForBackendReady(timeoutMs = 30000, intervalMs = 1000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      await checkBackendHealth();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw lastError || new Error('Backend did not become ready in time');
}

async function startBackend() {
  const projectRoot = resolveProjectRoot();
  const resourcesRoot = resolveResourcesRoot(projectRoot);
  const javaExecutable = resolveJavaExecutable(resourcesRoot);
  const backendJarPath = resolveBackendJarPath(resourcesRoot);

  backendProcess = spawn(javaExecutable, ['-jar', backendJarPath], {
    cwd: resourcesRoot,
    windowsHide: true,
    stdio: 'ignore',
  });

  backendProcess.once('exit', (code, signal) => {
    backendProcess = null;
    if (!isQuitting) {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      dialog.showErrorBox('Backend stopped', `Desktop Fairy backend exited unexpectedly (${reason}).`);
      app.quit();
    }
  });

  await waitForBackendReady();
}

function loadWindowEntry(targetWindow, windowMode) {
  const frontendEntry = resolveFrontendEntry(windowMode);
  targetWindow.__windowMode = windowMode;

  if (frontendEntry.type === 'url') {
    targetWindow.loadURL(frontendEntry.value);
    return;
  }

  targetWindow.loadFile(frontendEntry.value, {
    query: frontendEntry.query,
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.hide();
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
    showMainWindow();
    return;
  }

  hideMainWindow();
}

function showFairyWindow() {
  if (!fairyWindowEnabled) {
    return;
  }

  if (!fairyWindow || fairyWindow.isDestroyed()) {
    createFairyWindow();
    return;
  }

  fairyWindow.showInactive();
  fairyWindow.moveTop();
  fairyWindow.setIgnoreMouseEvents(!fairyDragging, { forward: true });
}

function hideFairyWindow() {
  if (!fairyWindow || fairyWindow.isDestroyed()) {
    return;
  }

  fairyWindow.hide();
}

function applyFairyWindowEnabled(enabled) {
  fairyWindowEnabled = Boolean(enabled);
  persistFairyPreferences();

  if (!fairyWindow || fairyWindow.isDestroyed()) {
    return;
  }

  if (fairyWindowEnabled) {
    showFairyWindow();
    return;
  }

  hideFairyWindow();
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(createTrayImage());
  tray.setToolTip('Desktop Fairy');

  const refreshMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() ? '隐藏工作台' : '打开工作台',
        click: () => toggleMainWindow(),
      },
      {
        label: fairyWindowEnabled ? '显示桌面精灵' : '桌面精灵已关闭',
        enabled: fairyWindowEnabled,
        click: () => showFairyWindow(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ]);

    tray.setContextMenu(contextMenu);
  };

  tray.on('click', () => {
    toggleMainWindow();
    refreshMenu();
  });

  tray.on('right-click', refreshMenu);
  refreshMenu();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('minimize', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    hideMainWindow();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    hideMainWindow();
  });

  mainWindow.on('show', () => {
    tray?.setToolTip('Desktop Fairy');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  loadWindowEntry(mainWindow, WORKBENCH_WINDOW_MODE);
}

function createFairyWindow() {
  const bounds = readFairyBounds();

  fairyWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  fairyWindow.setAlwaysOnTop(true, 'screen-saver');
  fairyWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  fairyWindow.once('ready-to-show', () => {
    fairyWindow.setIgnoreMouseEvents(true, { forward: true });
    if (fairyWindowEnabled) {
      fairyWindow.showInactive();
    }
  });

  fairyWindow.on('moved', persistFairyBounds);
  fairyWindow.on('closed', () => {
    stopFairyDragTimer();
    fairyDragSession = null;
    fairyWindow = null;
  });

  loadWindowEntry(fairyWindow, FAIRY_WINDOW_MODE);
}

function createWindows() {
  createMainWindow();
  createFairyWindow();
}

function updateFairyDragPosition(pointerScreenX, pointerScreenY) {
  if (!fairyDragSession || !fairyWindow || fairyWindow.isDestroyed()) {
    return;
  }

  // 使用偏移量方式：新窗口位置 = 当前光标位置 + (初始窗口位置 - 初始光标位置)
  // 这种方式即使在 getCursorScreenPoint() 和 getBounds() 坐标系不一致（DPI 缩放）时，
  // 由于 offset = bounds(DIP) - cursor(可能物理) 的混合值在后续 cursor + offset 中被抵消，
  // 仍能计算出正确的窗口位置
  const next = clampFairyPosition(
    fairyDragSession.offsetX + pointerScreenX,
    fairyDragSession.offsetY + pointerScreenY,
    fairyDragSession.windowWidth,
    fairyDragSession.windowHeight,
  );

  fairyWindow.setPosition(next.x, next.y, false);
}

function stopFairyDragTimer() {
  if (fairyDragTimer) {
    clearInterval(fairyDragTimer);
    fairyDragTimer = null;
  }
  fairyDragLastCursor = null;
}

function beginFairyDrag(event, payload) {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (!targetWindow || targetWindow !== fairyWindow || targetWindow.isDestroyed()) {
    return;
  }

  // 统一使用主进程的光标坐标和窗口边界，计算偏移量
  const cursorPoint = screen.getCursorScreenPoint();
  const bounds = targetWindow.getBounds();

  // offset = 窗口位置 - 光标位置
  // 后续 newPosition = cursor + offset = cursor + (window - cursorAtBegin)
  // 即使坐标系不一致，offset 的"抵消"效应确保结果正确
  fairyDragSession = {
    offsetX: bounds.x - cursorPoint.x,
    offsetY: bounds.y - cursorPoint.y,
    windowWidth: bounds.width,
    windowHeight: bounds.height,
  };

  fairyDragLastCursor = { x: cursorPoint.x, y: cursorPoint.y };

  targetWindow.setIgnoreMouseEvents(false);
  targetWindow.moveTop();

  // 启动光标轮询定时器，在渲染端 pointer 事件丢失时仍能平滑拖拽
  stopFairyDragTimer();
  fairyDragTimer = setInterval(() => {
    if (!fairyDragSession || !fairyWindow || fairyWindow.isDestroyed()) {
      stopFairyDragTimer();
      return;
    }
    const cursor = screen.getCursorScreenPoint();

    // 抖动抑制：鼠标增量小于 1 像素时不移动窗口，避免 getCursorScreenPoint 微小波动导致抖动
    if (fairyDragLastCursor) {
      const deltaX = cursor.x - fairyDragLastCursor.x;
      const deltaY = cursor.y - fairyDragLastCursor.y;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }
    }

    updateFairyDragPosition(cursor.x, cursor.y);
    fairyDragLastCursor = { x: cursor.x, y: cursor.y };
  }, 16);
}

function updateFairyDrag(event, payload) {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (!targetWindow || targetWindow !== fairyWindow || targetWindow.isDestroyed() || !fairyDragSession) {
    return;
  }

  const pointerScreenX = Number(payload?.screenX);
  const pointerScreenY = Number(payload?.screenY);
  // 渲染端传来的坐标无效时，使用主进程光标位置作为兜底
  const cursorPoint = screen.getCursorScreenPoint();
  const finalX = Number.isFinite(pointerScreenX) ? pointerScreenX : cursorPoint.x;
  const finalY = Number.isFinite(pointerScreenY) ? pointerScreenY : cursorPoint.y;

  updateFairyDragPosition(finalX, finalY);
}

function endFairyDrag() {
  stopFairyDragTimer();
  fairyDragging = false;
  fairyDragSession = null;
  if (fairyWindow && !fairyWindow.isDestroyed()) {
    fairyWindow.setIgnoreMouseEvents(true, { forward: true });
  }
  persistFairyBounds();
}

function setFairyMouseIgnore(event, ignore) {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (!targetWindow || targetWindow !== fairyWindow || targetWindow.isDestroyed()) {
    return;
  }

  if (fairyDragging) {
    targetWindow.setIgnoreMouseEvents(false);
    return;
  }

  targetWindow.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
}

function setFairyDragging(event, dragging) {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (!targetWindow || targetWindow !== fairyWindow || targetWindow.isDestroyed()) {
    return;
  }

  fairyDragging = Boolean(dragging);
  targetWindow.setIgnoreMouseEvents(!fairyDragging, { forward: !fairyDragging });
}

function setFairyEnabled(event, enabled) {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  applyFairyWindowEnabled(enabled);
}

function registerIpc() {
  ipcMain.handle('app:get-window-mode', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    return targetWindow?.__windowMode || WORKBENCH_WINDOW_MODE;
  });

  ipcMain.handle('fairy:get-preferences', () => ({
    enabled: fairyWindowEnabled,
  }));

  ipcMain.handle('fairy:reset-position', () => resetFairyBounds());

  ipcMain.on('fairy:drag-begin', beginFairyDrag);
  ipcMain.on('fairy:drag-update', updateFairyDrag);
  ipcMain.on('fairy:drag-end', endFairyDrag);
  ipcMain.on('fairy:set-mouse-ignore', setFairyMouseIgnore);
  ipcMain.on('fairy:set-dragging', setFairyDragging);
  ipcMain.on('fairy:set-enabled', setFairyEnabled);
}

async function bootstrap() {
  try {
    fairyWindowEnabled = readFairyPreferences().enabled;
    registerIpc();
    await startBackend();
    createWindows();
    createTray();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox('Desktop Fairy startup failed', message);
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on('before-quit', () => {
  isQuitting = true;
  stopFairyDragTimer();
  persistFairyBounds();
  persistFairyPreferences();
  tray?.destroy();
  tray = null;
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    return;
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  showMainWindow();
  if (fairyWindowEnabled) {
    showFairyWindow();
  }
});
