const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const DOMAINS = {
  custom: 'https://api.hn-ai.pro',
  lovable: 'https://hn-mind-hub.lovable.app',
};

const CONFIG_PATH = path.join(app.getPath('userData'), 'hn-config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return { domain: 'custom' }; }
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}

let mainWindow = null;
let currentUrl = process.env.HN_APP_URL || DOMAINS[loadConfig().domain] || DOMAINS.custom;

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.toggleDevTools() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Domain',
      submenu: [
        {
          label: 'Custom Domain  (api.hn-ai.pro)',
          type: 'radio',
          checked: currentUrl === DOMAINS.custom,
          click: () => switchDomain('custom'),
        },
        {
          label: 'Lovable Domain  (hn-mind-hub.lovable.app)',
          type: 'radio',
          checked: currentUrl === DOMAINS.lovable,
          click: () => switchDomain('lovable'),
        },
        { type: 'separator' },
        { label: `Current: ${currentUrl}`, enabled: false },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function switchDomain(key) {
  currentUrl = DOMAINS[key];
  saveConfig({ domain: key });
  buildMenu();
  mainWindow?.loadURL(currentUrl);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'HN Mind Hub',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(currentUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isInternal = Object.values(DOMAINS).some((d) => url.startsWith(d));
    if (!isInternal) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
