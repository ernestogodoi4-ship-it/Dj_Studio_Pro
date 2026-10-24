const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const appPaths = {
  sunando: [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'SUNANDO', 'SUNANDO.exe'), path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'Programs', 'SUNANDO', 'SUNANDO.exe')],
  mixora: [path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'Programs', 'Mixora', 'Mixora.exe')],
  wavesynk: [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WaveSynk', 'WaveSynk.exe'), path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'Programs', 'WaveSynk', 'WaveSynk.exe')]
};
const knownApp = id => Object.prototype.hasOwnProperty.call(appPaths, id) ? appPaths[id].find(file => fs.existsSync(file)) || null : null;
ipcMain.handle('djstudio:apps-available', () => Object.fromEntries(Object.entries(appPaths).map(([id, candidates]) => [id, candidates.some(file => fs.existsSync(file))])));
ipcMain.handle('djstudio:open-app', (event, id) => new Promise(resolve => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const exe = knownApp(id);
  if (!owner || !exe) return resolve({ opened: false, installed: false });
  const child = spawn(exe, [], { detached: true, stdio: 'ignore', windowsHide: false, cwd: path.dirname(exe) });
  child.once('error', error => resolve({ opened: false, installed: true, error: error.code || error.message || 'Falha ao iniciar o processo.' }));
  child.once('spawn', () => { child.unref(); resolve({ opened: true, installed: true }); });
}));

let updater;
let updateAvailable = false;
let updateDownloading = false;
let installOnQuit = false;
let quitRequestedForUpdate = false;
let updateDialogOpen = false;

function setupAutoUpdates() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  try {
    ({ autoUpdater: updater } = require('electron-updater'));
  } catch (error) {
    console.error('Não foi possível carregar o sistema de atualizações:', error);
    return;
  }

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowDowngrade = false;

  updater.on('error', error => {
    updateDownloading = false;
    console.error('Erro ao atualizar o DJ Studio PRO:', error);
  });

  updater.on('update-available', info => {
    updateAvailable = true;
    if (updateDialogOpen) return;
    updateDialogOpen = true;
    const version = info.version ? ` (versão ${info.version})` : '';
    const owner = BrowserWindow.getAllWindows()[0] || null;
    const options = {
      type: 'info',
      title: 'Atualização do DJ Studio PRO',
      message: `Uma nova versão${version} está disponível.`,
      detail: 'Escolha quando deseja instalar. Se escolher ao fechar, o instalador será aplicado depois que o download terminar.',
      buttons: ['Instalar agora', 'Instalar ao fechar o app', 'Lembrar mais tarde'],
      defaultId: 1,
      cancelId: 2,
      noLink: true
    };
    const prompt = owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options);
    prompt.then(({ response }) => {
      updateDialogOpen = false;
      if (response === 0) {
        installOnQuit = true;
        quitRequestedForUpdate = true;
        startUpdateDownload();
      } else if (response === 1) {
        installOnQuit = true;
        startUpdateDownload();
      }
    }).catch(error => {
      updateDialogOpen = false;
      console.error('Não foi possível exibir o aviso de atualização:', error);
    });
  });

  updater.on('update-not-available', () => { updateAvailable = false; });

  updater.on('update-downloaded', async info => {
    updateDownloading = false;
    updateAvailable = false;
    if (quitRequestedForUpdate && installOnQuit) {
      updater.quitAndInstall(false, true);
      return;
    }
    if (installOnQuit) {
      const owner = BrowserWindow.getAllWindows()[0] || null;
      const options = {
        type: 'info',
        title: 'Atualização pronta',
        message: `A versão ${info.version || ''} foi baixada.`,
        detail: 'Ela será instalada quando você fechar o DJ Studio PRO.',
        buttons: ['Instalar agora', 'Continuar usando'],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      };
      const result = owner ? await dialog.showMessageBox(owner, options) : await dialog.showMessageBox(options);
      if (result.response === 0) updater.quitAndInstall(false, true);
    }
  });

  app.whenReady().then(() => {
    setTimeout(() => updater.checkForUpdates().catch(error => console.error('Falha ao verificar atualizações:', error)), 8000);
    setInterval(() => {
      if (!updateAvailable && !updateDownloading) updater.checkForUpdates().catch(error => console.error('Falha ao verificar atualizações:', error));
    }, 6 * 60 * 60 * 1000).unref();
  });
}

function startUpdateDownload() {
  if (!updater || updateDownloading) return;
  updateDownloading = true;
  updater.downloadUpdate().catch(error => {
    updateDownloading = false;
    installOnQuit = false;
    updateAvailable = false;
    quitRequestedForUpdate = false;
    console.error('Falha ao baixar atualização:', error);
    const owner = BrowserWindow.getAllWindows()[0] || null;
    const options = { type: 'error', title: 'Falha na atualização', message: 'Não foi possível baixar a atualização.', detail: 'Confira sua conexão com a internet e tente novamente ao abrir o aplicativo.', buttons: ['OK'], noLink: true };
    if (owner) dialog.showMessageBox(owner, options); else dialog.showMessageBox(options);
  });
}

app.on('before-quit', event => {
  if (installOnQuit && updateDownloading) {
    event.preventDefault();
    quitRequestedForUpdate = true;
    const owner = BrowserWindow.getAllWindows()[0] || null;
    const options = { type: 'info', title: 'Finalizando atualização', message: 'O download da atualização ainda está em andamento.', detail: 'O DJ Studio PRO terminará o download e fechará para instalar a nova versão.', buttons: ['OK'], noLink: true };
    if (owner) dialog.showMessageBox(owner, options);
    else dialog.showMessageBox(options);
  } else if (installOnQuit && updateAvailable && !updateDownloading) {
    event.preventDefault();
    startUpdateDownload();
    quitRequestedForUpdate = true;
  }
});

function createWindow() {
  const win = new BrowserWindow({ icon: fs.existsSync(path.join(path.dirname(process.execPath), 'DJ Studio PRO.ico')) ? path.join(path.dirname(process.execPath), 'DJ Studio PRO.ico') : path.join(__dirname, 'build', 'LOGO-DJSTUDIO.ico'), width: 1440, height: 920, minWidth: 900, minHeight: 620, title: 'DJ Studio PRO', backgroundColor: '#0b0d10', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const localFile = url.startsWith('file://');
    if (!localFile && (url.startsWith('https://') || url.startsWith('http://'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdates();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });


