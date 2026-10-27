import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Permission } from './auth.model';
import { AuthService } from './auth.service';

/** Route only for signed-in users; others go to /login. */
export const authGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() || inject(Router).createUrlTree(['/login']);
};

/** Route only for users with the given permission. */
export function permissionGuard(permission: Permission): CanMatchFn {
  return () => {
    const auth = inject(AuthService);
    if (auth.can(permission)) return true;
    return inject(Router).createUrlTree([auth.isAuthenticated() ? '/' : '/login']);
  };
}
