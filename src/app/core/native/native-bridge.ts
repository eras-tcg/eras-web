import { CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { PICTURES_WORKER_URL } from '../pwa/app-offline';
import { APP_VERSION } from '../version/app-version';
import {
  type UpdateAttempts,
  mayTry,
  parseManifest,
  pendingBundle,
  planUpdate,
  recordAttempt,
  settleAttempts,
  shouldCheck,
} from './app-update';

/**
 * The Android app's native side, loaded only there (its own chunk: the site never downloads @capacitor/* code).
 * - Back button: closes an open dialog, goes back a screen, and leaves the app from the hub.
 * - The card pictures' service worker (eras-pictures-sw.js): the app's code is in the APK, the pictures come from the
 *   image host and are kept (OfflinePicturesAuto fills the same cache) for playing without the connection.
 * - Updates (app-update.ts): reads the site's /app/app-update.json (a static file on the CDN: it never wakes the
 *   backend) on start and every hour while used; downloads a newer web part (the updater checks its SHA-256) and hands
 *   it to VersionService, which switches to it on a safe screen (never during a game) or on the next start; a web
 *   part that does not start (no notifyAppReady) is rolled back by the updater. An APK too old for the published web
 *   part shows "Hay una nueva versión de la app".
 */
export interface NativeHooks {
  /** The public site (https://www.erastcg.com). */
  siteUrl: string;
  /** Live updates of the web part (environment.liveUpdates); off, it only tells when a new APK is needed. */
  liveUpdates: boolean;
  /** A downloaded web part is ready: `apply` switches to it (reloads the page). */
  webUpdateReady(version: string, apply: () => Promise<void>): void;
  /** This APK is too old: the new one is at `apk`. */
  nativeUpdateNeeded(apk: string): void;
  /** The current screen's URL (the router's). */
  url(): string;
}

const ATTEMPTS_KEY = 'eras-app-update-attempts';
const LAST_CHECK_KEY = 'eras-app-update-checked';

export async function startNativeBridge(hooks: NativeHooks): Promise<void> {
  // First of all: this web part started (without it the updater would roll back to the previous one)
  await CapacitorUpdater.notifyAppReady().catch(() => undefined);
  listenBackButton(hooks);
  void navigator.serviceWorker?.register(PICTURES_WORKER_URL).catch(() => undefined);
  writeAttempts(settleAttempts(readAttempts(), APP_VERSION));
  if (hooks.liveUpdates) await offerDownloaded(hooks);
  const check = () => void checkForUpdate(hooks).catch(() => undefined);
  check();
  void App.addListener('resume', check);
}

function listenBackButton(hooks: NativeHooks): void {
  void App.addListener('backButton', ({ canGoBack }) => {
    // An open dialog closes first (the CDK dialogs close on Escape)
    if (document.querySelector('.cdk-overlay-container .cdk-dialog-container')) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return;
    }
    const path = hooks.url().split(/[?#]/)[0];
    if (!canGoBack || path === '/' || path === '/home' || path === '') {
      void App.exitApp();
      return;
    }
    history.back();
  });
}

/** A web part downloaded earlier (and not started yet; `version`: only that one): offered at once, without the network. */
async function offerDownloaded(hooks: NativeHooks, version?: string): Promise<boolean> {
  const { bundles } = await CapacitorUpdater.list().catch(() => ({ bundles: [] }));
  const bundle = pendingBundle(bundles, APP_VERSION, readAttempts());
  if (!bundle || (version && bundle.version !== version)) return false;
  hooks.webUpdateReady(bundle.version, async () => {
    writeAttempts(recordAttempt(readAttempts(), bundle.version));
    await CapacitorUpdater.set({ id: bundle.id });
  });
  return true;
}

let checking = false;

async function checkForUpdate(hooks: NativeHooks): Promise<void> {
  const now = Date.now();
  if (checking || !shouldCheck({ online: navigator.onLine !== false, lastCheck: readNumber(LAST_CHECK_KEY), now })) return;
  checking = true;
  try {
    // Native HTTP: the CDN's static file needs no CORS this way
    const response = await CapacitorHttp.get({
      url: `${hooks.siteUrl}/app/app-update.json?t=${now}`,
      headers: { 'Cache-Control': 'no-cache' },
      responseType: 'json',
      connectTimeout: 10_000,
      readTimeout: 10_000,
    });
    if (response.status !== 200) return;
    writeNumber(LAST_CHECK_KEY, now);
    const manifest = parseManifest(typeof response.data === 'string' ? JSON.parse(response.data) : response.data);
    if (!manifest) return;
    const info = await App.getInfo();
    const plan = planUpdate(manifest, { webVersion: APP_VERSION, nativeVersionCode: Number(info.build) || 0 });
    if (plan.kind === 'native') hooks.nativeUpdateNeeded(plan.apk);
    if (plan.kind !== 'web' || !hooks.liveUpdates || !mayTry(readAttempts(), plan.version)) return;
    if (await offerDownloaded(hooks, plan.version)) return;
    // Downloaded and checked natively (SHA-256 of the zip against the manifest's); kept until it is switched to
    await CapacitorUpdater.download({ url: plan.url, version: plan.version, checksum: plan.sha256 });
    await offerDownloaded(hooks, plan.version);
  } finally {
    checking = false;
  }
}

function readAttempts(): UpdateAttempts | null {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    return raw ? (JSON.parse(raw) as UpdateAttempts) : null;
  } catch {
    return null;
  }
}

function writeAttempts(attempts: UpdateAttempts | null): void {
  try {
    if (attempts) localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
    else localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // no storage: attempts are not limited
  }
}

function readNumber(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // checked again next time
  }
}
