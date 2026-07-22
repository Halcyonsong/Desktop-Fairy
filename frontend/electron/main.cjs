const { app, BrowserWindow, Menu, Tray, dialog, desktopCapturer, ipcMain, nativeImage, screen, session } = require('electron');
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
let backendReady = false;
let mainWindow = null;
let fairyWindow = null;
let tray = null;
let isQuitting = false;
let fairyWindowEnabled = false;
let mainWindowHiddenToTray = false;

// 最小化行为偏好
// minimizeBehavior: 'taskbar' | 'tray'，默认 'taskbar'
// minimizeAskAgain: 是否每次最小化时弹窗询问，默认 true
// isExecutingMinimize: 标记正在执行用户选择的最小化操作，避免 minimize 事件再次拦截
let minimizeBehavior = 'taskbar';
let minimizeAskAgain = true;
let isExecutingMinimize = false;

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

function resolveIconPath(filename) {
  // 开发模式：frontend/build/<filename>
  // 打包模式：app.asar/build/<filename>（electron-builder files 配置包含 build/**/*）
  // 两种情况下 __dirname 都是 electron/ 目录，所以相对路径一致
  return path.join(__dirname, '..', 'build', filename);
}

function loadIconFromFile(filename) {
  const iconPath = resolveIconPath(filename);
  if (!fs.existsSync(iconPath)) {
    // 兜底：图标文件缺失时返回空图像，避免 Tray/BrowserWindow 构造抛错
    return nativeImage.createEmpty();
  }
  return nativeImage.createFromPath(iconPath);
}

function loadAppIcon() {
  // 应用主图标：.exe、任务栏、BrowserWindow（白底圆角矩形版）
  return loadIconFromFile('icon.ico');
}

function loadTrayIcon() {
  // 托盘图标：系统托盘通知区域（透明背景版）
  return loadIconFromFile('tray.ico');
}

function createTrayImage() {
  return loadTrayIcon();
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
  const obj = raw && typeof raw === 'object' ? raw : {};
  // 同步到模块级变量
  minimizeBehavior = obj.minimizeBehavior === 'tray' ? 'tray' : 'taskbar';
  minimizeAskAgain = obj.minimizeAskAgain !== false; // 默认 true
  return {
    enabled: Boolean(obj.enabled),
    minimizeBehavior,
    minimizeAskAgain,
  };
}

function persistFairyPreferences() {
  try {
    const preferencesPath = getFairyPreferencesFilePath();
    ensureParentDir(preferencesPath);
    fs.writeFileSync(
      preferencesPath,
      JSON.stringify(
        {
          enabled: fairyWindowEnabled,
          minimizeBehavior,
          minimizeAskAgain,
        },
        null,
        2,
      ),
      'utf8',
    );
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
    request.setTimeout(1000, () => {
      request.destroy(new Error('Backend health check timed out'));
    });
  });
}

