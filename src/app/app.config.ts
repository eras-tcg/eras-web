import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading, withViewTransitions } from '@angular/router';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { BusyState, busyInterceptor } from '@core/http/busy';
import { loadingInterceptor } from '@core/http/loading';
import { MISSIONS_DIALOG } from '@core/missions/missions-dialog';
import { MainScreensPreloading } from '@core/navigation/preloading';
import { onScreenTransition } from '@core/navigation/view-transitions';
import { DataPrefetch } from '@data/prefetch/data-prefetch';
import { serverInterceptor } from '@core/server/server.interceptor';
import { routes } from './app.routes';

// Dates and numbers in Spanish (DatePipe, DecimalPipe)
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Screens change with an animation (browsers without view transitions just swap them)
    // The main screens' code is fetched in the background once someone signs in (MainScreensPreloading)
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(MainScreensPreloading),
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: onScreenTransition }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, serverInterceptor, busyInterceptor, loadingInterceptor])),
    // The buttons hold while a change is on its way: listening from the first click on
    provideAppInitializer(() => void inject(BusyState)),
    // The data most screens use, read in the background after signing in
    provideAppInitializer(() => void inject(DataPrefetch)),
    { provide: LOCALE_ID, useValue: 'es' },
    // The quick button «Misiones» off the hub menus opens them as a dialog
    { provide: MISSIONS_DIALOG, useValue: () => import('@features/home/missions-dialog.component').then((m) => m.MissionsDialogComponent) },
  ],
};
