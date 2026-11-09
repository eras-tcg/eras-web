import {
  CHECK_EVERY_MS,
  MAX_ATTEMPTS,
  compareVersions,
  mayTry,
  parseManifest,
  pendingBundle,
  planUpdate,
  recordAttempt,
  settleAttempts,
  shouldCheck,
  versionCode,
  type AppUpdateManifest,
} from './app-update';

const SHA = 'a'.repeat(64);
const manifest = (over: Partial<AppUpdateManifest> = {}): AppUpdateManifest => ({
  version: '2.7.1',
  url: 'https://www.erastcg.com/app/web-2.7.1.zip',
  sha256: SHA,
  minNativeVersion: 20700,
  apk: 'https://www.erastcg.com/app/ERAS.apk',
  apkVersion: '2.7.1',
  apkVersionCode: 20701,
  ...over,
});

describe('parseManifest', () => {
  it('takes the published manifest', () => {
    expect(parseManifest(manifest())).toEqual(manifest());
    expect(parseManifest({ ...manifest(), apkVersion: undefined, apkVersionCode: undefined })).toEqual({
      ...manifest(),
      apkVersion: undefined,
      apkVersionCode: undefined,
    });
  });

  it('refuses what is not one: a malformed version or checksum, plain http, a missing native version', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest('x')).toBeNull();
    expect(parseManifest({ ...manifest(), version: '2.7' })).toBeNull();
    expect(parseManifest({ ...manifest(), sha256: 'ABC' })).toBeNull();
    expect(parseManifest({ ...manifest(), sha256: SHA.toUpperCase() })).toBeNull();
    expect(parseManifest({ ...manifest(), url: 'http://www.erastcg.com/app/web.zip' })).toBeNull();
    expect(parseManifest({ ...manifest(), apk: '/app/ERAS.apk' })).toBeNull();
    expect(parseManifest({ ...manifest(), minNativeVersion: undefined })).toBeNull();
    expect(parseManifest({ ...manifest(), minNativeVersion: 1.5 })).toBeNull();
  });
});

describe('versions', () => {
  it('compares MAIN.FEATURES.FIXES by number, not as text', () => {
    expect(compareVersions('2.7.0', '2.7.0')).toBe(0);
    expect(compareVersions('2.7.1', '2.7.0')).toBeGreaterThan(0);
    expect(compareVersions('2.10.0', '2.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.6.9', '3.0.0')).toBeLessThan(0);
  });

  it("derives the APK's versionCode from its versionName (as build.gradle does)", () => {
    expect(versionCode('2.7.0')).toBe(20700);
    expect(versionCode('2.10.3')).toBe(21003);
    expect(versionCode('3.0.0')).toBe(30000);
  });
});

describe('planUpdate', () => {
  it('a newer web part this APK can run: a live update', () => {
    expect(planUpdate(manifest(), { webVersion: '2.7.0', nativeVersionCode: 20700 })).toEqual({
      kind: 'web',
      version: '2.7.1',
      url: manifest().url,
      sha256: SHA,
    });
  });

  it('the same or an older web part: nothing (a rolled back or newer APK keeps what it has)', () => {
    expect(planUpdate(manifest(), { webVersion: '2.7.1', nativeVersionCode: 20700 })).toEqual({ kind: 'none' });
    expect(planUpdate(manifest(), { webVersion: '2.8.0', nativeVersionCode: 20800 })).toEqual({ kind: 'none' });
  });

  it('an APK older than minNativeVersion: the new APK, never the web part it cannot run', () => {
    const m = manifest({ version: '2.8.0', minNativeVersion: 20800, apkVersion: '2.8.0', apkVersionCode: 20800 });
    expect(planUpdate(m, { webVersion: '2.7.0', nativeVersionCode: 20700 })).toEqual({ kind: 'native', apk: m.apk, version: '2.8.0' });
    expect(planUpdate(m, { webVersion: '2.8.0', nativeVersionCode: 20800 })).toEqual({ kind: 'none' });
  });

  it('a published APK that is not newer than this one is not offered', () => {
    const m = manifest({ minNativeVersion: 20800, apkVersionCode: 20700 });
    expect(planUpdate(m, { webVersion: '2.7.0', nativeVersionCode: 20700 })).toEqual({ kind: 'none' });
  });
});

describe('when to check', () => {
  it('online, once an hour at most (the manifest is a file on the CDN: the backend is never woken)', () => {
    expect(shouldCheck({ online: true, lastCheck: null, now: 1000 })).toBe(true);
    expect(shouldCheck({ online: false, lastCheck: null, now: 1000 })).toBe(false);
    expect(shouldCheck({ online: true, lastCheck: 1000, now: 1000 + CHECK_EVERY_MS - 1 })).toBe(false);
    expect(shouldCheck({ online: true, lastCheck: 1000, now: 1000 + CHECK_EVERY_MS })).toBe(true);
  });
});

describe('attempts (a web part that does not start is rolled back, and not tried forever)', () => {
  it(`tries a version ${MAX_ATTEMPTS} times at most`, () => {
    let attempts = recordAttempt(null, '2.7.1');
    expect(mayTry(attempts, '2.7.1')).toBe(true);
    attempts = recordAttempt(attempts, '2.7.1');
    expect(attempts).toEqual({ version: '2.7.1', count: 2 });
    expect(mayTry(attempts, '2.7.1')).toBe(false);
    // A newer version starts over
    expect(mayTry(attempts, '2.7.2')).toBe(true);
    expect(recordAttempt(attempts, '2.7.2')).toEqual({ version: '2.7.2', count: 1 });
  });

  it('forgets them once that version (or a newer one) runs', () => {
    expect(settleAttempts({ version: '2.7.1', count: 1 }, '2.7.1')).toBeNull();
    expect(settleAttempts({ version: '2.7.1', count: 1 }, '2.8.0')).toBeNull();
    expect(settleAttempts({ version: '2.7.1', count: 1 }, '2.7.0')).toEqual({ version: '2.7.1', count: 1 });
    expect(settleAttempts(null, '2.7.0')).toBeNull();
  });
});

describe('pendingBundle', () => {
  const bundles = [
    { id: 'builtin', version: 'builtin', status: 'success' },
    { id: 'a', version: '2.7.1', status: 'pending' },
    { id: 'b', version: '2.7.2', status: 'error' },
    { id: 'c', version: '2.6.0', status: 'success' },
  ];

  it('the newest downloaded web part newer than the running one, that did not fail', () => {
    expect(pendingBundle(bundles, '2.7.0', null)?.id).toBe('a');
    expect(pendingBundle([...bundles, { id: 'd', version: '2.7.3', status: 'success' }], '2.7.0', null)?.id).toBe('d');
    expect(pendingBundle(bundles, '2.7.1', null)).toBeNull();
    expect(pendingBundle([], '2.7.0', null)).toBeNull();
  });

  it('not one tried too many times', () => {
    expect(pendingBundle(bundles, '2.7.0', { version: '2.7.1', count: MAX_ATTEMPTS })).toBeNull();
  });
});
