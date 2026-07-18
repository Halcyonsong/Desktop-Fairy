const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopFairy', {
  getWindowMode: () => ipcRenderer.invoke('app:get-window-mode'),
  getFairyPreferences: () => ipcRenderer.invoke('fairy:get-preferences'),
  resetFairyPosition: () => ipcRenderer.invoke('fairy:reset-position'),
  beginFairyDrag: (payload) => ipcRenderer.send('fairy:drag-begin', payload),
  updateFairyDrag: (payload) => ipcRenderer.send('fairy:drag-update', payload),
  endFairyDrag: () => ipcRenderer.send('fairy:drag-end'),
  setFairyMouseIgnore: (ignore) => ipcRenderer.send('fairy:set-mouse-ignore', !!ignore),
  setFairyDragging: (dragging) => ipcRenderer.send('fairy:set-dragging', !!dragging),
  setFairyEnabled: (enabled) => ipcRenderer.send('fairy:set-enabled', !!enabled),
});
