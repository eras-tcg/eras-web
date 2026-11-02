import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { WalletStore } from '@core/wallet/wallet.store';
import { firstValueFrom } from 'rxjs';
import { claimable } from './mission-rules';
import { MissionBoard, MissionPeriod } from './mission.model';
import { MissionsApi } from './missions.api';

/**
 * The signed-in player's daily and weekly missions, kept by the server (online games count for them there). Read
 * when someone signs in (which counts the day's login) and again on the missions screen; claiming one adds its gems.
 */
@Injectable({ providedIn: 'root' })
export class MissionsStore {
  private readonly api = inject(MissionsApi);
  private readonly auth = inject(AuthService);
  private readonly wallet = inject(WalletStore);

  readonly board = signal<MissionBoard | null>(null);
  /** The mission being claimed ("daily|win"), or null. */
  readonly claiming = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  /** Missions done whose gems wait to be claimed. */
  readonly waiting = computed(() => [...(this.board()?.daily ?? []), ...(this.board()?.weekly ?? [])].filter(claimable).length);

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      untracked(() => {
        this.board.set(null);
        if (id) void this.load();
      });
    });
  }

  async load(): Promise<void> {
    try {
      this.board.set(await firstValueFrom(this.api.mine()));
    } catch {
      // An older server without missions: none
    }
  }

  async claim(period: MissionPeriod, missionId: string): Promise<void> {
    this.claiming.set(`${period}|${missionId}`);
    this.error.set(null);
    try {
      this.board.set(await firstValueFrom(this.api.claim(period, missionId)));
      void this.wallet.refresh();
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo reclamar la misión'));
    } finally {
      this.claiming.set(null);
    }
  }
}
