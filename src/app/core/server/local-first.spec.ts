import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { MissionsStore } from '../missions/missions.store';
import { ProgressionStore } from '../missions/progression.store';
import { WalletStore } from '../wallet/wallet.store';
import { AppMode } from '../pwa/app-mode';
import { ConnectionState, connectionView, nextConnectionState } from './connection';
import { NOT_CONNECTED_MESSAGE, connectionGateInterceptor, isNotConnected } from './connection-gate.interceptor';
import { ConnectionService } from './connection.service';
import { APP_MODE, ServerAccess, isServerRequest, routeNeedsServer, shouldWakeServerOnStart } from './server-access';
import { WAKE_URL } from './server-warmup.service';
import { apiErrorMessage } from '../http/api-error';

const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const token = (exp: number) => `${encode({ alg: 'none' })}.${encode({ sub: 'u1', permissions: [], exp })}.x`;

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
}

function signedIn(raw = token(Math.floor(Date.now() / 1000) + 3600)): void {
  localStorage.setItem('auth_token', raw);
  localStorage.setItem('auth_user', JSON.stringify({ id: 'u1', username: 'ana', permissions: [] }));
}

describe('the connection state machine', () => {
  it('connects from idle or after failing, and stays connected', () => {
    expect(nextConnectionState('idle', 'connect')).toBe('connecting');
    expect(nextConnectionState('connecting', 'ready')).toBe('connected');
    expect(nextConnectionState('connecting', 'failed')).toBe('failed');
    expect(nextConnectionState('failed', 'connect')).toBe('connecting');
    expect(nextConnectionState('connecting', 'cancel')).toBe('idle');
    expect(nextConnectionState('failed', 'cancel')).toBe('idle');
    for (const event of ['connect', 'ready', 'failed', 'cancel'] as const) expect(nextConnectionState('connected', event)).toBe('connected');
    // What does not apply changes nothing
    expect(nextConnectionState('idle', 'ready')).toBe('idle');
    expect(nextConnectionState('idle', 'failed')).toBe('idle');
  });

  it('"Conectar" shows the state, and "Sin internet" without the network whatever the state', () => {
    const label = (state: ConnectionState, online = true) => connectionView(state, online).label;
    expect(label('idle')).toBe('Sin conectar');
    expect(label('failed')).toBe('Sin conectar');
    expect(label('connecting')).toBe('Conectando…');
    expect(label('connected')).toBe('Conectado');
    expect(label('idle', false)).toBe('Sin internet');
    expect(label('connected', false)).toBe('Sin internet');
    expect(connectionView('idle', true).actionable).toBe(true);
    expect(connectionView('connecting', true).actionable).toBe(false);
    expect(connectionView('idle', false).actionable).toBe(false);
  });
});

describe('local-first decisions', () => {
  it('the browser wakes the server on start; the installed app only if connected in this visit or nobody is signed in', () => {
    expect(shouldWakeServerOnStart({ mode: 'browser', connectedThisSession: false, signedIn: true })).toBe(true);
    expect(shouldWakeServerOnStart({ mode: 'app', connectedThisSession: false, signedIn: true })).toBe(false);
    expect(shouldWakeServerOnStart({ mode: 'app', connectedThisSession: true, signedIn: true })).toBe(true);
    expect(shouldWakeServerOnStart({ mode: 'app', connectedThisSession: false, signedIn: false })).toBe(true);
  });

  it('knows which screens work from the device and which need the server', () => {
    for (const url of ['/', '/home', '/play', '/play?x=1', '/ruling', '/profile', '/my-decks', '/login?returnUrl=%2Fcards', '/simulator/local/board']) {
      expect(routeNeedsServer(url)).toBe(false);
    }
    for (const url of ['/simulator', '/simulator/abc', '/simulator/abc/board', '/missions', '/editions', '/editions/E1', '/cards', '/social', '/public-decks', '/ranking', '/tierlist', '/deck/1', '/deck-builder', '/admin', '/booster-result', '/validate']) {
      expect(routeNeedsServer(url)).toBe(true);
    }
  });

  it('what counts as asking the server: the API, the wake-up and the socket', () => {
    expect(isServerRequest('/api/drive/decklists?userId=1')).toBe(true);
    expect(isServerRequest('https://www.erastcg.com/api/cards/search')).toBe(true);
    expect(isServerRequest('/wake')).toBe(true);
    expect(isServerRequest('/ws')).toBe(true);
    expect(isServerRequest('/engine/starter-decks.json')).toBe(false);
    expect(isServerRequest('/index.html?ngsw-bypass=1')).toBe(false);
    expect(isServerRequest('/wakeful.png')).toBe(false);
  });
});

function setUp(mode: AppMode, wakeUrl?: string) {
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_MODE, useValue: mode },
      { provide: WAKE_URL, useValue: wakeUrl },
      provideHttpClient(withInterceptors([connectionGateInterceptor])),
      provideHttpClientTesting(),
      provideRouter([{ path: '**', children: [] }]),
    ],
  });
  return { http: TestBed.inject(HttpClient), controller: TestBed.inject(HttpTestingController) };
}

