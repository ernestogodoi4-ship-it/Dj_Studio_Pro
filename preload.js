const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('djStudioLauncher', Object.freeze({ available: () => ipcRenderer.invoke('djstudio:apps-available'), open: id => ipcRenderer.invoke('djstudio:open-app', id) }));
