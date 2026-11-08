import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { VersionService, inGame, safeToUpdate, versionBanner } from './version.service';

describe('versionBanner', () => {
  it('a new version waits until the player leaves the table (online or offline game)', () => {
    expect(versionBanner({ updateAvailable: true, broken: false, url: '/home' })).toBe('update');
    expect(versionBanner({ updateAvailable: true, broken: false, url: '/simulator/local/board' })).toBeNull();
    expect(versionBanner({ updateAvailable: true, broken: false, url: '/simulator/abc/board?x=1' })).toBeNull();
    expect(versionBanner({ updateAvailable: true, broken: false, url: '/simulator/abc' })).toBe('update');
    expect(versionBanner({ updateAvailable: false, broken: false, url: '/home' })).toBeNull();
  });

  it('a broken version is said everywhere', () => {
    expect(versionBanner({ updateAvailable: false, broken: true, url: '/simulator/local/board' })).toBe('broken');
  });

  it('knows the table', () => {
    expect(inGame('/simulator/local/board')).toBe(true);
    expect(inGame('/simulator')).toBe(false);
    expect(inGame('/play')).toBe(false);
  });
});

describe('safeToUpdate', () => {
  it('reloads by itself on the hub screens, never over a game, the deck builder or a pack opening', () => {
    for (const url of ['/home', '/play', '/social', '/my-decks', '/cards', '/profile?tab=x', '/', '/missions']) {
      expect(safeToUpdate(url), url).toBe(true);
    }
    for (const url of ['/simulator/local/board', '/simulator/abc', '/deck-builder', '/deck/42', '/booster-result', '/admin', '']) {
      expect(safeToUpdate(url), url).toBe(false);
    }
  });
});

describe('VersionService with the service worker', () => {
  const versionUpdates = new Subject<VersionEvent>();
  const unrecoverable = new Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>();
  const sw = {
    isEnabled: true,
    versionUpdates,
    unrecoverable,
    checkForUpdate: vi.fn(() => Promise.resolve(true)),
    activateUpdate: vi.fn(() => Promise.resolve(true)),
  };
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: sw }] });
    reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: {} } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('a downloaded version is announced; start alone activates nothing', async () => {
    const version = TestBed.inject(VersionService);
    version.start();
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    expect(version.updateAvailable()).toBe(false);
    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });
    expect(version.updateAvailable()).toBe(true);
    expect(sw.activateUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    await version.reload();
    expect(sw.activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it('takes a ready version by itself on a safe screen, once, and not over a game', async () => {
    sessionStorage.clear();
    const version = TestBed.inject(VersionService);
    version.start();
    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });
    expect(await version.applyWhenSafe('/simulator/local/board')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(await version.applyWhenSafe('/play')).toBe(true);
    expect(sw.activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await version.applyWhenSafe('/home')).toBe(false); // already applying
  });

  it('never reloads by itself twice within a minute (a failing version cannot loop)', async () => {
    sessionStorage.setItem('eras-auto-reload', String(Date.now()));
    const version = TestBed.inject(VersionService);
    version.start();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'lost' });
    expect(await version.applyWhenSafe('/home')).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    sessionStorage.clear();
  });

  it('checks right away when it starts', () => {
    sw.checkForUpdate.mockClear();
    TestBed.inject(VersionService).start();
    expect(sw.checkForUpdate).toHaveBeenCalled();
  });

  it('asks the service worker (not index.html) when checking', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const version = TestBed.inject(VersionService);
    await version.check();
    expect(sw.checkForUpdate).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an unrecoverable state asks for a reload', () => {
    const version = TestBed.inject(VersionService);
    version.start();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'lost' });
    expect(version.broken()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('VersionService in the Android app', () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    (window as unknown as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'Capacitor');
  });

  it('does not look at the bundled page for new versions (the updater does)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    TestBed.inject(VersionService).start();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("switches to the updater's web part on a safe screen, never over a game", async () => {
    const version = TestBed.inject(VersionService);
    version.start();
    const apply = vi.fn(() => Promise.resolve());
    version.nativeUpdateReady(apply);
    expect(version.updateAvailable()).toBe(true);
    expect(await version.applyWhenSafe('/simulator/local/board')).toBe(false);
    expect(await version.applyWhenSafe('/deck-builder')).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(await version.applyWhenSafe('/play')).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    // The updater reloads the page itself
    expect(reload).not.toHaveBeenCalled();
  });

  it('a newer APK needed: its banner, not over a game, after a ready web part', () => {
    expect(versionBanner({ updateAvailable: false, broken: false, url: '/home', appUpdate: true })).toBe('app');
    expect(versionBanner({ updateAvailable: false, broken: false, url: '/simulator/local/board', appUpdate: true })).toBeNull();
    expect(versionBanner({ updateAvailable: true, broken: false, url: '/home', appUpdate: true })).toBe('update');
    expect(versionBanner({ updateAvailable: false, broken: false, url: '/home', appUpdate: false })).toBeNull();
  });
});
