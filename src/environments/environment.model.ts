export interface Environment {
  /** Base URL of the backend API; empty = same origin (nginx proxies /api and /ws). */
  apiBaseUrl: string;
  /** Where pages not migrated to Angular yet live (the Vue app). Empty = same origin. */
  legacyBaseUrl: string;
}
