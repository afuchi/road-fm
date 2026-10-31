const path = require('node:path');
const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');

const appUrl = process.env.ROADFM_URL || 'https://road-fm.onrender.com/';
const appOrigin = new URL(appUrl).origin;
const commands = [
  ['Control+Alt+Up', 'previous-station'],
  ['Control+Alt+Down', 'next-station'],
  ['Control+Alt+Left', 'previous-track'],
  ['Control+Alt+Right', 'next-track'],
  ['Control+Alt+Space', 'toggle-play']
];
let overlayWindow;
let libraryWindow;

function pageUrl(overlay) {
  const url = new URL(appUrl);
  url.searchParams.delete('overlay');
  if (overlay) url.searchParams.set('overlay', '1');
  return url.toString();
}

function configureExternalLinks(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== appOrigin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function createOverlay() {
  overlayWindow = new BrowserWindow({
    width: 510,
    height: 630,
    minWidth: 420,
    minHeight: 520,
    title: 'ROAD FM',
    autoHideMenuBar: true,
    alwaysOnTop: true,
    backgroundColor: '#171a18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  configureExternalLinks(overlayWindow);
  overlayWindow.loadURL(pageUrl(true));
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

function createLibraryWindow() {
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    libraryWindow.show();
    libraryWindow.focus();
    return;
  }
  libraryWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    title: 'ROAD FM Station Library',
    autoHideMenuBar: true,
    backgroundColor: '#171a18',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  configureExternalLinks(libraryWindow);
  libraryWindow.loadURL(pageUrl(false));
  libraryWindow.on('closed', () => { libraryWindow = null; });
}

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createOverlay();
    for (const [accelerator, command] of commands) {
      if (!globalShortcut.register(accelerator, () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('roadfm:command', command);
      })) console.warn(`Could not register ROAD FM shortcut: ${accelerator}`);
    }
    ipcMain.on('roadfm:open-library', event => {
      try {
        if (new URL(event.senderFrame.url).origin === appOrigin) createLibraryWindow();
      } catch { /* Ignore requests from unexpected frames. */ }
    });
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}