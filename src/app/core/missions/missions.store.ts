import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ServerAccess } from '../server/server-access';
import { ApiConfig } from '../http/api-config';
import { apiErrorMessage } from '../http/api-error';
import { WalletStore } from '../wallet/wallet.store';
import { Mission, MissionBoard, MissionPeriod } from './mission.model';
import { reloadOnProgress } from './reload-on-progress';

/** Done and not yet claimed: its gems wait. */
export function claimable(mission: Mission): boolean {
  return !mission.claimed && mission.progress >= mission.target;
}

/**
 * The signed-in player's daily and weekly missions, kept by the server (DriveManager /api/drive/missions; online
 * games count for them there). Read when someone signs in (which counts the day's login) and again on the missions
 * screen; claiming one adds its gems. In core, as the wallet: the quick buttons show how many wait to be claimed.
 */
@Injectable({ providedIn: 'root' })
export class MissionsStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);
  /** The installed app asks the server nothing before connecting (ServerAccess). */
  private readonly access = inject(ServerAccess);
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
      const allowed = this.access.allowed();
      untracked(() => {
        this.board.set(null);
        if (id && allowed) void this.load();
      });
    });
    reloadOnProgress(() => this.load(), () => this.board() !== null);
  }

  async load(): Promise<void> {
    try {
      this.board.set(await firstValueFrom(this.http.get<MissionBoard>(this.api.url('/api/drive/missions/me'))));
    } catch {
      // An older server without missions: none
    }
  }

  async claim(period: MissionPeriod, missionId: string): Promise<void> {
    this.claiming.set(`${period}|${missionId}`);
    this.error.set(null);
    try {
      this.board.set(await firstValueFrom(this.http.post<MissionBoard>(this.api.url('/api/drive/missions/me/claim'), { period, missionId })));
      void this.wallet.refresh();
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo reclamar la misión'));
    } finally {
      this.claiming.set(null);
    }
  }
}
