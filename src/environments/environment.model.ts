export interface Environment {
  /** Base URL of the backend API; empty = same origin (nginx proxies /api and /ws). */
  apiBaseUrl: string;
  /**
   * A backend that sleeps until someone visits (AWS): the address that wakes it up. While it starts, the site shows
   * that it is warming up. Empty or missing: the backend is always on.
   */
  wakeUrl?: string;
}
