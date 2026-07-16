const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BACKEND_HEALTH_URL = 'http://127.0.0.1:18765/api/health';
const FRONTEND_DEV_URL = 'http://127.0.0.1:5173';

let backendProcess = null;
let mainWindow = null;

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

function resolveFrontendEntry() {
  if (isDevMode()) {
    return { type: 'url', value: FRONTEND_DEV_URL };
  }

  const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (!fs.existsSync(distIndexPath)) {
    throw new Error(`Packaged frontend dist entry not found: ${distIndexPath}`);
  }
  return { type: 'file', value: distIndexPath };
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
    stdio: 'ignore'
  });

  backendProcess.once('exit', (code, signal) => {
    backendProcess = null;
    if (!app.isQuitting) {
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      dialog.showErrorBox('Backend stopped', `Desktop Fairy backend exited unexpectedly (${reason}).`);
      app.quit();
    }
  });

  await waitForBackendReady();
}

function createWindow() {
  const frontendEntry = resolveFrontendEntry();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (frontendEntry.type === 'url') {
    mainWindow.loadURL(frontendEntry.value);
  } else {
    mainWindow.loadFile(frontendEntry.value);
  }
}

async function bootstrap() {
  try {
    await startBackend();
    createWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox('Desktop Fairy startup failed', message);
    app.quit();
  }
}

app.isQuitting = false;

app.whenReady().then(bootstrap);

app.on('before-quit', () => {
  app.isQuitting = true;
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
