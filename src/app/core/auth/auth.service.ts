import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from '../http/api-config';
import { AccountRecord, AccountUpdate, AuthUser, LoginRequest, Permission } from './auth.model';
import { decodeJwtPayload } from './jwt';

// Same keys as the Vue app, so a session can be shared when both run on the same domain
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

interface LoginResponse {
  token?: string;
  accessToken?: string;
  jwt?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly injector = inject(Injector);
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly tokenState = signal<string | null>(readStorage(TOKEN_KEY));
  private readonly userState = signal<AuthUser | null>(parseUser(readStorage(USER_KEY)));

  readonly token = this.tokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenState() !== null);
  /** The last session ended because it expired (shown on the login page). */
  readonly expired = signal(false);

  constructor() {
    // A session stored from an earlier visit may have expired meanwhile
    if (tokenExpired(this.tokenState())) {
      this.setSession(null, null);
      this.expired.set(true);
    }
    this.scheduleExpiry();
    // Timers stop while the computer sleeps: check again when the tab is shown
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && tokenExpired(this.tokenState())) this.expire();
    });
  }

  /**
   * The session is no longer valid (its token expired, or the server answered 401): sign out and go to the
   * login page, which then brings the user back to where they were.
   */
  expire(): void {
    if (!this.tokenState()) return;
    this.setSession(null, null);
    this.expired.set(true);
    const router = this.injector.get(Router);
    const returnUrl = router.url && router.url !== '/' && !router.url.startsWith('/login') ? router.url : undefined;
    void router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
  }

  can(permission: Permission): boolean {
    return this.userState()?.permissions.includes(permission) ?? false;
  }

  async login(request: LoginRequest): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(this.api.url('/api/auth/login'), request),
    );
    const token = response.token ?? response.accessToken ?? response.jwt;
    if (!token) throw new Error('El servidor no devolvió un token');
    this.applyToken(token, request.username);
    this.expired.set(false);
  }

  logout(): void {
    this.setSession(null, null);
  }

  /** Confirms an account with the token from the verification e-mail. */
  async verify(token: string): Promise<void> {
    await firstValueFrom(this.http.get(this.api.url('/api/auth/verify'), { params: { token }, responseType: 'text' }));
  }

  /** Changes the signed-in user's own password. */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(this.api.url('/api/users/change-password'), { oldPassword, newPassword }, { responseType: 'text' }),
    );
  }

  /**
   * The signed-in user's record. UsersService only exposes users to manage_users,
   * so for everyone else this returns null.
   */
  async loadOwnAccount(): Promise<AccountRecord | null> {
    const user = this.userState();
    if (!user || !this.can('manage_users')) return null;
    const users = await firstValueFrom(this.http.get<AccountRecord[]>(this.api.url('/api/users')));
    return users.find((u) => u.id === user.id) ?? null;
  }

  /** Renames the signed-in user / changes the e-mail (manage_users only). The server issues a new token. */
  async updateOwnAccount(update: AccountUpdate): Promise<void> {
    const user = this.userState();
    if (!user) throw new Error('No hay una sesión iniciada');
    const response = await firstValueFrom(
      this.http.put<LoginResponse>(this.api.url(`/api/users/update/${encodeURIComponent(user.id)}`), update),
    );
    if (response.token) this.applyToken(response.token, update.username);
    else this.setSession(this.tokenState(), { ...user, username: update.username });
  }

  private applyToken(token: string, username: string): void {
    const payload = decodeJwtPayload(token);
    const permissions = payload['permissions'];
    this.setSession(token, {
      id: String(payload['sub'] ?? ''),
      username,
      permissions: Array.isArray(permissions) ? permissions.map(String) : [],
    });
  }

  private setSession(token: string | null, user: AuthUser | null): void {
    this.tokenState.set(token);
    this.userState.set(user);
    writeStorage(TOKEN_KEY, token);
    writeStorage(USER_KEY, user ? JSON.stringify(user) : null);
    this.scheduleExpiry();
  }

  /** Signs out by itself when the token's expiry ("exp") is reached. */
  private scheduleExpiry(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    const exp = tokenExpiry(this.tokenState());
    if (exp === null) return;
    // setTimeout holds at most ~24.8 days; a longer session is checked again then
    const wait = Math.min(Math.max(0, exp - Date.now()), 2_147_000_000);
    this.expiryTimer = setTimeout(() => (tokenExpired(this.tokenState()) ? this.expire() : this.scheduleExpiry()), wait);
  }
}

/** When the token expires (ms), or null if it says nothing. */
function tokenExpiry(token: string | null): number | null {
  if (!token) return null;
  const exp = decodeJwtPayload(token)['exp'];
  return typeof exp === 'number' ? exp * 1000 : null;
}

function tokenExpired(token: string | null): boolean {
  const exp = tokenExpiry(token);
  return exp !== null && exp <= Date.now();
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode): the session lives in memory only
  }
}

function parseUser(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AuthUser>;
    return { id: value.id ?? '', username: value.username ?? '', permissions: value.permissions ?? [] };
  } catch {
    return null;
  }
}
