import { Injectable, signal } from '@angular/core';
import { isNativeApp } from './app-mode';
import { isAndroid } from './install-prompt';

/** Where the site publishes the Android app (the CI's android job; the deploy uploads it with the site). */
export const ANDROID_APP_MANIFEST = 'app/app-update.json';

/**
 * Whether the site offers "Descargar la app para Android": on an Android phone or tablet, in the browser or the
 * installed PWA (not inside the app itself), and only when the site publishes an APK (the deploy may carry none:
 * no signing key yet).
 */
export function offersAndroidApp(state: { android: boolean; native: boolean; apk: string | null }): boolean {
  return state.android && !state.native && !!state.apk;
}

/** The APK's address in the published manifest (same site), or null. */
export function publishedApk(manifest: unknown, base = 'https://www.erastcg.com/'): string | null {
  const apk = (manifest as { apk?: unknown } | null)?.apk;
  if (typeof apk !== 'string' || !/\.apk(?:[?#]|$)/.test(apk)) return null;
  try {
    // Downloaded from this site (the manifest names the public site; staging serves its own copy)
    return new URL(apk, base).pathname;
  } catch {
    return null;
  }
}

/** "Descargar la app para Android": looked up once, on Android only, when "Jugar" shows. */
@Injectable({ providedIn: 'root' })
export class AndroidApp {
  readonly android = typeof navigator !== 'undefined' && isAndroid(navigator.userAgent) && !isNativeApp();
  /** The APK on this site (a path), once known. */
  readonly apk = signal<string | null>(null);
  private looked = false;

  lookUp(): void {
    if (!this.android || this.looked) return;
    this.looked = true;
    fetch(new URL(ANDROID_APP_MANIFEST, document.baseURI), { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest: unknown) => this.apk.set(publishedApk(manifest)))
      .catch(() => {
        this.looked = false;
      });
  }
}
