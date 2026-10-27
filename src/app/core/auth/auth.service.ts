import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from '../http/api-config';
import { AuthUser, LoginRequest, Permission } from './auth.model';
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

    const payload = decodeJwtPayload(token);
    const permissions = payload['permissions'];
    this.setSession(token, {
      id: String(payload['sub'] ?? ''),
      username: request.username,
      permissions: Array.isArray(permissions) ? permissions.map(String) : [],
    });
  }

  logout(): void {
    this.setSession(null, null);
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
