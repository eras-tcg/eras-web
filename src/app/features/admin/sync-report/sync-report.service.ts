import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { SyncReport, SyncReportApi } from '@data/cards/sync-report.api';
import { environment } from '@env';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { firstValueFrom } from 'rxjs';
import { SyncReportDialogComponent } from './sync-report-dialog.component';

const SEEN_KEY = 'eras.syncReportSeen';
const POLL_MS = 5000;
const GIVE_UP_MS = 5 * 60_000;

/**
 * A backend that sleeps checks Drive for changes as it wakes up. An admin (manage_cards) is shown what it found, once per
 * check, with a way to go and review it ("Gestionar cambios").
 */
@Injectable({ providedIn: 'root' })
export class SyncReportService {
  private readonly api = inject(SyncReportApi);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  private checking = false;

  /** Waits for the check to finish and shows it, if there is something new to show. */
  async check(): Promise<void> {
    if (!environment.wakeUrl || this.checking || !this.auth.can('manage_cards')) return;
    this.checking = true;
    try {
      const started = Date.now();
      let report = await this.fetch();
      while (report?.status === 'running' && Date.now() - started < GIVE_UP_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        report = await this.fetch();
      }
      if (!report || report.status === 'running' || this.seen() === report.checkedAt) return;
      if (report.status === 'done' && report.items.length === 0) return this.markSeen(report);
      this.markSeen(report);
      const review = await firstValueFrom(this.modal.open<boolean, SyncReport>(SyncReportDialogComponent, { data: report }).closed);
      if (review) await this.router.navigate(['/updates-manager']);
    } finally {
      this.checking = false;
    }
  }

  private async fetch(): Promise<SyncReport | null> {
    try {
      return await firstValueFrom(this.api.report());
    } catch {
      return null;
    }
  }

  private seen(): string | null {
    try {
      return localStorage.getItem(SEEN_KEY);
    } catch {
      return null;
    }
  }

  private markSeen(report: SyncReport): void {
    try {
      localStorage.setItem(SEEN_KEY, report.checkedAt);
    } catch {
      // Shown again next time (private window, blocked storage)
    }
  }
}
