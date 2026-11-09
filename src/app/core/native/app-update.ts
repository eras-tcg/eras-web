/**
 * The Android app's updates (pure: the decisions; native-bridge.ts does the work). The site publishes, next to the
 * page, `/app/app-update.json` (scripts/app-update.mjs writes it in CI):
 * - `version`, `url`, `sha256`: the web part of the app (the Capacitor build, zipped), taken without reinstalling
 *   (a live update: downloaded, its SHA-256 checked, applied on a safe screen or the next start, rolled back if it
 *   does not start);
 * - `minNativeVersion`: the oldest APK (its versionCode) that can run that web part; an older APK asks for the new one
 *   (`apk`), as anything native (Java, the manifest, plugins) only changes with a new APK.
 */
export interface AppUpdateManifest {
  version: string;
  url: string;
  sha256: string;
  minNativeVersion: number;
  apk: string;
  apkVersion?: string;
  apkVersionCode?: number;
}

const VERSION = /^\d+\.\d+\.\d+$/;
const SHA256 = /^[0-9a-f]{64}$/;

/** The manifest as published, or null when it is not one (missing fields, not https, a malformed checksum). */
export function parseManifest(raw: unknown): AppUpdateManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const https = (v: unknown): v is string => typeof v === 'string' && /^https:\/\/[^/\s]+\/\S*$/.test(v);
  if (typeof m['version'] !== 'string' || !VERSION.test(m['version'])) return null;
  if (!https(m['url']) || !https(m['apk'])) return null;
  if (typeof m['sha256'] !== 'string' || !SHA256.test(m['sha256'])) return null;
  if (!Number.isInteger(m['minNativeVersion']) || (m['minNativeVersion'] as number) < 1) return null;
  return {
    version: m['version'],
    url: m['url'],
    sha256: m['sha256'],
    minNativeVersion: m['minNativeVersion'] as number,
    apk: m['apk'],
    apkVersion: typeof m['apkVersion'] === 'string' ? m['apkVersion'] : undefined,
    apkVersionCode: Number.isInteger(m['apkVersionCode']) ? (m['apkVersionCode'] as number) : undefined,
  };
}

/** Compares two MAIN.FEATURES.FIXES versions: negative, 0 or positive. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** An APK's versionCode from its versionName (2.7.0 → 20700), as android/app/build.gradle derives it. */
export function versionCode(version: string): number {
  const [major, minor, fixes] = version.split('.').map(Number);
  return major * 10_000 + minor * 100 + fixes;
}

/** What to do with the published manifest. */
export type UpdatePlan =
  | { kind: 'none' }
  /** This APK is too old for the published web part: the player installs the new APK. */
  | { kind: 'native'; apk: string; version?: string }
  /** A newer web part this APK can run: downloaded and applied without reinstalling. */
  | { kind: 'web'; version: string; url: string; sha256: string };

export function planUpdate(manifest: AppUpdateManifest, app: { webVersion: string; nativeVersionCode: number }): UpdatePlan {
  if (manifest.minNativeVersion > app.nativeVersionCode) {
    // An APK that is not newer than this one would not help (a manifest published before its APK)
    if (manifest.apkVersionCode !== undefined && manifest.apkVersionCode <= app.nativeVersionCode) return { kind: 'none' };
    return { kind: 'native', apk: manifest.apk, version: manifest.apkVersion };
  }
  if (compareVersions(manifest.version, app.webVersion) > 0) {
    return { kind: 'web', version: manifest.version, url: manifest.url, sha256: manifest.sha256 };
  }
  return { kind: 'none' };
}

/** How often the app looks for an update while it stays open (and on coming back from the background). */
export const CHECK_EVERY_MS = 60 * 60_000;

/** Whether to look for an update now: online, and not looked for in the last CHECK_EVERY_MS. */
export function shouldCheck(state: { online: boolean; lastCheck: number | null; now: number }): boolean {
  return state.online && (state.lastCheck === null || state.now - state.lastCheck >= CHECK_EVERY_MS);
}

/** The web versions tried and how many times each (a version that does not start is rolled back by the updater). */
export interface UpdateAttempts {
  version: string;
  count: number;
}

/** A version is tried at most this many times: one that keeps failing to start is not downloaded again and again. */
export const MAX_ATTEMPTS = 2;

export function mayTry(attempts: UpdateAttempts | null, version: string): boolean {
  return !attempts || attempts.version !== version || attempts.count < MAX_ATTEMPTS;
}

/** Applying `version` once more. */
export function recordAttempt(attempts: UpdateAttempts | null, version: string): UpdateAttempts {
  return { version, count: attempts?.version === version ? attempts.count + 1 : 1 };
}

/** The attempts after starting `running`: a version that started is done with (its attempts are forgotten). */
export function settleAttempts(attempts: UpdateAttempts | null, running: string): UpdateAttempts | null {
  return attempts && compareVersions(attempts.version, running) <= 0 ? null : attempts;
}

/** A bundle the updater keeps: its id, version and state. */
export interface KeptBundle {
  id: string;
  version: string;
  status: string;
}

/**
 * The downloaded web part to switch to: the newest kept bundle newer than the running one that did not fail
 * (status 'pending': downloaded, never started; 'success': started before), and that may still be tried.
 */
export function pendingBundle(bundles: readonly KeptBundle[], running: string, attempts: UpdateAttempts | null): KeptBundle | null {
  const candidates = bundles.filter(
    (b) => VERSION.test(b.version) && (b.status === 'pending' || b.status === 'success') && compareVersions(b.version, running) > 0 && mayTry(attempts, b.version),
  );
  candidates.sort((a, b) => compareVersions(b.version, a.version));
  return candidates[0] ?? null;
}
