const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenshotOverlay', {
  onCancel: () => ipcRenderer.send('screenshot:cancel'),
  onSelect: (rect) => ipcRenderer.send('screenshot:select', rect),
});
