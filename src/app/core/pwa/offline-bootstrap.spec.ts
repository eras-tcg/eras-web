import { TestBed } from '@angular/core/testing';
import { offlineLaunchTarget } from './offline-launch';
import { costlyConnection, formatBytes } from './device-storage';
import { prefetchedUrls } from './app-offline';
import { ServerWarmupService, WAKE_URL } from '../server/server-warmup.service';

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
}

describe('offlineLaunchTarget', () => {
  it('an offline start goes to "Jugar"; online, or later in the visit, nothing changes', () => {
    expect(offlineLaunchTarget({ firstNavigation: true, online: false, signedIn: true })).toBe('/play');
    expect(offlineLaunchTarget({ firstNavigation: true, online: true, signedIn: true })).toBeNull();
    expect(offlineLaunchTarget({ firstNavigation: false, online: false, signedIn: true })).toBeNull();
    expect(offlineLaunchTarget({ firstNavigation: true, online: false, signedIn: false })).toBeNull();
  });
});

describe('ServerWarmupService offline (a backend that sleeps)', () => {
  afterEach(() => {
    setOnline(true);
    vi.unstubAllGlobals();
  });

  async function warmup() {
    TestBed.configureTestingModule({ providers: [{ provide: WAKE_URL, useValue: '/wake' }] });
    return TestBed.inject(ServerWarmupService);
  }

  it('started offline: the site shows at once, nothing is asked, and it checks again when the connection is back', async () => {
    setOnline(false);
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('', { status: 200 })));
    vi.stubGlobal('fetch', fetchSpy);
    const service = await warmup();
    await service.start();
    expect(service.state()).toBe('offline');
    expect(service.usable()).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    setOnline(true);
    window.dispatchEvent(new Event('online'));
    // Checked behind the site, which stays shown meanwhile
    expect(service.usable()).toBe(true);
    await vi.waitFor(() => expect(service.state()).toBe('ready'));
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('online it still waits for the backend', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    const service = await warmup();
    void service.start();
    expect(service.state()).toBe('checking');
    expect(service.usable()).toBe(false);
  });
});

describe('device storage and the connection', () => {
  it('warns of data saving, a phone connection or a very slow one; says nothing when the browser does not tell', () => {
    expect(costlyConnection(undefined)).toBeNull();
    expect(costlyConnection({ saveData: true })).toEqual({ saveData: true, metered: false, slow: false });
    expect(costlyConnection({ type: 'cellular', effectiveType: '4g' })).toEqual({ saveData: false, metered: true, slow: false });
    expect(costlyConnection({ type: 'wifi', effectiveType: '2g' })?.slow).toBe(true);
  });

  it('writes sizes for people', () => {
    expect(formatBytes(512)).toBe('1 kB');
    expect(formatBytes(300 * 1024)).toBe('300 kB');
    expect(formatBytes(12.34 * 1024 * 1024)).toBe('12,3 MB');
  });

  it('the app files the service worker downloads on install are its prefetch groups', () => {
    expect(
      prefetchedUrls({
        assetGroups: [
          { name: 'app', installMode: 'prefetch', urls: ['/index.html', '/main.js'] },
          { name: 'engine', installMode: 'prefetch', urls: ['/engine/card-bundle.json'] },
          { name: 'assets', installMode: 'lazy', urls: ['/images/x.png'] },
        ],
      }),
    ).toEqual(['/index.html', '/main.js', '/engine/card-bundle.json']);
  });
});
