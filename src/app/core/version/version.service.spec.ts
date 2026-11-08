import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { VersionService, inGame, versionBanner } from './version.service';

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

  it('a downloaded version is announced, never activated by itself', async () => {
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
