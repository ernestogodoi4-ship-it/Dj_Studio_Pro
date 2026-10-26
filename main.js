const { app, BrowserWindow, shell, ipcMain, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const appPaths = {
  sunando: [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'SUNANDO', 'SUNANDO.exe'), path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'Programs', 'SUNANDO', 'SUNANDO.exe')],
  mixora: [path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'Programs', 'Mixora', 'Mixora.exe')],
  wavesynk: [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WaveSynk', 'WaveSynk.exe'), path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'Programs', 'WaveSynk', 'WaveSynk.exe')]
};
const appRepositories = {
  sunando: 'https://github.com/fernexdesigner-cmyk/SUNANDO',
  wavesynk: 'https://github.com/fernexdesigner-cmyk/WAVESYNK',
};
const appPreviewFiles = {
  sunando: 'sunando-preview.mp4',
  mixora: 'mixora-preview.mp4',
  wavesynk: 'wavesynk-preview.mp4'
};
const knownApp = id => Object.prototype.hasOwnProperty.call(appPaths, id) ? appPaths[id].find(file => fs.existsSync(file)) || null : null;
ipcMain.handle('djstudio:apps-available', () => Object.fromEntries(Object.entries(appPaths).map(([id, candidates]) => [id, candidates.some(file => fs.existsSync(file))])));
ipcMain.handle('djstudio:app-preview', (_event, id) => {
  const filename = appPreviewFiles[id];
  if (!filename) return null;
  const previewPath = path.join(__dirname, 'app', 'assets', 'apps', filename);
  return fs.existsSync(previewPath) ? pathToFileURL(previewPath).href : null;
});
ipcMain.handle('djstudio:open-app', (event, id) => new Promise(resolve => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!owner || !Object.prototype.hasOwnProperty.call(appPaths, id)) return resolve({ opened: false, installed: false });
  const exe = knownApp(id);
  if (!exe) {
    const repository = appRepositories[id];
    if (!repository) return resolve({ opened: false, installed: false, comingSoon: true });
    shell.openExternal(repository).then(() => resolve({ opened: false, installed: false, redirected: true, repository })).catch(error => resolve({ opened: false, installed: false, redirected: false, repository, error: error.message || 'Não foi possível abrir o repositório.' }));
    return;
  }
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
let splashWindow = null;
let splashProgress = { progress: 4, status: 'Inicializando o DJ Studio PRO…' };
let splashVisibleAt = 0;
let latestUpdateInfo = null;
let manualCheck = false;
let startupUpdateCheckDone = !app.isPackaged || process.platform !== 'win32';
let latestUpdateState = { state: 'idle' };
const displayReturnStates = new WeakMap();
const preferenceFile = () => path.join(app.getPath('userData'), 'dj-studio-preferences.json');
function readFullscreenPreference() {
  try { return JSON.parse(fs.readFileSync(preferenceFile(), 'utf8')).openFullscreen === true; }
  catch { return false; }
}
ipcMain.handle('djstudio:fullscreen:get', () => readFullscreenPreference());
ipcMain.handle('djstudio:fullscreen:set', (event, enabled) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const openFullscreen = enabled === true;
  try {
    const filename = preferenceFile();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    let preferences = {};
    try { preferences = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch {}
    preferences.openFullscreen = openFullscreen;
    fs.writeFileSync(filename, JSON.stringify(preferences, null, 2));
    if (win && !win.isDestroyed()) win.setFullScreen(openFullscreen);
    return { ok: true, openFullscreen };
  } catch (error) {
    return { ok: false, openFullscreen: readFullscreenPreference(), message: error.message || 'Não foi possível salvar a preferência.' };
  }
});
ipcMain.handle('djstudio:displays:list', () => screen.getAllDisplays().map((display, index) => ({
  id: display.id,
  label: display.label || (display.id === screen.getPrimaryDisplay().id ? 'Monitor principal' : `Monitor ${index + 1}`),
  bounds: display.bounds,
  workArea: display.workArea,
  isPrimary: display.id === screen.getPrimaryDisplay().id
})));
ipcMain.handle('djstudio:displays:place', (event, { displayId, fullScreen = false } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const display = screen.getAllDisplays().find(item => String(item.id) === String(displayId));
  if (!win || win.isDestroyed() || !display) return { ok: false, message: 'Monitor indisponível.' };
  if (!displayReturnStates.has(win)) {
    displayReturnStates.set(win, { bounds: win.getBounds(), maximized: win.isMaximized(), fullScreen: win.isFullScreen() });
  }
  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();
  if (fullScreen) {
    win.setBounds(display.bounds);
    win.setFullScreen(true);
  } else {
    const area = display.workArea;
    const width = Math.min(1440, Math.max(700, Math.round(area.width * 0.88)));
    const height = Math.min(920, Math.max(480, Math.round(area.height * 0.88)));
    win.setBounds({ x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2), width, height });
  }
  return { ok: true, displayId: display.id, fullScreen };
});
ipcMain.handle('djstudio:displays:restore', event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return { ok: false };
  const previous = displayReturnStates.get(win);
  if (!previous) return { ok: true, restored: false };
  displayReturnStates.delete(win);
  if (win.isFullScreen()) win.setFullScreen(false);
  win.setBounds(previous.bounds);
  if (previous.maximized) win.maximize();
  if (previous.fullScreen) win.setFullScreen(true);
  return { ok: true, restored: true };
});
function completeStartupUpdateCheck() {
  if (startupUpdateCheckDone) return;
  startupUpdateCheckDone = true;
  if (mainWindow && mainWindow.__djStudioReady) revealMainWindow(mainWindow);
}

