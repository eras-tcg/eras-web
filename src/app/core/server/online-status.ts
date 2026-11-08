import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

/** Whether the browser says it is connected (`navigator.onLine`, kept up to date by its online/offline events). */
@Injectable({ providedIn: 'root' })
export class OnlineStatus {
  readonly online = signal(typeof navigator === 'undefined' || navigator.onLine !== false);

  constructor() {
    if (typeof window === 'undefined') return;
    const update = () => this.online.set(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    });
  }
}

/** An error that means the server could not be reached (no answer, a gateway without it, a socket that never opened). */
export function isUnreachable(error: unknown): boolean {
  if (error instanceof HttpErrorResponse) return [0, 502, 503, 504].includes(error.status);
  return error instanceof Error && error.message === 'timeout';
}