async function waitForBackendReady(timeoutMs = 30000, intervalMs = 300) {
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

  // 不再 await：后台轮询后端就绪状态，ready 后通过 IPC 通知前端
  // 这样窗口可以立即创建显示，用户不用等待后端启动
  waitForBackendReady()
    .then(() => {
      backendReady = true;
      // 通知所有窗口的后端已就绪
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('backend:ready');
        }
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      dialog.showErrorBox('Backend startup failed', `Desktop Fairy backend failed to start within 30 seconds.\n${message}`);
      app.quit();
    });
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
    icon: loadAppIcon(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('minimize', () => {
    if (isQuitting || isExecutingMinimize) {
      return;
    }

    // 注意：Electron 的 minimize 事件不支持 event.preventDefault()，
    // 窗口已经最小化。不能同步调用 restore()/hide()，否则会导致
    // GPU 合成器状态混乱出现白屏。必须延迟到下一个事件循环执行。

    // 需要询问：延迟恢复窗口以显示弹窗
    if (minimizeAskAgain) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !isQuitting && !isExecutingMinimize) {
          mainWindow.restore();
          mainWindow.focus();
          mainWindow.webContents.send('window:ask-minimize');
        }
      }, 100);
      return;
    }

    // 不再询问：按已保存的偏好执行
    if (minimizeBehavior === 'tray') {
      // 延迟隐藏到托盘，避免与 minimize 操作冲突
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !isQuitting) {
          hideMainWindow();
        }
      }, 100);
    }
    // behavior === 'taskbar'：窗口已经最小化到任务栏，不做处理
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
    icon: loadAppIcon(),
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
    minimizeBehavior,
    minimizeAskAgain,
  }));

  // ===== 最小化行为偏好 =====
  ipcMain.handle('window:get-minimize-prefs', () => ({
    behavior: minimizeBehavior,
    askAgain: minimizeAskAgain,
  }));

  ipcMain.handle('window:set-minimize-prefs', (event, prefs) => {
    if (prefs && typeof prefs === 'object') {
      if (prefs.behavior === 'tray' || prefs.behavior === 'taskbar') {
        minimizeBehavior = prefs.behavior;
      }
      if (typeof prefs.askAgain === 'boolean') {
        minimizeAskAgain = prefs.askAgain;
      }
      persistFairyPreferences();
    }
    return { behavior: minimizeBehavior, askAgain: minimizeAskAgain };
  });

  // 执行实际最小化操作（前端弹窗选择后调用）
  ipcMain.handle('window:execute-minimize', (event, behavior) => {
    // 设置标志，避免 minimize 事件再次拦截
    isExecutingMinimize = true;
    if (behavior === 'tray') {
      hideMainWindow();
    } else {
      // taskbar：直接最小化到任务栏
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize();
      }
    }
    // 在下一个事件循环重置标志，确保 minimize 事件已被跳过
    setImmediate(() => {
      isExecutingMinimize = false;
    });
  });

  // ===== 文件选择对话框（支持多选） =====
  ipcMain.handle('dialog:open-file', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      title: '选择文件',
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths;  // 返回路径数组
  });

  // ===== 截图区域选择捕获 =====
  let screenshotOverlayWindow = null;

  ipcMain.handle('screenshot:capture', async (event, options) => {
    const path = require('path');
    const fs = require('fs');
    const hideWindow = options && options.hideWindow;

    // 如果需要隐藏窗口，先隐藏主窗口并等待渲染完成
    if (hideWindow && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
      // 等待窗口完全隐藏后再截图
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // 获取主屏幕尺寸
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.size;

    // 先捕获全屏画面
    let fullImageBuffer;
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: screenWidth, height: screenHeight },
      });
      if (!sources || sources.length === 0) return null;
      fullImageBuffer = sources[0].thumbnail.toPNG();
    } catch (err) {
      console.error('[Screenshot] Capturer failed:', err);
      return null;
    }

    // 创建透明覆盖窗口让用户选择区域
    return new Promise((resolve) => {
      screenshotOverlayWindow = new BrowserWindow({
        width: screenWidth,
        height: screenHeight,
        x: 0,
        y: 0,
        fullscreen: true,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
          preload: path.join(__dirname, 'screenshot-preload.cjs'),
          contextIsolation: true,
        },
      });

      screenshotOverlayWindow.loadFile(path.join(__dirname, 'screenshot-overlay.html'));

      let resolved = false;

      function cleanup() {
        if (screenshotOverlayWindow && !screenshotOverlayWindow.isDestroyed()) {
          screenshotOverlayWindow.close();
          screenshotOverlayWindow = null;
        }
      }

      function resolveOnce(value) {
        if (resolved) return;
        resolved = true;
        cleanup();
        // 截图完成后恢复主窗口
        if (hideWindow && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
        resolve(value);
      }

      // 用户选择区域后裁剪
      ipcMain.once('screenshot:select', async (event, rect) => {
        try {
          // 获取物理像素坐标（处理 DPI 缩放）
          const scaleFactor = primaryDisplay.scaleFactor || 1;
          const cropRect = {
            x: Math.round(rect.x * scaleFactor),
            y: Math.round(rect.y * scaleFactor),
            width: Math.round(rect.width * scaleFactor),
            height: Math.round(rect.height * scaleFactor),
          };

          const fullImage = nativeImage.createFromBuffer(fullImageBuffer);
          const croppedImage = fullImage.crop(cropRect);
          const croppedBuffer = croppedImage.toPNG();

          // 保存到临时目录
          const tempDir = path.join(app.getPath('temp'), 'desktop-fairy-screenshots');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const fileName = `screenshot-${timestamp}.png`;
          const filePath = path.join(tempDir, fileName);
          fs.writeFileSync(filePath, croppedBuffer);

          resolveOnce(filePath);
        } catch (err) {
          console.error('[Screenshot] Crop failed:', err);
          resolveOnce(null);
        }
      });

      // 用户取消
      ipcMain.once('screenshot:cancel', () => {
        resolveOnce(null);
      });

      // 窗口失焦也取消
      screenshotOverlayWindow.on('blur', () => {
        resolveOnce(null);
      });

      // 超时自动取消（30秒）
      setTimeout(() => resolveOnce(null), 30000);
    });
  });

  // ===== 文件预览读取 =====
  ipcMain.handle('file:read-as-data-url', async (event, filePath) => {
    const fs = require('fs');
    const path = require('path');
    try {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mimeMap = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif',
      };
      const mime = mimeMap[ext] || 'application/octet-stream';
      const base64 = buffer.toString('base64');
      return `data:${mime};base64,${base64}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle('file:read-as-text', async (event, filePath) => {
    const fs = require('fs');
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // 限制 50000 字符避免卡浏览器
      if (content.length > 50000) {
        return content.slice(0, 50000) + '\n\n[文件内容已截断，仅显示前 50000 字符]';
      }
      return content;
    } catch {
      return null;
    }
  });

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
    // 先创建窗口和托盘，用户立即看到界面
    // 后端在后台启动，ready 后通过 IPC 通知前端
    createWindows();
    createTray();
    // 如果后端已经 ready（例如热重载场景），立即通知前端
    if (backendReady) {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('backend:ready');
        }
      }
    }
    // 启动后端（异步，不阻塞窗口显示）
    startBackend();
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
