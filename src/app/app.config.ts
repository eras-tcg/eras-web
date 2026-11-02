import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { onScreenTransition } from '@core/navigation/view-transitions';
import { serverInterceptor } from '@core/server/server.interceptor';
import { routes } from './app.routes';

// Dates and numbers in Spanish (DatePipe, DecimalPipe)
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Screens change with an animation (browsers without view transitions just swap them)
    provideRouter(routes, withComponentInputBinding(), withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: onScreenTransition })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, serverInterceptor])),
    { provide: LOCALE_ID, useValue: 'es' },
  ],
};
