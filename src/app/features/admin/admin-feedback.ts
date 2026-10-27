import { signal } from '@angular/core';
import { apiErrorMessage } from '@core/http/api-error';

export type Feedback = { tone: 'success' | 'danger'; text: string } | null;

/** One success/error message per admin page. */
export function feedbackState() {
  const feedback = signal<Feedback>(null);
  return {
    feedback,
    ok: (text: string) => feedback.set({ tone: 'success', text }),
    fail: (e: unknown, fallback: string) => feedback.set({ tone: 'danger', text: apiErrorMessage(e, fallback) }),
    clear: () => feedback.set(null),
  };
}
