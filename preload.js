const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('djStudioLauncher', Object.freeze({ available: () => ipcRenderer.invoke('djstudio:apps-available'), open: id => ipcRenderer.invoke('djstudio:open-app', id), preview: id => ipcRenderer.invoke('djstudio:app-preview', id) }));

contextBridge.exposeInMainWorld('djStudioDisplays', Object.freeze({
  list: () => ipcRenderer.invoke('djstudio:displays:list'),
  place: (displayId, fullScreen) => ipcRenderer.invoke('djstudio:displays:place', { displayId, fullScreen: Boolean(fullScreen) }),
  restore: () => ipcRenderer.invoke('djstudio:displays:restore')
}));

contextBridge.exposeInMainWorld('djStudioSettings', Object.freeze({
  getFullscreen: () => ipcRenderer.invoke('djstudio:fullscreen:get'),
  setFullscreen: enabled => ipcRenderer.invoke('djstudio:fullscreen:set', Boolean(enabled))
}));

contextBridge.exposeInMainWorld('djStudioUpdates', Object.freeze({
  version: () => ipcRenderer.invoke('djstudio:update:version'),
  check: () => ipcRenderer.invoke('djstudio:update:check'),
  state: () => ipcRenderer.invoke('djstudio:update:state'),
  install: () => ipcRenderer.invoke('djstudio:update:install'),
  onState: callback => { if (typeof callback !== 'function') return () => {}; const listener = (_event, data) => callback(data); ipcRenderer.on('djstudio:update:state', listener); return () => ipcRenderer.removeListener('djstudio:update:state', listener); }
}));
