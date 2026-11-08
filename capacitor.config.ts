import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app: the Angular build "capacitor" (`ng build -c capacitor`) inside a native WebView, served from the
 * APK at https://localhost. It talks to the public site (https://www.erastcg.com: the API, the socket, /wake) by
 * full address. Native screen (landscape, immersive full screen): android/app/src/main/java/.../MainActivity.java.
 * Updates of the web part without reinstalling: @capgo/capacitor-updater, self-hosted and driven by the page
 * (src/app/core/native: /app/app-update.json on the site; no Capgo cloud, no statistics sent anywhere).
 */
const config: CapacitorConfig = {
  appId: 'com.erastcg.eras',
  appName: 'ERAS',
  webDir: 'dist/eras-web-capacitor/browser',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
  },
  android: {
    // The page's own service worker keeps the card pictures (eras-pictures-sw.js): its requests go through the APK too
    resolveServiceWorkerRequests: true,
  },
  plugins: {
    // The activity hides the bars itself (immersive); the WebView is never padded or resized by them
    SystemBars: {
      insetsHandling: 'disable',
      hidden: true,
      style: 'DARK',
    },
    CapacitorUpdater: {
      // Driven by the page (core/native): it decides when to download and when to switch (never during a game)
      autoUpdate: false,
      // A new bundle must call notifyAppReady within this time or the previous one comes back
      appReadyTimeout: 15000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      // A new APK starts from the web part it carries
      resetWhenUpdate: true,
      // Self-hosted: nothing is sent to Capgo's servers
      updateUrl: '',
      channelUrl: '',
      statsUrl: '',
      directUpdate: false,
      shakeMenu: false,
      nativeUpdatePrompt: false,
    },
  },
};

export default config;
