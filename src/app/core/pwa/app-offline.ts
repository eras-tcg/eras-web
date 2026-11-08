import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** The service worker's script (public/eras-sw.js: ngsw plus the card pictures' cache). */
export const SERVICE_WORKER_URL = 'eras-sw.js';

/** The part of ngsw.json read here: each asset group's files and whether they are downloaded on install. */
interface NgswManifest {
  assetGroups?: { name: string; installMode: 'prefetch' | 'lazy'; urls: string[] }[];
}

/** How much of the app (its code, the engine and its data) the service worker already keeps. */
export interface AppReadiness {
  /** Service workers work here (a production build, a secure context, a browser that has them). */
  supported: boolean;
  cached: number;
  total: number;
  ready: boolean;
}

/** The files ngsw downloads on installing (its prefetch groups: the app's code, fonts, the card back, /engine/*.json). */
export function prefetchedUrls(manifest: NgswManifest): string[] {
  return (manifest.assetGroups ?? []).filter((g) => g.installMode === 'prefetch').flatMap((g) => g.urls);
}

/**
 * The app as the service worker keeps it for offline: it registers the service worker now when the player asks for
 * offline play (instead of waiting for the app to settle, registerWhenStable) and tells how much is already kept.
 */
@Injectable({ providedIn: 'root' })
export class AppOffline {
  private readonly sw = inject(SwUpdate, { optional: true });

  get supported(): boolean {
    return !!this.sw?.isEnabled && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  }

  /** Registers the service worker if it is not yet (the same script as provideServiceWorker: no second worker). */
  async ensureRegistered(): Promise<void> {
    if (!this.supported) return;
    try {
      const existing = await navigator.serviceWorker.getRegistration();
      if (!existing) await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    } catch {
      // Refused (private window, blocked): the app just will not open offline
    }
  }

  /** How much of what ngsw downloads on installing is already in its caches. */
  async readiness(): Promise<AppReadiness> {
    if (!this.supported || typeof caches === 'undefined') return { supported: false, cached: 0, total: 0, ready: false };
    let urls: string[];
    try {
      const response = await fetch(new URL('ngsw.json?ngsw-bypass=1', document.baseURI), { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      urls = prefetchedUrls((await response.json()) as NgswManifest);
    } catch {
      // Offline: a page the service worker serves has its app
      const ready = !!navigator.serviceWorker.controller;
      return { supported: true, cached: ready ? 1 : 0, total: 1, ready };
    }
    const found = await Promise.all(urls.map((url) => caches.match(new URL(url, document.baseURI).href, { ignoreSearch: true })));
    const cached = found.filter(Boolean).length;
    return { supported: true, cached, total: urls.length, ready: urls.length > 0 && cached === urls.length };
  }
}
