import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ConnectionEvent, ConnectionState, connectionView, nextConnectionState } from './connection';
import { OnlineStatus } from './online-status';
import { ServerAccess, routeNeedsServer, shouldWakeServerOnStart } from './server-access';
import { ServerWarmupService, WAKE_URL } from './server-warmup.service';

/** How connecting ended: connected, no internet, the server did not wake up, the player went on without it, or the session had expired (to the login). */
export type ConnectResult = 'connected' | 'offline' | 'failed' | 'cancelled' | 'login';

/** How long a notice ("Sin internet…") stays. */
const NOTICE_MS = 5000;
const NO_INTERNET = 'Sin internet: conéctate a una red para usar lo que necesita el servidor. Puedes seguir jugando sin conexión.';

/**
 * Connecting the installed app to the server (local-first, ServerAccess): on "Conectar" or when the player opens
 * something that needs the server. It wakes the server up (the warm-up screen shows only then), lets the site talk to
 * it (the stores load, the decks kept for offline are synced: DataPrefetch) and checks the session (expired: the
 * login, as usual). Once connected it stays connected for the visit. In the browser everything is as it always was:
 * the server is checked (and woken up) on opening the site, and connect() resolves at once.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly access = inject(ServerAccess);
  private readonly warmup = inject(ServerWarmupService);
  private readonly auth = inject(AuthService);
  private readonly network = inject(OnlineStatus);
  private readonly router = inject(Router);
  /** The backend sleeps (AWS): connecting shows the warm-up while it wakes up. */
  private readonly sleeps = !!inject(WAKE_URL);

  /** The installed app (local-first, landscape, full screen). */
  readonly installed = this.access.mode === 'app';
  private readonly stateSignal = signal<ConnectionState>(this.access.connected() ? 'connected' : 'idle');
  readonly state = this.stateSignal.asReadonly();
  /** What "Conectar" shows (Sin conectar / Conectando… / Conectado / Sin internet). */
  readonly view = computed(() => connectionView(this.stateSignal(), this.network.online()));
  /** Not connected yet (the installed app only): what needs the server shows it, and opening it connects first. */
  readonly needsConnect = this.access.needsConnect;
  /** The browser hides the site until the server is up (as always); the installed app always shows it. */
  readonly siteShown = computed(() => this.installed || this.warmup.usable());
  /**
   * The warm-up screen over the installed app: while the server wakes up (or fell asleep again), or when it did not
   * wake up. While it is only being checked (an awake server answers at once) the app stays as it is and "Conectar"
   * says "Conectando…".
   */
  readonly warmupShown = computed(() => {
    if (!this.installed || !this.sleeps || this.stateSignal() === 'idle') return false;
    const warmup = this.warmup.state();
    return warmup === 'waking' || warmup === 'failed';
  });
  /** A short message about connecting (no internet, the server did not answer). */
  readonly notice = signal<string | null>(null);

  private running: Promise<ConnectResult> | null = null;
  private generation = 0;
  /** Where the player was going when connecting failed: "Reintentar" goes on there. */
  private target: string | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  /** As the site starts (App): the browser wakes the server; the installed app only if shouldWakeServerOnStart. */
  start(): void {
    const connectedThisSession = this.access.connected() && this.installed;
    const signedIn = this.auth.isAuthenticated();
    if (!shouldWakeServerOnStart({ mode: this.access.mode, connectedThisSession, signedIn })) return;
    if (this.installed && !this.access.connected()) {
      // Nobody signed in: the login needs the server, so the app is connected as the browser is
      this.access.markConnected();
      this.stateSignal.set('connected');
    }
    void this.warmup.start();
  }

  /**
   * Connects (once; later calls share it). `target`: where the player is going (kept if it fails, for "Reintentar").
   * Resolves at once when already connected (always in the browser).
   */
  connect(target?: string): Promise<ConnectResult> {
    if (this.access.allowed()) return Promise.resolve('connected');
    if (target) this.target = target;
    if (!this.network.online()) {
      this.say(NO_INTERNET);
      return Promise.resolve('offline');
    }
    if (this.running) return this.running;
    const running = this.run().finally(() => {
      if (this.running === running) this.running = null;
    });
    this.running = running;
    return running;
  }

  /** "Reintentar" on the warm-up screen: connects again and goes on where the player was going. */
  async retry(): Promise<void> {
    const target = this.target;
    if ((await this.connect()) === 'connected' && target) void this.router.navigateByUrl(target);
  }

  /** "Seguir sin conexión": back to the app without the server (the warm-up may go on behind; nothing waits for it). */
  cancel(): void {
    this.generation++;
    this.running = null;
    this.target = null;
    this.dispatch('cancel');
  }

  private async run(): Promise<ConnectResult> {
    const generation = ++this.generation;
    this.dispatch('connect');
    await this.warmup.start();
    if (generation !== this.generation) return 'cancelled';
    if (!this.warmup.ready()) {
      if (this.warmup.state() === 'offline') {
        this.dispatch('cancel');
        this.say(NO_INTERNET);
        return 'offline';
      }
      this.dispatch('failed');
      return 'failed';
    }
    this.access.markConnected();
    this.dispatch('ready');
    this.target = null;
    // An expired session waited (it is not ended while not connected): now it goes to the login, as usual
    if (this.auth.sessionExpired()) {
      this.auth.expire();
      return 'login';
    }
    return 'connected';
  }

  private dispatch(event: ConnectionEvent): void {
    this.stateSignal.update((state) => nextConnectionState(state, event));
  }

  private say(message: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set(message);
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }
}

/**
 * On the shell's screens: in the installed app, a screen that needs the server (routeNeedsServer) connects first (the
 * warm-up shows), then opens. If it cannot connect the screen does not open (the first screen of a visit falls back
 * to the home). The browser, and the app once connected, go straight through.
 */
export const connectionGuard: CanActivateChildFn = async (_route, state) => {
  const connection = inject(ConnectionService);
  if (!connection.needsConnect() || !routeNeedsServer(state.url)) return true;
  const router = inject(Router);
  const result = await connection.connect(state.url);
  if (result === 'connected') return true;
  if (result === 'login') return false;
  return router.navigated ? false : router.createUrlTree(['/home']);
};
