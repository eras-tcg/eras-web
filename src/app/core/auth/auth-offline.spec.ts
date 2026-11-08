import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const token = (exp: number) => `${encode({ alg: 'none' })}.${encode({ sub: 'u1', permissions: [], exp })}.x`;
const expiredToken = () => token(Math.floor(Date.now() / 1000) - 60);

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
}

function signedIn(raw: string): void {
  localStorage.setItem('auth_token', raw);
  localStorage.setItem('auth_user', JSON.stringify({ id: 'u1', username: 'ana', permissions: [] }));
}

describe('AuthService without the connection', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([{ path: '**', children: [] }])] });
  });

  afterEach(() => {
    setOnline(true);
    localStorage.clear();
  });

  it('online, an expired stored session ends at start (as before)', () => {
    signedIn(expiredToken());
    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.expired()).toBe(true);
  });

  it('an offline start keeps an expired session (its decks stay playable) until the connection is back', async () => {
    setOnline(false);
    signedIn(expiredToken());
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.user()?.id).toBe('u1');

    setOnline(true);
    window.dispatchEvent(new Event('online'));
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.expired()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
  });

  it('an offline game is never cut by an expiry: it waits until the player leaves it', async () => {
    signedIn(token(Math.floor(Date.now() / 1000) + 3600));
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/simulator/local/board');
    // Waiting for the router subscription made after the constructor
    await new Promise((resolve) => setTimeout(resolve));
    auth.expire();
    expect(auth.isAuthenticated()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve));
    await router.navigateByUrl('/play');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('signing out tells whoever keeps things for the account (the offline decks are deleted)', () => {
    signedIn(token(Math.floor(Date.now() / 1000) + 3600));
    const auth = TestBed.inject(AuthService);
    const listener = vi.fn();
    auth.onSignOut(listener);
    auth.logout();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated()).toBe(false);
  });
});
