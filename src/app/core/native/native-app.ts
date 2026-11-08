import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@env';
import { siteOrigin } from '../http/api-config';
import { isNativeApp } from '../pwa/app-mode';
import { VersionService } from '../version/version.service';

/**
 * The Android app (Capacitor), started by the App: nothing happens on the site. Its native side (native-bridge.ts,
 * @capacitor/*) is its own chunk, loaded only here: the back button, the updates (they reach VersionService, which
 * shows and applies them as the PWA's), and the card pictures' service worker (the app's code is in the APK, but the
 * pictures come from the image host and are kept for playing offline).
 */
@Injectable({ providedIn: 'root' })
export class NativeApp {
  readonly native = isNativeApp();
  private readonly version = inject(VersionService);
  private readonly router = inject(Router);
  private started = false;

  start(): void {
    if (!this.native || this.started) return;
    this.started = true;
    void import('./native-bridge')
      .then(({ startNativeBridge }) =>
        startNativeBridge({
          siteUrl: siteOrigin(),
          liveUpdates: environment.liveUpdates === true,
          webUpdateReady: (_version, apply) => this.version.nativeUpdateReady(apply),
          nativeUpdateNeeded: (apk) => this.version.appUpdate.set(apk),
          url: () => this.router.url,
        }),
      )
      .catch((e: unknown) => console.error('ERAS app', e));
  }
}
