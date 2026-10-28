import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
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

  private readonly tokenState = signal<string | null>(readStorage(TOKEN_KEY));
  private readonly userState = signal<AuthUser | null>(parseUser(readStorage(USER_KEY)));

  readonly token = this.tokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenState() !== null);

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
  }
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
