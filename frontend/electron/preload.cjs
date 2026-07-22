const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopFairy', {
  // 窗口与精灵控制
  getWindowMode: () => ipcRenderer.invoke('app:get-window-mode'),
  getFairyPreferences: () => ipcRenderer.invoke('fairy:get-preferences'),
  resetFairyPosition: () => ipcRenderer.invoke('fairy:reset-position'),
  beginFairyDrag: (payload) => ipcRenderer.send('fairy:drag-begin', payload),
  updateFairyDrag: (payload) => ipcRenderer.send('fairy:drag-update', payload),
  endFairyDrag: () => ipcRenderer.send('fairy:drag-end'),
  setFairyMouseIgnore: (ignore) => ipcRenderer.send('fairy:set-mouse-ignore', !!ignore),
  setFairyDragging: (dragging) => ipcRenderer.send('fairy:set-dragging', !!dragging),
  setFairyEnabled: (enabled) => ipcRenderer.send('fairy:set-enabled', !!enabled),

  onForceDisableResidentChat: (callback) => {
    ipcRenderer.removeAllListeners('fairy:force-disable-resident-chat');
    ipcRenderer.on('fairy:force-disable-resident-chat', () => callback?.());
  },
  onEnableFairyFromTray: (callback) => {
    ipcRenderer.removeAllListeners('fairy:enable-from-tray');
    ipcRenderer.on('fairy:enable-from-tray', () => callback?.());
  },

  // 后端就绪通知：主进程在后端 health check 通过后发送
  onBackendReady: (callback) => {
    ipcRenderer.removeAllListeners('backend:ready');
    ipcRenderer.on('backend:ready', () => callback?.());
  },

  // 系统信息
  getFilePaths: () => ipcRenderer.invoke('system:get-file-paths'),
  readBackendLog: (lines) => ipcRenderer.invoke('system:read-backend-log', lines),

  // 最小化行为偏好
  getMinimizePrefs: () => ipcRenderer.invoke('window:get-minimize-prefs'),
  setMinimizePrefs: (prefs) => ipcRenderer.invoke('window:set-minimize-prefs', prefs),
  executeMinimize: (behavior) => ipcRenderer.invoke('window:execute-minimize', behavior),
  onAskMinimize: (callback) => {
    ipcRenderer.removeAllListeners('window:ask-minimize');
    ipcRenderer.on('window:ask-minimize', () => callback?.());
  },

  // 文件选择对话框（返回路径数组，支持多选）
  showOpenFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  // 截图捕获（options: { hideWindow?: boolean }，返回临时文件路径或 null）
  captureScreenshot: (options) => ipcRenderer.invoke('screenshot:capture', options),
  // 读取文件为 Data URL（用于图片预览）
  readFileAsDataUrl: (filePath) => ipcRenderer.invoke('file:read-as-data-url', filePath),
  // 读取文件为文本（用于文本文件预览）
  readFileAsText: (filePath) => ipcRenderer.invoke('file:read-as-text', filePath),
});

