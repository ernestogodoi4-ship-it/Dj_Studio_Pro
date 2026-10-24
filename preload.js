const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('djStudioLauncher', Object.freeze({ available: () => ipcRenderer.invoke('djstudio:apps-available'), open: id => ipcRenderer.invoke('djstudio:open-app', id) }));

contextBridge.exposeInMainWorld('djStudioUpdates', Object.freeze({
  version: () => ipcRenderer.invoke('djstudio:update:version'),
  check: () => ipcRenderer.invoke('djstudio:update:check'),
  state: () => ipcRenderer.invoke('djstudio:update:state'),
  install: () => ipcRenderer.invoke('djstudio:update:install'),
  onState: callback => { if (typeof callback !== 'function') return () => {}; const listener = (_event, data) => callback(data); ipcRenderer.on('djstudio:update:state', listener); return () => ipcRenderer.removeListener('djstudio:update:state', listener); }
}));
