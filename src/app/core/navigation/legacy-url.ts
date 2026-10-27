import { environment } from '@env';

/** URL of a page that still lives in the legacy Vue app. */
export function legacyUrl(path: string): string {
  return `${environment.legacyBaseUrl}${path}`;
}
