const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Single source of truth — mirrors build.config.json.
// Bundled at package time so updates in build.config.json propagate to every build.
function loadBuildConfig() {
  const candidates = [
    path.join(__dirname, '..', 'build.config.json'),
    path.join(process.resourcesPath || '', 'app', 'build.config.json'),
    path.join(__dirname, 'build.config.json'),
  ];
  for (const p of candidates) {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
  }
  return {
    appName: 'HN-Mind-Hub',
    domains: { primary: 'https://api.hn-ai.pro', fallback: 'https://hn-mind-hub.lovable.app' },
    desktop: { window: { width: 1400, height: 900 } },
  };
}

const BUILD = loadBuildConfig();
const DOMAINS = {
  custom: BUILD.domains.primary,
  lovable: BUILD.domains.fallback,
};

const CONFIG_PATH = path.join(app.getPath('userData'), 'hn-config.json');
const OFFLINE_PAGE = path.join(__dirname, 'index.html');

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
          label: `Primary  (${new URL(DOMAINS.custom).host})`,
          type: 'radio',
          checked: currentUrl === DOMAINS.custom,
          click: () => switchDomain('custom'),
        },
        {
          label: `Fallback  (${new URL(DOMAINS.lovable).host})`,
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
  loadTarget();
}

function loadTarget() {
  if (!mainWindow) return;
  mainWindow.loadURL(currentUrl).catch(() => showOffline(currentUrl));
}

function showOffline(target) {
  if (!mainWindow || !fs.existsSync(OFFLINE_PAGE)) return;
  mainWindow.loadFile(OFFLINE_PAGE, { search: `target=${encodeURIComponent(target)}` });
}

function createWindow() {
  const win = BUILD.desktop?.window || { width: 1400, height: 900 };
  mainWindow = new BrowserWindow({
    width: win.width,
    height: win.height,
    title: BUILD.appName || 'HN Mind Hub',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  loadTarget();

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (code <= -100 && url === currentUrl) showOffline(currentUrl);
  });

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
