// ERAS for Windows: a window of its own over the site (https://www.erastcg.com), the same code the browser runs.
// The site itself (its service worker) keeps the game for playing offline and updates it; this shell only opens it,
// so a new installer is needed only when this folder changes (README, "La app de Windows").
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');

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
    win = new BrowserWindow({
      width: 1280,
      height: 800,
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
    win.maximize();
    win.once('ready-to-show', () => win.show());

    // F11 puts it in full screen and takes it out (the site's own button does it too)
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
  });

  app.on('window-all-closed', () => app.quit());
}
