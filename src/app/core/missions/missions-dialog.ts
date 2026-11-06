import { InjectionToken, Type } from '@angular/core';

/**
 * Loads the missions dialog (a feature, which core cannot import): the quick button «Misiones» opens it on the
 * screens that are not hub menus. Provided in app.config.
 */
export const MISSIONS_DIALOG = new InjectionToken<() => Promise<Type<unknown>>>('MISSIONS_DIALOG');
