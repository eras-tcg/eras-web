import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { PreloadingStrategy, Route } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { EMPTY, Observable, filter, switchMap, take, timer } from 'rxjs';

/**
 * The site's main screens: their code is fetched in the background once someone has signed in, so going to them
 * later shows them at once. The admin tools are left out (few use them).
 */
export const MAIN_SCREENS: ReadonlySet<string> = new Set([
  'home',
  'play',
  'missions',
  'social',
  'cards',
  'editions',
  'editions/:editionId',
  'booster-result',
  'profile',
  'public-decks',
  'my-decks',
  'deck/:id',
  'deck-builder',
  'tierlist',
  'ruling',
  'ranking',
  'simulator',
  'simulator/:roomId',
  'simulator/:roomId/board',
]);

/** How long after signing in (or after the first screen) the background fetching starts: the first screen goes first. */
export const PREFETCH_AFTER_MS = 1500;

/** Whether a route's screen is fetched ahead of time. */
export function preloads(route: Route): boolean {
  return !!route.path && MAIN_SCREENS.has(route.path);
}

/**
 * The router fetches the code of the main screens in the background, a moment after someone has signed in (nobody
 * signed in only sees the login).
 */
@Injectable({ providedIn: 'root' })
export class MainScreensPreloading implements PreloadingStrategy {
  private readonly signedIn = toObservable(inject(AuthService).user);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    // The shell (path '') holds the screens: it is passed through for its children
    if (route.path !== '' && !preloads(route)) return EMPTY;
    if (route.path === '') return load();
    return this.signedIn.pipe(
      filter((user) => !!user),
      take(1),
      switchMap(() => timer(PREFETCH_AFTER_MS)),
      switchMap(() => load()),
    );
  }
}
