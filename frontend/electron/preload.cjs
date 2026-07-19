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

  // 系统信息
  getFilePaths: () => ipcRenderer.invoke('system:get-file-paths'),
  readBackendLog: (lines) => ipcRenderer.invoke('system:read-backend-log', lines),
});

