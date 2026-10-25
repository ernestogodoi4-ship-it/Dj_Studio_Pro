const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('melodyStudio', Object.freeze({ close: () => ipcRenderer.invoke('melody:close'), displaySetup: () => ipcRenderer.invoke('melody:display-setup') }));
