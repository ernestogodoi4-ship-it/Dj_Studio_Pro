const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('node:path');

app.setName('Melody Studio');
app.setPath('userData', path.join(app.getPath('appData'), 'Melody Studio'));
let mainWindow;
ipcMain.handle('melody:close', event => { const win = BrowserWindow.fromWebContents(event.sender); if (win && !win.isDestroyed()) win.close(); return true; });
ipcMain.handle('melody:display-setup', async event => {
  const win = BrowserWindow.fromWebContents(event.sender); if (!win || win.isDestroyed()) return { ok: false };
  const displays = screen.getAllDisplays();
  if (!displays.length) return { ok: false };
  const labels = displays.map((display, index) => { const area = display.workArea; return 'Monitor ' + (index + 1) + ' · ' + area.width + '×' + area.height + (display.id === screen.getPrimaryDisplay().id ? ' · principal' : ''); });
  const choice = await dialog.showMessageBox(win, { type: 'question', title: 'Melody Studio · monitor', message: 'Escolha o monitor para abrir em tela cheia.', buttons: [...labels, 'Cancelar'], cancelId: labels.length, defaultId: Math.max(0, displays.findIndex(display => display.id === screen.getPrimaryDisplay().id)) });
  if (choice.response >= displays.length) return { ok: false, cancelled: true };
  const display = displays[choice.response]; if (win.isFullScreen()) win.setFullScreen(false); win.setBounds(display.bounds); win.setFullScreen(true); return { ok: true };
});
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 900, minHeight: 640, title: 'Melody Studio', backgroundColor: '#12141b', show: false, autoHideMenuBar: true, icon: path.join(__dirname, 'app', 'melody-studio.ico'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.once('ready-to-show', () => mainWindow.show()); mainWindow.loadFile(path.join(__dirname, 'app', 'index.html')); mainWindow.on('closed', () => { mainWindow = null; });
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
