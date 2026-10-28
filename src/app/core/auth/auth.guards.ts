import { inject } from '@angular/core';
import { CanActivateChildFn, CanMatchFn, Router } from '@angular/router';
import { Permission } from './auth.model';
import { AuthService } from './auth.service';

/** Pages reachable without a session; everything else needs one. */
export const PUBLIC_PATHS = ['login', 'validate'];

/** Route only for signed-in users; others go to /login and come back after signing in. */
export const authGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  return inject(Router).createUrlTree(['/login'], { queryParams: returnUrl !== '/' ? { returnUrl } : {} });
};

/** Whole-site guard (on the shell's children): the site needs a session except for the account pages. */
export const loginRequiredGuard: CanActivateChildFn = (_route, state) => {
  const path = state.url.split(/[?#]/)[0].replace(/^\//, '').split('/')[0];
  if (PUBLIC_PATHS.includes(path) || inject(AuthService).isAuthenticated()) return true;
  const returnUrl = state.url === '/' || state.url === '/home' ? undefined : state.url;
  return inject(Router).createUrlTree(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
};

/** Account pages make no sense with a session: go home. */
export const guestGuard: CanMatchFn = () => !inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/home']);

/** Route only for users with any of the given permissions. */
export function permissionGuard(...permissions: Permission[]): CanMatchFn {
  return () => {
    const auth = inject(AuthService);
    if (permissions.some((p) => auth.can(p))) return true;
    return inject(Router).createUrlTree([auth.isAuthenticated() ? '/' : '/login']);
  };
}
