// Tells the site it runs as the Windows app (core/pwa/app-mode.ts, isDesktopApp): the installed app's mode,
// local first, in its own full window. Nothing else of the system reaches the page.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('erasDesktop', { platform: process.platform });
