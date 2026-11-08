import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Where the site opens when it starts without the connection (the installed app, offline): the home's news, editions
 * and missions need the server, so it opens on "Jugar", where "Modo solo sin conexión" is. Only the first screen of a
 * visit: going to the home afterwards still shows it.
 */
export function offlineLaunchTarget(input: { firstNavigation: boolean; online: boolean; signedIn: boolean }): string | null {
  return input.firstNavigation && !input.online && input.signedIn ? '/play' : null;
}

/** On the home route: an offline start goes to "Jugar" (offlineLaunchTarget). */
export const offlineLaunchGuard: CanActivateFn = () => {
  const router = inject(Router);
  const target = offlineLaunchTarget({
    firstNavigation: !router.navigated,
    online: typeof navigator === 'undefined' || navigator.onLine !== false,
    signedIn: inject(AuthService).isAuthenticated(),
  });
  return target ? router.createUrlTree([target]) : true;
};
