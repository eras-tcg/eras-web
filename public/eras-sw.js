/*
 * ERAS service worker: the card pictures' cache (eras-pictures-sw.js, first: it answers the pictures before ngsw sees
 * them) plus Angular's own (ngsw-worker.js: the app shell, every chunk, the engine's data, updates).
 */
importScripts('./eras-pictures-sw.js');
importScripts('./ngsw-worker.js');
