export interface Environment {
  /** Base URL of the backend API; empty = same origin (nginx proxies /api and /ws). */
  apiBaseUrl: string;
  /**
   * A backend that sleeps until someone visits (AWS): the address that wakes it up. While it starts, the site shows
   * that it is warming up. Empty or missing: the backend is always on.
   */
  wakeUrl?: string;
  /** The simulator's socket (STOMP); missing = /ws on the page's own origin. */
  wsUrl?: string;
  /**
   * The public site (https://www.erastcg.com): links shared with other players (a room's link) and the Android app's
   * updates (/app/app-update.json). Missing = the page's own origin.
   */
  siteUrl?: string;
  /**
   * The Android app only: take new versions of the web part without reinstalling (live updates from the site's
   * /app/app-update.json, core/native). Off: it only says when a new APK is needed.
   */
  liveUpdates?: boolean;
}
