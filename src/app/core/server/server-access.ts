import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { AppMode, detectAppMode } from '../pwa/app-mode';

/** Where the site runs (app-mode.ts); a test gives its own. */
export const APP_MODE = new InjectionToken<AppMode>('APP_MODE', { providedIn: 'root', factory: () => detectAppMode() });

/** Kept for the visit (a reload of the installed app stays connected; opening it again starts without the server). */
const CONNECTED_KEY = 'eras-connected';

/**
 * Whether the site may talk to the server now. The browser's tab always may (as it always did). The installed app is
 * local-first: it opens without contacting the server (a backend that sleeps is not woken up by opening it) and may
 * only once the player connects (ConnectionService: "Conectar", or opening something that needs the server); then it
 * stays connected for the rest of the visit. Requests made before are refused at once (connectionGateInterceptor) and
 * the stores that load by themselves wait for `allowed`.
 */
@Injectable({ providedIn: 'root' })
export class ServerAccess {
  readonly mode = inject(APP_MODE);
  private readonly connectedState = signal(this.mode === 'browser' || readSession(CONNECTED_KEY) === '1');
  /** Connected in this visit (always true in the browser). */
  readonly connected = this.connectedState.asReadonly();
  /** The server may be asked now. */
  readonly allowed = computed(() => this.mode === 'browser' || this.connectedState());
  /** The installed app, not connected yet: what needs the server shows it, and opening it connects first. */
  readonly needsConnect = computed(() => !this.allowed());

  markConnected(): void {
    this.connectedState.set(true);
    writeSession(CONNECTED_KEY, '1');
  }

  /** The installed app back to playing without the server (the browser is always connected). */
  markDisconnected(): void {
    if (this.mode === 'browser') return;
    this.connectedState.set(false);
    writeSession(CONNECTED_KEY, '0');
  }
}

/**
 * Whether the server is checked (and woken up) as the site starts. The browser always does (its warm-up waits for the
 * connection by itself when there is none). The installed app only when it was already connected in this visit (a
 * reload), or when nobody is signed in (signing in needs the server); otherwise it waits for the player to connect.
 */
export function shouldWakeServerOnStart(input: { mode: AppMode; connectedThisSession: boolean; signedIn: boolean }): boolean {
  return input.mode === 'browser' || input.connectedThisSession || !input.signedIn;
}

/**
 * The screens that work without the server (from what the device keeps): the hub, Jugar, Modo solo sin conexión's
 * table, the tutorial, the player's decks kept on the device, the profile's preferences and the login. Anything else
 * (Online, ranked, missions, the shop, the catalog, the community, editing decks, administration…) needs it: the
 * installed app connects before opening it. New screens need the server unless they are added here.
 */
const LOCAL_SCREENS = [/^$/, /^home$/, /^play$/, /^ruling$/, /^profile$/, /^my-decks$/, /^login$/, /^simulator\/local\/board$/, /^dev\//];

export function routeNeedsServer(url: string): boolean {
  const path = url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return !LOCAL_SCREENS.some((screen) => screen.test(path));
}

/** An API request or the backend's wake-up: what the installed app does not send before connecting. */
export function isServerRequest(url: string): boolean {
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
  return path.includes('/api/') || path === '/wake' || path === '/ws' || path.startsWith('/ws/');
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Unavailable (private mode): connected for this page only
  }
}
