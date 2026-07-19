const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen, session } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const {
  FAIRY_WINDOW_WIDTH,
  FAIRY_WINDOW_HEIGHT,
  clampFairyPosition,
  createFairyDragController,
} = require('./fairyDragController.cjs');

const BACKEND_HEALTH_URL = 'http://127.0.0.1:18765/api/health';
const FRONTEND_DEV_URL = 'http://127.0.0.1:5173';
const WORKBENCH_WINDOW_MODE = 'workbench';
const FAIRY_WINDOW_MODE = 'fairy';

let backendProcess = null;
let mainWindow = null;
let fairyWindow = null;
let tray = null;
let isQuitting = false;
let fairyWindowEnabled = false;
let mainWindowHiddenToTray = false;

// 桌面精灵拖动控制器，在 createFairyWindow 后初始化
let fairyDragController = null;

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

  mainWindowHiddenToTray = false;
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindowHiddenToTray = true;
  mainWindow.hide();
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindowHiddenToTray) {
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
  const isDragging = fairyDragController?.isDragging() ?? false;
  fairyWindow.setIgnoreMouseEvents(!isDragging, { forward: true });
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
        label: mainWindow && !mainWindow.isDestroyed() && !mainWindowHiddenToTray ? '隐藏工作台' : '显示工作台',
        click: () => toggleMainWindow(),
      },
      {
        label: fairyWindowEnabled ? '关闭精灵（同时关闭自动闲聊）' : '显示精灵',
        click: () => {
          if (fairyWindowEnabled) {
            fairyWindowEnabled = false;
            persistFairyPreferences();
            hideFairyWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('fairy:force-disable-resident-chat');
            }
          } else {
            applyFairyWindowEnabled(true);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('fairy:enable-from-tray');
            }
          }
          refreshMenu();
        },
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
    fairyDragController?.stopTimer();
    fairyWindow = null;
  });

  // 窗口创建后初始化拖动控制器
  fairyDragController = createFairyDragController(() => fairyWindow);

  loadWindowEntry(fairyWindow, FAIRY_WINDOW_MODE);
}

function createWindows() {
  createMainWindow();
  createFairyWindow();
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

  // 拖动相关 IPC 委托给控制器；控制器在 createFairyWindow 后初始化，
  // 若窗口尚未创建（极端时序），事件被忽略，等下次拖动时再处理
  ipcMain.on('fairy:drag-begin', (event, payload) => fairyDragController?.beginDrag(event, payload));
  ipcMain.on('fairy:drag-update', (event, payload) => fairyDragController?.updateDrag(event, payload));
  ipcMain.on('fairy:drag-end', () => {
    if (fairyDragController) {
      fairyDragController.endDrag();
    }
    persistFairyBounds();
  });
  ipcMain.on('fairy:set-mouse-ignore', (event, ignore) => fairyDragController?.setMouseIgnore(event, ignore));
  ipcMain.on('fairy:set-dragging', (event, dragging) => fairyDragController?.setDragging(event, dragging));
  ipcMain.on('fairy:set-enabled', setFairyEnabled);

  // ===== 系统：文件路径与日志读取 =====
  // 返回所有应用数据存储路径，供设置页"文件路径"栏目展示
  ipcMain.handle('system:get-file-paths', () => {
    const home = app.getPath('home');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return {
      home,
      localAppData,
      userData: app.getPath('userData'),
      paths: [
        {
          key: 'database',
          label: '主数据库',
          path: path.join(localAppData, 'DesktopFairy', 'data', 'fairy.db'),
          description: '存储会话、消息、设置等核心数据（SQLite）',
        },
        {
          key: 'backendLog',
          label: '后端日志',
          path: path.join(localAppData, 'DesktopFairy', 'logs', 'desktop-fairy.log'),
          description: 'Spring Boot 后端运行日志',
        },
        {
          key: 'frontendLog',
          label: '前端日志',
          path: '(浏览器 IndexedDB: vosk-models)',
          description: '前端运行日志，保存在浏览器内存中，最多 2000 条',
        },
        {
          key: 'voskModel',
          label: '语音识别模型缓存',
          path: '(浏览器 IndexedDB: vosk-models)',
          description: 'Vosk 中文小模型 tar.gz 包，从 ModelScope 下载后缓存',
        },
        {
          key: 'fairyWindowState',
          label: '精灵窗口状态',
          path: path.join(app.getPath('userData'), 'fairy-window-state.json'),
          description: '桌面精灵窗口位置、大小等状态',
        },
        {
          key: 'fairyPreferences',
          label: '精灵偏好设置',
          path: path.join(app.getPath('userData'), 'fairy-preferences.json'),
          description: '桌面精灵启用状态等偏好',
        },
        {
          key: 'electronUserData',
          label: 'Electron 用户数据',
          path: app.getPath('userData'),
          description: 'Electron 应用数据目录（缓存、配置等）',
        },
      ],
    };
  });

  // 读取后端日志文件尾部 N 行
  ipcMain.handle('system:read-backend-log', (event, lines) => {
    const home = app.getPath('home');
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const logPath = path.join(localAppData, 'DesktopFairy', 'logs', 'desktop-fairy.log');
    const maxLines = Math.min(Math.max(lines || 500, 50), 5000);

    try {
      if (!fs.existsSync(logPath)) {
        return {
          path: logPath,
          content: '',
          exists: false,
          message: '日志文件不存在',
        };
      }

      const stats = fs.statSync(logPath);
      const fileSize = stats.size;
      // 最多读取最后 2MB，避免大文件读取
      const readSize = Math.min(fileSize, 2 * 1024 * 1024);
      const buffer = Buffer.alloc(readSize);

      const fd = fs.openSync(logPath, 'r');
      fs.readSync(fd, buffer, 0, readSize, fileSize - readSize);
      fs.closeSync(fd);

      let content = buffer.toString('utf8');
      // 如果不是从文件开头读取，丢弃第一行（可能不完整）
      if (readSize < fileSize) {
        const firstNewline = content.indexOf('\n');
        if (firstNewline >= 0) {
          content = content.slice(firstNewline + 1);
        }
      }

      // 只保留最后 N 行
      const allLines = content.split('\n');
      const tailLines = allLines.slice(-maxLines).join('\n');

      return {
        path: logPath,
        content: tailLines,
        exists: true,
        fileSize,
        lines: allLines.length,
      };
    } catch (err) {
      return {
        path: logPath,
        content: '',
        exists: false,
        message: `读取失败: ${err.message}`,
      };
    }
  });
}

async function bootstrap() {
  try {
    // 设置权限处理器：允许麦克风权限（用于 Web Speech API 语音输入）
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(true);
      }
    });

    // 允许 media 权限检查
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      if (permission === 'media') {
        return true;
      }
      return true;
    });

    const preferences = readFairyPreferences();
    fairyWindowEnabled = preferences.enabled;
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
  fairyDragController?.stopTimer();
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
