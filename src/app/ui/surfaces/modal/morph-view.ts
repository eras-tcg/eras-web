import { ApplicationRef } from '@angular/core';

/**
 * Changes what a dialog shows as one view turning into the next (the View Transitions API): `change` runs and the
 * page is rendered at once inside the transition, so the browser morphs every element with a view-transition-name
 * (the dialog's frame grows or shrinks to its new width and height while the old content fades into the new one).
 * Without the API, or when the device asks for less motion, it just changes.
 */
export function morphView(appRef: ApplicationRef, change: () => void): void {
  const doc = typeof document === 'undefined' ? null : document;
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc || reduced || typeof doc.startViewTransition !== 'function') {
    change();
    return;
  }
  doc.startViewTransition(() => {
    change();
    appRef.tick();
  });
}
