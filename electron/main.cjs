const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const APP_URL = process.env.HN_APP_URL || 'https://hn-mind-hub.lovable.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'HN Mind Hub',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(APP_URL);

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
