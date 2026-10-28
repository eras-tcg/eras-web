export interface Environment {
  /** Base URL of the backend API; empty = same origin (nginx proxies /api and /ws). */
  apiBaseUrl: string;
}
