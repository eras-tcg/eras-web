// ERAS for Windows: a window of its own over the site (https://www.erastcg.com), the same code the browser runs.
// The site itself (its service worker) keeps the game for playing offline and updates it; this shell only opens it,
// and updates itself: a new installer published with the site (/app/latest.yml, a higher version in package.json) is
// downloaded in the background and installed when the app closes, so the next start (and its icon) is the new one.
const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

/** Where the window was left (full screen, maximized, its size), so it opens again the same way. */
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function readState() {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function saveState(win) {
  try {
    const state = { fullScreen: win.isFullScreen(), maximized: win.isMaximized(), bounds: win.getNormalBounds() };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {
    // Not saved: it opens maximized next time
  }
}

/** Looks for a newer installer now and every few hours; it installs itself when the app closes. */
function keepUpdated() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const check = () => autoUpdater.checkForUpdates().catch(() => undefined);
  void check();
  setInterval(check, 4 * 60 * 60 * 1000);
}

/** The site it opens (ERAS_URL: another one, for staging or a local build). */
const SITE = process.env.ERAS_URL || 'https://www.erastcg.com/';
const ORIGIN = new URL(SITE).origin;

/** One window: opening ERAS again brings the open one to the front. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    const state = readState();
    const bounds = state.bounds && typeof state.bounds.width === 'number' ? state.bounds : { width: 1280, height: 800 };
    win = new BrowserWindow({
      ...bounds,
      fullscreen: state.fullScreen === true,
      minWidth: 960,
      minHeight: 600,
      show: false,
      backgroundColor: '#141414',
      title: 'ERAS',
      icon: path.join(__dirname, 'build', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    if (state.fullScreen !== true && state.maximized !== false) win.maximize();
    win.once('ready-to-show', () => win.show());
    // Left as it was: in full screen it opens in full screen again
    win.on('close', () => saveState(win));

    // Full screen as the site's Preferencias say (it asks as it opens), and the site told when it changes here
    ipcMain.on('eras:set-full-screen', (event, on) => {
      if (win && event.sender === win.webContents && win.isFullScreen() !== (on === true)) win.setFullScreen(on === true);
    });
    const tellFullScreen = () => win && win.webContents.send('eras:full-screen', win.isFullScreen());
    win.on('enter-full-screen', tellFullScreen);
    win.on('leave-full-screen', tellFullScreen);

    // F11 puts it in full screen and takes it out (the site's own preference does it too)
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F11') {
        win.setFullScreen(!win.isFullScreen());
        event.preventDefault();
      }
    });

    // Another site (a shop, a social network) opens in the player's browser, never inside the game's window
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (new URL(url).origin !== ORIGIN) void shell.openExternal(url);
      else void win.loadURL(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin === ORIGIN) return;
      event.preventDefault();
      void shell.openExternal(url);
    });

    // Never opened with a connection, nothing kept yet: a page saying so, with a way to try again
    win.webContents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
      if (!isMainFrame || code === -3 /* aborted: a navigation replaced it */) return;
      void win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: url || SITE } });
    });

    void win.loadURL(SITE);
    win.on('closed', () => (win = null));
    keepUpdated();
  });

  app.on('window-all-closed', () => app.quit());
}
