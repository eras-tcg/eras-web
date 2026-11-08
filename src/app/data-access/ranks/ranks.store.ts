import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ApiConfig } from '@core/http/api-config';
import { ServerAccess } from '@core/server/server-access';
import { firstValueFrom } from 'rxjs';
import { ChallengerRow, MyRank, RankChange } from './rank.model';

/** How long a rank read counts as fresh (pages that open ask again only after it). */
const FRESH_MS = 10_000;

/**
 * The signed-in player's rank in the ranked ladder (shown in the hub's nameplate, the profile and after a ranked
 * game). Loaded on sign-in; read again after each ranked game. One read at a time: a read in course is shared.
 */
@Injectable({ providedIn: 'root' })
export class RanksStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);
  /** The installed app asks the server nothing before connecting (ServerAccess). */
  private readonly access = inject(ServerAccess);

  readonly mine = signal<MyRank | null>(null);
  /** The rank was read (or failed) for this account: before that, no rank means not known yet, not none. */
  readonly loaded = signal(false);
  /** The last read failed (the rank is unknown, not empty). */
  readonly failed = signal(false);
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private pending: Promise<MyRank | null> | null = null;
  private loadedAt = 0;

  constructor() {
    // Only a different account loads again (a renamed one keeps its rank)
    effect(() => {
      const id = this.userId();
      const allowed = this.access.allowed();
      untracked(() => {
        this.mine.set(null);
        this.loaded.set(false);
        this.loadedAt = 0;
        if (id && allowed) void this.load();
      });
    });
  }

  /** Reads the rank again (a read in course is shared). */
  load(): Promise<MyRank | null> {
    this.pending ??= firstValueFrom(this.http.get<MyRank>(this.api.url('/api/simulator/ranks/me')))
      .then((rank) => {
        this.mine.set(rank);
        this.failed.set(false);
        this.loadedAt = Date.now();
        return rank;
      })
      .catch(() => {
        this.failed.set(true);
        return null;
      })
      .finally(() => {
        this.pending = null;
        this.loaded.set(true);
      });
    return this.pending;
  }

  /** The Retador board, the most points first. */
  challengers(): Promise<ChallengerRow[]> {
    return firstValueFrom(this.http.get<ChallengerRow[]>(this.api.url('/api/simulator/ranks/challengers')));
  }

  /** Reads the rank unless it was read a moment ago. */
  refreshIfStale(): Promise<MyRank | null> {
    return Date.now() - this.loadedAt < FRESH_MS ? Promise.resolve(this.mine()) : this.load();
  }

  /**
   * After a ranked game in this room: what it changed, once the server has kept it (a moment after the game ends,
   * so it is asked a few times). `before`: the match of the last change known when the game started (a change of
   * another match is this one's); `alive`: false stops asking (the board was left, or another game ended).
   */
  async changeOf(roomId: string, before: string | null, alive: () => boolean, tries = 6, waitMs = 600): Promise<RankChange | null> {
    for (let i = 0; i < tries && alive(); i++) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      if (!alive()) return null;
      const change = (await this.load())?.lastChange;
      if (change && change.roomId === roomId && change.matchId !== before) return change;
    }
    return null;
  }
}
