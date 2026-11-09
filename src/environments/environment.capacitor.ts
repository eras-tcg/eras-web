import type { Environment } from './environment.model';

/**
 * The Android app (Capacitor): the page is served from the APK at https://localhost, so the API, the socket and the
 * wake-up are the public site's, by their full address (the server allows the app's origin, https://localhost).
 */
export const environment: Environment = {
  apiBaseUrl: 'https://www.erastcg.com',
  wakeUrl: 'https://www.erastcg.com/wake',
  wsUrl: 'wss://www.erastcg.com/ws',
  siteUrl: 'https://www.erastcg.com',
  liveUpdates: true,
};
