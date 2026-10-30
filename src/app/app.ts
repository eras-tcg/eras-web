import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ServerWarmupService } from '@core/server/server-warmup.service';
import { WarmupScreenComponent } from '@core/server/warmup-screen.component';
import { ThemeService } from '@core/theme/theme.service';
import { SyncReportService } from '@features/admin/sync-report/sync-report.service';

@Component({
  selector: 'eras-root',
  imports: [RouterOutlet, WarmupScreenComponent],
  // A backend that sleeps (AWS): nothing loads until it is up
  template: `@if (warmup.ready()) {
      <router-outlet />
    } @else {
      <eras-warmup-screen />
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Created at startup so the saved theme is applied before the first page renders
  protected readonly theme = inject(ThemeService);
  protected readonly warmup = inject(ServerWarmupService);
  private readonly auth = inject(AuthService);
  private readonly syncReport = inject(SyncReportService);

  constructor() {
    void this.warmup.start();
    // Once the backend is up, and again when an admin signs in: what it found in Drive as it woke up
    effect(() => {
      if (this.warmup.ready() && this.auth.user()) void this.syncReport.check();
    });
  }
}
