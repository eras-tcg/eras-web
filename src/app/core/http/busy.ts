import { DOCUMENT } from '@angular/common';
import { HttpContextToken, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { finalize, tap } from 'rxjs';

/** A request the player did not ask for (a visit reported, a ping): it never holds the buttons. */
export const BACKGROUND = new HttpContextToken<boolean>(() => false);

/** What a click lands on that counts as a button (an element inside one counts too). */
const BUTTONS = 'button, [role="button"], a[erasButton], input[type="submit"], input[type="button"]';

/** A request that changes something and the player waits for: not a load, not a background one. */
export function holdsButtons(method: string, background: boolean): boolean {
  return !background && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

/**
 * While a request that changes something is on its way (a purchase, a claim, a save…), the site's buttons ignore
 * clicks, so a second click cannot send it again; the button that was pressed looks pending until the answer. The
 * simulator's own actions go through its socket, not here. A button that must stay usable meanwhile takes
 * `data-while-busy`.
 */
@Injectable({ providedIn: 'root' })
export class BusyState {
  private readonly document = inject(DOCUMENT);
  private readonly pending = signal(0);
  private pressed: Element | null = null;

  readonly busy = computed(() => this.pending() > 0);
  /** Changes the player sent that the server accepted: whatever depends on them may reload (missions, wallet…). */
  readonly changes = signal(0);

  constructor() {
    const root = this.document.documentElement;
    // Captured on the document: it runs before any handler of the button itself
    this.document.addEventListener('click', (event) => this.click(event), true);
    this.document.addEventListener('submit', (event) => this.busy() && event.preventDefault(), true);
    effect(() => {
      const busy = this.busy();
      root.classList.toggle('is-busy', busy);
      if (!busy) this.pressed?.removeAttribute('data-pending');
    });
  }

  start(): void {
    this.pending.update((n) => n + 1);
  }

  end(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  changed(): void {
    this.changes.update((n) => n + 1);
  }

  private click(event: Event): void {
    const button = event.target instanceof Element ? event.target.closest(BUTTONS) : null;
    if (!button || button.closest('[data-while-busy]')) return;
    if (this.busy()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    // When this click starts a request (its handler runs right after this), the button shows it is waiting
    this.pressed = button;
    setTimeout(() => {
      if (this.busy() && this.pressed === button) button.setAttribute('data-pending', '');
    });
  }
}

/** Counts the requests that hold the buttons (BusyState). */
export const busyInterceptor: HttpInterceptorFn = (req, next) => {
  if (!holdsButtons(req.method, req.context.get(BACKGROUND))) return next(req);
  const state = inject(BusyState);
  state.start();
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) state.changed();
    }),
    finalize(() => state.end()),
  );
};
