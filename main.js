const { app, BrowserWindow, shell, ipcMain } = require('electron');
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

let updater = null;
let updateAvailable = false;
let updateDownloading = false;
let updateDownloaded = false;
let installWhenReady = false;
let quitRequestedForUpdate = false;
let mainWindow = null;
let latestUpdateInfo = null;
let manualCheck = false;
function publishUpdateState(state, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('djstudio:update:state', { state, currentVersion: app.getVersion(), ...(latestUpdateInfo || {}), ...extra });
}
ipcMain.handle('djstudio:update:version', () => ({ currentVersion: app.getVersion(), packaged: app.isPackaged }));
ipcMain.handle('djstudio:update:check', async () => {
  if (!updater) { publishUpdateState('unavailable', { message: 'A verificação online fica disponível na versão instalada do Windows.' }); return { available: false }; }
  manualCheck = true; publishUpdateState('checking');
  try { const result = await updater.checkForUpdates(); if (result?.updateInfo) latestUpdateInfo = { latestVersion: result.updateInfo.version, releaseNotes: result.updateInfo.releaseNotes, releaseDate: result.updateInfo.releaseDate }; return { available: updateAvailable, latestVersion: latestUpdateInfo?.latestVersion || null }; }
  catch (error) { manualCheck = false; publishUpdateState('error', { message: error.message || 'Falha ao verificar atualizações.' }); return { available: false, message: error.message || 'Falha ao verificar atualizações.' }; }
});
ipcMain.handle('djstudio:update:install', () => {
  if (!updater) return { started: false };
  installWhenReady = true;
  if (updateDownloaded) { updater.quitAndInstall(false, true); return { started: true, installing: true }; }
  publishUpdateState('downloading', { message: 'A instalação começará assim que o download terminar.' });
  return { started: true, installing: false };
});
function setupAutoUpdates() {
  if (!app.isPackaged || process.platform !== 'win32') return;
  try { ({ autoUpdater: updater } = require('electron-updater')); }
  catch (error) { console.error('Não foi possível carregar o sistema de atualizações:', error); return; }
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowDowngrade = false;
  updater.on('error', error => { updateDownloading = false; publishUpdateState('error', { message: error.message || 'Falha ao atualizar.' }); console.error('Erro ao atualizar o DJ Studio PRO:', error); });
  updater.on('update-available', info => {
    updateAvailable = true;
    latestUpdateInfo = { latestVersion: info.version, releaseNotes: info.releaseNotes, releaseDate: info.releaseDate };
    publishUpdateState('available', latestUpdateInfo);
    startUpdateDownload();
    manualCheck = false;
  });
  updater.on('update-not-available', info => {
    updateAvailable = false; manualCheck = false;
    latestUpdateInfo = { latestVersion: app.getVersion(), releaseNotes: info?.releaseNotes || [] };
    publishUpdateState('current', latestUpdateInfo);
  });
  updater.on('download-progress', progress => publishUpdateState('downloading', { progress: progress.percent, transferred: progress.transferred, total: progress.total, bytesPerSecond: progress.bytesPerSecond }));
  updater.on('update-downloaded', info => {
    updateDownloading = false; updateDownloaded = true; updateAvailable = false;
    latestUpdateInfo = { latestVersion: info.version, releaseNotes: info.releaseNotes, releaseDate: info.releaseDate };
    publishUpdateState('downloaded', latestUpdateInfo);
    if (quitRequestedForUpdate || installWhenReady) updater.quitAndInstall(false, true);
  });
  app.whenReady().then(() => {
    setTimeout(() => updater.checkForUpdates().catch(error => { publishUpdateState('error', { message: error.message }); console.error('Falha ao verificar atualizações:', error); }), 6000);
    setInterval(() => { if (!updateAvailable && !updateDownloading && !updateDownloaded) updater.checkForUpdates().catch(error => console.error('Falha ao verificar atualizações:', error)); }, 6 * 60 * 60 * 1000).unref();
  });
}
function startUpdateDownload() {
  if (!updater || !updateAvailable || updateDownloading || updateDownloaded) return;
  updateDownloading = true;
  publishUpdateState('downloading', { progress: 0 });
  updater.downloadUpdate().catch(error => { updateDownloading = false; publishUpdateState('error', { message: error.message || 'Falha ao baixar atualização.' }); console.error('Falha ao baixar atualização:', error); });
}
app.on('before-quit', event => {
  if (updateDownloading && (installWhenReady || quitRequestedForUpdate)) { event.preventDefault(); quitRequestedForUpdate = true; }
});
function createWindow() {
  const win = new BrowserWindow({ icon: fs.existsSync(path.join(path.dirname(process.execPath), 'DJ Studio PRO.ico')) ? path.join(path.dirname(process.execPath), 'DJ Studio PRO.ico') : path.join(__dirname, 'build', 'LOGO-DJSTUDIO.ico'), width: 1440, height: 920, minWidth: 900, minHeight: 620, title: 'DJ Studio PRO', backgroundColor: '#0b0d10', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow = win;
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
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


