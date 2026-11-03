import { DestroyRef, effect, inject, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BusyState } from '../http/busy';

/** A new screen reloads at most this often (a change sent by the player always does). */
const SCREEN_RELOAD_MS = 10_000;

/**
 * Keeps a missions store up to date with what advanced it elsewhere: after every change the player sends (a deck
 * saved, a pack opened, a claim…: BusyState.changes) and on a new screen (a game played, a page visited), so the
 * quick buttons' count and the missions screen agree. Only once it has loaded; several triggers make one reload.
 * Call it in the store's constructor.
 */
export function reloadOnProgress(load: () => unknown, loaded: () => boolean): void {
  const busy = inject(BusyState);
  const router = inject(Router);
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const request = () => {
    if (!loaded()) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      last = Date.now();
      void load();
    }, 400);
  };

  effect(() => {
    if (busy.changes() > 0) untracked(request);
  });
  const sub = router.events.subscribe((event) => {
    if (event instanceof NavigationEnd && Date.now() - last > SCREEN_RELOAD_MS) request();
  });
  inject(DestroyRef).onDestroy(() => {
    sub.unsubscribe();
    clearTimeout(timer);
  });
}