describe('the installed app before connecting', () => {
  afterEach(() => {
    setOnline(true);
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('the gate answers API requests at once without sending them, until it connects', async () => {
    const { http, controller } = setUp('app');
    const refused = await firstValueFrom(http.get('/api/drive/wallet/me')).catch((e: unknown) => e);
    expect(isNotConnected(refused)).toBe(true);
    expect(apiErrorMessage(refused)).toBe(NOT_CONNECTED_MESSAGE);
    controller.expectNone(() => true);
    // What is not the server goes through
    void firstValueFrom(http.get('/engine/starter-decks.json'));
    controller.expectOne('/engine/starter-decks.json').flush({});

    TestBed.inject(ServerAccess).markConnected();
    void firstValueFrom(http.get('/api/drive/wallet/me'));
    controller.expectOne('/api/drive/wallet/me').flush({ gems: 1 });
    // Kept for the visit (a reload stays connected)
    expect(sessionStorage.getItem('eras-connected')).toBe('1');
  });

  it('the stores that load by themselves ask nothing until it connects, then load', async () => {
    signedIn();
    const { controller } = setUp('app');
    const wallet = TestBed.inject(WalletStore);
    TestBed.inject(MissionsStore);
    TestBed.inject(ProgressionStore);
    TestBed.tick();
    controller.expectNone(() => true);
    expect(wallet.loaded()).toBe(false);

    TestBed.inject(ServerAccess).markConnected();
    TestBed.tick();
    controller.expectOne('/api/drive/wallet/me').flush({ gems: 7 });
    controller.expectOne('/api/drive/missions/me').flush({ daily: [], weekly: [] });
    controller.expectOne('/api/drive/progression/me').flush({ welcome: [], milestones: [] });
    await vi.waitFor(() => expect(wallet.gems()).toBe(7));
  });

  it('in the browser the gate does nothing and the stores load at once (as always)', () => {
    signedIn();
    const { controller } = setUp('browser');
    TestBed.inject(WalletStore);
    TestBed.tick();
    controller.expectOne('/api/drive/wallet/me').flush({ gems: 1 });
  });

  it('an expired session is kept while not connected (not even a timer or a 401 ends it); connecting goes to the login', async () => {
    signedIn(token(Math.floor(Date.now() / 1000) - 60));
    setUp('app');
    const auth = TestBed.inject(AuthService);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(auth.isAuthenticated()).toBe(true);
    auth.expire();
    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();

    const result = await TestBed.inject(ConnectionService).connect('/editions');
    expect(result).toBe('login');
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
  });
});

describe('ConnectionService', () => {
  afterEach(() => {
    setOnline(true);
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('the installed app does not contact the server on start; connecting wakes it, then it is connected', async () => {
    signedIn();
    let awake = false;
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(String(url));
        if (String(url) === '/wake') awake = true;
        return Promise.resolve(new Response('', { status: awake ? 200 : 503 }));
      }),
    );
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      setUp('app', '/wake');
      const connection = TestBed.inject(ConnectionService);
      connection.start();
      expect(calls).toEqual([]);
      expect(connection.view().label).toBe('Sin conectar');
      expect(connection.needsConnect()).toBe(true);
      expect(connection.siteShown()).toBe(true);
      expect(connection.warmupShown()).toBe(false);

      const result = connection.connect('/editions');
      expect(connection.state()).toBe('connecting');
      expect(connection.view().label).toBe('Conectando…');
      // Only checked so far: the app stays as it is
      expect(connection.warmupShown()).toBe(false);
      await vi.advanceTimersByTimeAsync(10);
      // Asleep: the warm-up screen while it wakes up
      expect(connection.warmupShown()).toBe(true);
      await vi.advanceTimersByTimeAsync(4000);
      expect(await result).toBe('connected');
      expect(calls[0]).toBe('/api/drive/health');
      expect(calls).toContain('/wake');
      expect(connection.view().label).toBe('Conectado');
      expect(connection.needsConnect()).toBe(false);
      expect(connection.warmupShown()).toBe(false);
      // Connected for the visit: nothing more to do
      expect(await connection.connect()).toBe('connected');
    } finally {
      vi.useRealTimers();
    }
  });

  it('without internet it does not try, and says so', async () => {
    signedIn();
    setOnline(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    setUp('app', '/wake');
    const connection = TestBed.inject(ConnectionService);
    expect(connection.view().label).toBe('Sin internet');
    expect(await connection.connect()).toBe('offline');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(connection.notice()).toContain('Sin internet');
    expect(connection.needsConnect()).toBe(true);
  });

  it('"Seguir sin conexión" while it wakes: back to the app without the server', async () => {
    signedIn();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    setUp('app', '/wake');
    const connection = TestBed.inject(ConnectionService);
    const result = connection.connect();
    connection.cancel();
    expect(connection.state()).toBe('idle');
    expect(connection.warmupShown()).toBe(false);
    expect(connection.needsConnect()).toBe(true);
    void result;
  });

  it('a backend always on (no wake-up): connecting is immediate, without a warm-up screen', async () => {
    signedIn();
    setUp('app');
    const connection = TestBed.inject(ConnectionService);
    expect(connection.warmupShown()).toBe(false);
    expect(await connection.connect()).toBe('connected');
    expect(connection.warmupShown()).toBe(false);
  });

  it('nobody signed in: the installed app connects on start (the login needs the server)', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    setUp('app', '/wake');
    const connection = TestBed.inject(ConnectionService);
    connection.start();
    expect(connection.needsConnect()).toBe(false);
    expect(fetch).toHaveBeenCalledWith('/api/drive/health', expect.anything());
  });

  it('the browser is connected from the start and wakes the server on start', () => {
    signedIn();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    setUp('browser', '/wake');
    const connection = TestBed.inject(ConnectionService);
    connection.start();
    expect(connection.needsConnect()).toBe(false);
    expect(connection.installed).toBe(false);
    expect(fetch).toHaveBeenCalled();
    // The site waits for the server, as always
    expect(connection.siteShown()).toBe(false);
  });
});