function publishSplashProgress(progress, status) {
  splashProgress = { progress: Math.max(splashProgress.progress, Math.min(100, Math.max(0, progress))), status };
  if (splashWindow && !splashWindow.isDestroyed() && !splashWindow.webContents.isLoading()) {
    splashWindow.webContents.send('djstudio:splash:progress', splashProgress);
  }
}
function closeSplash() {
  const splash = splashWindow;
  splashWindow = null;
  if (!splash || splash.isDestroyed()) return;
  try { splash.close(); } catch { splash.destroy(); }
}
function createSplashWindow() {
  try {
    const splash = new BrowserWindow({
      width: 960,
      height: 540,
      useContentSize: true,
      center: true,
      frame: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#090B0F',
      title: 'DJ Studio PRO — Inicializando',
      webPreferences: {
        preload: path.join(__dirname, 'app', 'splash-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    splashWindow = splash;
    let fallbackTimer = setTimeout(() => {
      if (!splash.isDestroyed() && !splash.isVisible()) {
        splash.show();
        splashVisibleAt = Date.now();
      }
    }, 4000);
    fallbackTimer.unref();
    splash.once('ready-to-show', () => {
      clearTimeout(fallbackTimer);
      if (splash.isDestroyed()) return;
      splash.show();
      splashVisibleAt = Date.now();
      if (!splash.webContents.isLoading()) splash.webContents.send('djstudio:splash:progress', splashProgress);
    });
    splash.webContents.on('did-finish-load', () => {
      if (!splash.isDestroyed()) splash.webContents.send('djstudio:splash:progress', splashProgress);
    });
    splash.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame) return;
      clearTimeout(fallbackTimer);
      console.error(`Falha ao carregar a tela inicial (${code}): ${description} — ${url}`);
      if (splashWindow === splash) splashWindow = null;
      if (!splash.isDestroyed()) splash.destroy();
    });
    splash.on('closed', () => { if (splashWindow === splash) splashWindow = null; });
    splash.loadFile(path.join(__dirname, 'app', 'splash.html')).catch(error => {
      clearTimeout(fallbackTimer);
      console.error('Não foi possível abrir a tela inicial:', error);
      if (splashWindow === splash) splashWindow = null;
      if (!splash.isDestroyed()) splash.destroy();
    });
    return splash;
  } catch (error) {
    console.error('Não foi possível criar a tela inicial:', error);
    splashWindow = null;
    return null;
  }
}
function revealMainWindow(win) {
  if (!win || win.isDestroyed() || win.__djStudioRevealed) return;
  win.__djStudioRevealed = true;
  publishSplashProgress(100, 'Pronto para mixar.');
  const minSplashDuration = splashVisibleAt ? 650 : 0;
  const remaining = Math.max(0, minSplashDuration - (Date.now() - splashVisibleAt));
  setTimeout(() => {
    if (win.isDestroyed()) return;
    win.show();
    closeSplash();
  }, remaining);
}
function publishUpdateState(state, extra = {}) {
  latestUpdateState = { state, currentVersion: app.getVersion(), ...(latestUpdateInfo || {}), ...extra };
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('djstudio:update:state', latestUpdateState);
}

ipcMain.handle('djstudio:update:version', () => {
  let releaseNotes = '';
  try { releaseNotes = fs.readFileSync(path.join(app.getAppPath(), 'RELEASE_NOTES.md'), 'utf8'); }
  catch (error) { console.warn('Não foi possível ler as notas locais da versão:', error.message); }
  return { currentVersion: app.getVersion(), packaged: app.isPackaged, releaseNotes };
});
ipcMain.handle('djstudio:update:state', () => latestUpdateState);
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
  if (!app.isPackaged || process.platform !== 'win32') { completeStartupUpdateCheck(); return; }
  try { ({ autoUpdater: updater } = require('electron-updater')); }
  catch (error) { console.error('Não foi possível carregar o sistema de atualizações:', error); completeStartupUpdateCheck(); return; }
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowDowngrade = false;
  updater.on('error', error => { updateDownloading = false; publishUpdateState('error', { message: error.message || 'Falha ao atualizar.' }); completeStartupUpdateCheck(); console.error('Erro ao atualizar o DJ Studio PRO:', error); });
  updater.on('update-available', info => {
    updateAvailable = true;
    latestUpdateInfo = { latestVersion: info.version, releaseNotes: info.releaseNotes, releaseDate: info.releaseDate };
    publishUpdateState('available', latestUpdateInfo);
    completeStartupUpdateCheck();
    startUpdateDownload();
    manualCheck = false;
  });
  updater.on('update-not-available', info => {
    updateAvailable = false; manualCheck = false;
    latestUpdateInfo = { latestVersion: app.getVersion(), releaseNotes: info?.releaseNotes || [] };
    publishUpdateState('current', latestUpdateInfo);
    completeStartupUpdateCheck();
  });
  updater.on('download-progress', progress => publishUpdateState('downloading', { progress: progress.percent, transferred: progress.transferred, total: progress.total, bytesPerSecond: progress.bytesPerSecond }));
  updater.on('update-downloaded', info => {
    updateDownloading = false; updateDownloaded = true; updateAvailable = false;
    latestUpdateInfo = { latestVersion: info.version, releaseNotes: info.releaseNotes, releaseDate: info.releaseDate };
    publishUpdateState('downloaded', latestUpdateInfo);
    if (quitRequestedForUpdate || installWhenReady) updater.quitAndInstall(false, true);
  });
  app.whenReady().then(() => {
    setTimeout(() => updater.checkForUpdates().catch(error => { publishUpdateState('error', { message: error.message }); completeStartupUpdateCheck(); console.error('Falha ao verificar atualizações:', error); }), 250);
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
  publishSplashProgress(28, 'Preparando os módulos de áudio…');
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const minWidth = Math.max(320, Math.min(900, workArea.width - 24));
  const minHeight = Math.max(320, Math.min(620, workArea.height - 24));
  const width = Math.min(1440, Math.max(minWidth, workArea.width - 64));
  const height = Math.min(920, Math.max(minHeight, workArea.height - 64));
  const win = new BrowserWindow({ icon: fs.existsSync(path.join(path.dirname(process.execPath), 'DJ Studio PRO.ico')) ? path.join(path.dirname(process.execPath), 'DJ Studio PRO.ico') : path.join(__dirname, 'build', 'LOGO-DJSTUDIO.ico'), width, height, minWidth, minHeight, resizable: true, maximizable: true, fullscreenable: true, fullscreen: readFullscreenPreference(), title: 'DJ Studio PRO', backgroundColor: '#0b0d10', autoHideMenuBar: true, show: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow = win;
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  publishSplashProgress(42, 'Carregando a biblioteca musical…');
  win.webContents.on('did-start-loading', () => publishSplashProgress(50, 'Carregando a biblioteca musical…'));
  win.webContents.once('dom-ready', () => publishSplashProgress(72, 'Inicializando áudio e análise…'));
  win.webContents.once('did-finish-load', () => publishSplashProgress(91, 'Finalizando interface e controladores…'));
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame) return;
    console.error(`Falha ao carregar a janela principal (${code}): ${description} — ${url}`);
    revealMainWindow(win);
  });
  let startupFallback = setTimeout(() => revealMainWindow(win), 25000);
  startupFallback.unref();
  win.once('ready-to-show', () => {
    clearTimeout(startupFallback);
    publishSplashProgress(96, startupUpdateCheckDone ? 'Preparando a cabine…' : 'Verificando novidades para você…');
    win.__djStudioReady = true;
    if (startupUpdateCheckDone) revealMainWindow(win);
    else { win.__updateGateTimer = setTimeout(() => { completeStartupUpdateCheck(); }, 12000); win.__updateGateTimer.unref(); }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html')).catch(error => {
    clearTimeout(startupFallback);
    console.error('Não foi possível carregar o DJ Studio PRO:', error);
    revealMainWindow(win);
  });
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
  publishSplashProgress(14, 'Preparando o ambiente de áudio…');
  createSplashWindow();
  createWindow();
  setupAutoUpdates();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });


