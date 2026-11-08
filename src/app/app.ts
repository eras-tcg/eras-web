import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { RotateOverlayComponent } from '@core/layout/rotate-overlay.component';
import { AppScreen } from '@core/pwa/app-screen';
import { ConnectionService } from '@core/server/connection.service';
import { ServerAccess } from '@core/server/server-access';
import { ServerWarmupService } from '@core/server/server-warmup.service';
import { WarmupScreenComponent } from '@core/server/warmup-screen.component';
import { ThemeService } from '@core/theme/theme.service';
import { SyncReportService } from '@features/admin/sync-report/sync-report.service';

@Component({
  selector: 'eras-root',
  imports: [RouterOutlet, WarmupScreenComponent, RotateOverlayComponent],
  // The browser with a backend that sleeps (AWS): nothing loads until it is up (unless there is no connection: then
  // what works offline). The installed app is local-first: it always shows the site, and the warm-up only while it
  // connects (over the site, which stays as it was)
  template: `@if (connection.siteShown()) {
      <router-outlet />
    } @else {
      <eras-warmup-screen />
    }
    @if (connection.warmupShown()) {
      <eras-warmup-screen class="over" />
    }
    @if (connection.notice(); as notice) {
      <p class="notice" role="status">{{ notice }}</p>
    }
    @if (screen.installed) {
      <eras-rotate-overlay />
    }`,
  styles: `
    .over {
      position: fixed;
      inset: 0;
      z-index: 1110;
    }
    .notice {
      position: fixed;
      inset: auto var(--space-4) max(var(--space-4), env(safe-area-inset-bottom));
      z-index: 1105;
      margin: 0 auto;
      max-inline-size: 36rem;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
      color: var(--color-text);
      font-size: var(--font-size-sm);
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Created at startup so the saved theme is applied before the first page renders
  protected readonly theme = inject(ThemeService);
  protected readonly warmup = inject(ServerWarmupService);
  protected readonly connection = inject(ConnectionService);
  protected readonly screen = inject(AppScreen);
  private readonly access = inject(ServerAccess);
  private readonly auth = inject(AuthService);
  private readonly syncReport = inject(SyncReportService);

  constructor() {
    // The browser checks (and wakes) the server now; the installed app only once the player connects
    this.connection.start();
    // The installed app: landscape, full screen, a layout that does not jump with the system bars
    this.screen.start();
    // Once the backend is up, and again when an admin signs in: what it found in Drive as it woke up
    effect(() => {
      if (this.access.allowed() && this.warmup.ready() && this.auth.user()) void this.syncReport.check();
    });
  }
}
