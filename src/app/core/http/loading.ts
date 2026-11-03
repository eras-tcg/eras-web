import { HttpInterceptorFn } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { BACKGROUND } from './busy';

/** A wait shorter than this shows nothing: the loading screen never flashes. */
export const SHOW_AFTER_MS = 750;
/** Once shown, it stays at least this long, so it does not blink away. */
export const SHOW_AT_LEAST_MS = 400;

/** The simulator has its own loading (rooms, the table): no loading screen there. */
export function hasOwnLoading(url: string): boolean {
  return /^\/simulator(?:[/?#]|$)/.test(url);
}

/**
 * A request the loading screen waits for: any to the API (a read, a purchase, a save…), but a background one (a
 * visit reported, a ping: BACKGROUND), which the player never notices.
 */
export function waitedFor(url: string, background: boolean): boolean {
  return !background && url.includes('/api/');
}

/**
 * Whether the site is waiting: a screen on its way (its code or its route) or a request to the API
 * (loadingInterceptor). The loading screen (<eras-loading-screen>) shows it once the wait passes SHOW_AFTER_MS (an
 * instant answer shows nothing), on every screen but the simulator.
 */
@Injectable({ providedIn: 'root' })
export class LoadingState {
  private readonly router = inject(Router);
  private readonly pending = signal(0);
  private readonly navigating = signal(false);
  private readonly url = signal(this.router.url);

  private readonly loading = computed(() => (this.pending() > 0 || this.navigating()) && !hasOwnLoading(this.url()));
  /** The loading screen is up. */
  readonly visible = signal(false);

  constructor() {
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        this.navigating.set(true);
        this.url.set(e.url);
      } else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        this.navigating.set(false);
        this.url.set(this.router.url);
      }
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());

    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let shownAt = 0;
    effect(() => {
      const loading = this.loading();
      const visible = this.visible();
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      if (loading && !visible) {
        showTimer = setTimeout(() => {
          shownAt = Date.now();
          this.visible.set(true);
        }, SHOW_AFTER_MS);
      } else if (!loading && visible) {
        hideTimer = setTimeout(() => this.visible.set(false), Math.max(0, SHOW_AT_LEAST_MS - (Date.now() - shownAt)));
      }
    });
  }

  start(): void {
    this.pending.update((n) => n + 1);
  }

  end(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }
}

/** Counts the requests the loading screen waits for (LoadingState). */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!waitedFor(req.url, req.context.get(BACKGROUND))) return next(req);
  const state = inject(LoadingState);
  state.start();
  return next(req).pipe(finalize(() => state.end()));
};
