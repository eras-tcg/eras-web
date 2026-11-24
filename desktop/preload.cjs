// Tells the site it runs as the Windows app (core/pwa/app-mode.ts, isDesktopApp): the installed app's mode,
// local first, in its own full window. Its window's full screen is the only other thing the page reaches: set from
// Preferencias as the app opens, and told back when the player changes it (F11, Esc) (core/pwa/app-fullscreen.ts).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('erasDesktop', {
  platform: process.platform,
  setFullScreen: (on) => ipcRenderer.send('eras:set-full-screen', on === true),
  onFullScreenChange: (listener) => {
    if (typeof listener !== 'function') return;
    ipcRenderer.on('eras:full-screen', (_event, on) => listener(on === true));
  },
});
