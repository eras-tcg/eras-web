import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import { ApplicationConfig, LOCALE_ID, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { TitleStrategy, provideRouter, withComponentInputBinding, withPreloading, withViewTransitions } from '@angular/router';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { BusyState, busyInterceptor } from '@core/http/busy';
import { loadingInterceptor } from '@core/http/loading';
import { NEWS_LOG_DIALOG } from '@core/news/news-dialog';
import { MISSIONS_DIALOG } from '@core/missions/missions-dialog';
import { ErasTitleStrategy } from '@core/navigation/eras-title';
import { MainScreensPreloading } from '@core/navigation/preloading';
import { isNativeApp } from '@core/pwa/app-mode';
import { onScreenTransition } from '@core/navigation/view-transitions';
import { DataPrefetch } from '@data/prefetch/data-prefetch';
import { CardsStore } from '@data/cards/cards.store';
import { CARD_SHINE, imageKey, shineUrlOf } from '@ui/domain/card-image/card-shine';
import { connectionGateInterceptor } from '@core/server/connection-gate.interceptor';
import { serverInterceptor } from '@core/server/server.interceptor';
import { routes } from './app.routes';

// Dates and numbers in Spanish (DatePipe, DecimalPipe)
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The tab is always named ERAS (the routes' titles never reach it)
    { provide: TitleStrategy, useClass: ErasTitleStrategy },
    // Screens change with an animation (browsers without view transitions just swap them)
    // The main screens' code is fetched in the background once someone signs in (MainScreensPreloading)
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(MainScreensPreloading),
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: onScreenTransition }),
    ),
    // The installed app asks the server nothing before connecting (local-first): the gate goes first
    provideHttpClient(withFetch(), withInterceptors([connectionGateInterceptor, authInterceptor, serverInterceptor, busyInterceptor, loadingInterceptor])),
    // The buttons hold while a change is on its way: listening from the first click on
    provideAppInitializer(() => void inject(BusyState)),
    // The data most screens use, read in the background after signing in
    provideAppInitializer(() => void inject(DataPrefetch)),
    { provide: LOCALE_ID, useValue: 'es' },
    // The card pictures find their still shine through the catalog (any image of a card that has one)
    {
      provide: CARD_SHINE,
      useFactory: () => {
        const cards = inject(CardsStore);
        return (url: string | null | undefined) => cards.shineByImage().get(imageKey(url)) ?? shineUrlOf(url);
      },
    },
    // Installable and playable offline (ngsw + the card pictures' cache, public/eras-sw.js). Registered once the app
    // is stable (at most 30 s after starting), so it never competes with the first screen. Not in the Android app: its
    // code is in the APK (it keeps only the card pictures' worker, NativeApp)
    provideServiceWorker('eras-sw.js', { enabled: !isDevMode() && !isNativeApp(), registrationStrategy: 'registerWhenStable:30000' }),
    // The quick button «Misiones» off the hub menus opens them as a dialog
    { provide: MISSIONS_DIALOG, useValue: () => import('@features/home/missions-dialog.component').then((m) => m.MissionsDialogComponent) },
    // The bar's bell: the news log
    { provide: NEWS_LOG_DIALOG, useValue: () => import('@features/home/news-log-dialog.component').then((m) => m.NewsLogDialogComponent) },
  ],
};
