const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('djStudioSplash', Object.freeze({
  onProgress: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('djstudio:splash:progress', listener);
    return () => ipcRenderer.removeListener('djstudio:splash:progress', listener);
  }
}));
