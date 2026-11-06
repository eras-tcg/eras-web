import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';

/** A player of a kept game. */
export interface MatchPlayer {
  userId: string;
  username: string;
  deckId?: string | null;
  deckName?: string | null;
  starterCardId?: string | null;
  /** The server's bot (Modo solo). */
  bot?: boolean;
}

/** A game of the history, as the server keeps it once over. */
export interface MatchSummary {
  id: string;
  roomId: string;
  /** "online" or "solo" (against the bot). */
  mode: 'online' | 'solo';
  ranked: boolean;
  playerIds: string[];
  players: MatchPlayer[];
  firstPlayerId?: string | null;
  winnerId?: string | null;
  /** "lives", "deck", "surrender" or "abandon". */
  endReason?: string | null;
  turns: number;
  actions: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  /** It can still be watched again (its log is kept: the player's last 10 games, two weeks at most). */
  hasLog?: boolean;
}

/** A replay opened: its room, and whether the cards' rules are still those of the game (else it may differ). */
export interface ReplayOpened {
  roomId: string;
  sameRules: boolean;
}

/** The game history (simulator): the signed-in player's games. */
@Injectable({ providedIn: 'root' })
export class MatchesApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  /** A page of my games, newest first. */
  mine(page = 0, size = 20): Observable<MatchSummary[]> {
    return this.http.get<MatchSummary[]>(this.api.url('/api/simulator/matches/me'), { params: { page, size } });
  }

  /** A room to watch the game again. */
  replay(id: string): Observable<ReplayOpened> {
    return this.http.post<ReplayOpened>(this.api.url(`/api/simulator/matches/${encodeURIComponent(id)}/replay`), null);
  }
}
