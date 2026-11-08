import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { ApiConfig } from '@core/http/api-config';
import { apiErrorMessage } from '@core/http/api-error';
import { OfflineGameQueue, PendingGame, offlineGameQueue, toUpload } from './offline-games';

/** The server's verdict on one offline game (DriveManager's OfflineGames.Outcome). */
export interface OfflineGameVerdict {
  id: string;
  /** accepted: counted; duplicate: counted before; rejected: never counted; retry: not now, send it again later. */
  status: 'accepted' | 'duplicate' | 'rejected' | 'retry';
  reason?: string | null;
  message?: string | null;
  credit?: { won: boolean; turns: number; progress: { counts: string; amount: number }[]; matchId: string | null } | null;
}

/** How long the notice stays (as ConnectionService's notices). */
export const NOTICE_MS = 5000;

/**
 * The app's notice at the bottom, as App shows ConnectionService's (the same look: its .notice styles), drawn by this
 * chunk itself: importing ConnectionService here would split the first screen's code, and the first screen carries
 * nothing for it.
 */
export function showNotice(text: string, doc: Document = document): void {
  doc.getElementById('eras-offline-notice')?.remove();
  const p = doc.createElement('p');
  p.id = 'eras-offline-notice';
  p.setAttribute('role', 'status');
  p.textContent = text;
  Object.assign(p.style, {
    position: 'fixed',
    insetInline: 'var(--space-4)',
    insetBlockEnd: 'max(var(--space-4), env(safe-area-inset-bottom))',
    zIndex: '1105',
    margin: '0 auto',
    maxInlineSize: '36rem',
    padding: 'var(--space-2) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface)',
    boxShadow: '0 4px 16px rgb(0 0 0 / 30%)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-sm)',
    textAlign: 'center',
  });
  doc.body.appendChild(p);
  setTimeout(() => p.remove(), NOTICE_MS);
}

/** What a round of sending gave: games counted (won among them), refused, and left for later. */
export interface UploadSummary {
  accepted: number;
  won: number;
  rejected: number;
  pending: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The notice after sending ("2 partidas sin conexión registradas · 1 victoria"), or null when nothing was decided. */
export function summaryText(s: UploadSummary): string | null {
  const parts: string[] = [];
  if (s.accepted) {
    parts.push(plural(s.accepted, 'partida sin conexión registrada', 'partidas sin conexión registradas'));
    if (s.won) parts.push(plural(s.won, 'victoria', 'victorias'));
  }
  if (s.rejected) {
    parts.push(
      s.accepted
        ? `${s.rejected} no se ${s.rejected === 1 ? 'pudo' : 'pudieron'} registrar`
        : `${plural(s.rejected, 'partida sin conexión', 'partidas sin conexión')} no se ${s.rejected === 1 ? 'pudo' : 'pudieron'} registrar`,
    );
  }
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Sends the games played offline against the bot (kept on the device: offline-games.ts) once the player is connected,
 * one per request (the server plays each again before counting it), and drops those the server decided on: counted,
 * counted before, or refused. A game the server leaves for later ("retry"), or a request that fails (the connection
 * gone, the server down), stays for the next time; then it stops. A notice sums up what was counted. Made (lazily)
 * by OfflineLibrarySync once the player is connected (and after each sync of the library), and by OfflineGame when a
 * game ends (before connecting, the connection gate refuses the request at once: nothing reaches the server).
 */
@Injectable({ providedIn: 'root' })
export class OfflineGamesUpload {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);
  /** The queue (a test gives its own). */
  queue: OfflineGameQueue = offlineGameQueue;
  private running: Promise<UploadSummary> | null = null;

  /** Sends this player's pending games (once at a time). */
  send(userId: string): Promise<UploadSummary> {
    this.running ??= this.run(userId).finally(() => (this.running = null));
    return this.running;
  }

  private async run(userId: string): Promise<UploadSummary> {
    const summary: UploadSummary = { accepted: 0, won: 0, rejected: 0, pending: 0 };
    const games = await this.queue.list(userId);
    let i = 0;
    for (; i < games.length; i++) {
      // Signed out (or another account) meanwhile: not their games
      if (this.auth.user()?.id !== userId) break;
      const verdict = await this.upload(games[i]);
      if (!verdict || verdict.status === 'retry') break;
      await this.queue.remove(userId, [games[i].id]);
      if (verdict.status === 'accepted') {
        summary.accepted++;
        if (verdict.credit?.won) summary.won++;
      } else if (verdict.status === 'rejected') {
        summary.rejected++;
      }
    }
    summary.pending = games.length - i;
    const text = summaryText(summary);
    if (text) this.announce(text);
    return summary;
  }

  /** The app's notice at the bottom for a few seconds (a test gives its own). */
  announce: (text: string) => void = showNotice;

  /** One game's verdict; null when it could not be sent (it stays). A body the server cannot take is refused for good. */
  private async upload(game: PendingGame): Promise<OfflineGameVerdict | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ results: OfflineGameVerdict[] }>(this.api.url('/api/simulator/offline-games'), { games: [toUpload(game)] }),
      );
      return response.results.find((r) => r.id === game.id) ?? response.results[0] ?? null;
    } catch (e) {
      if (e instanceof HttpErrorResponse && (e.status === 400 || e.status === 413)) {
        return { id: game.id, status: 'rejected', reason: 'invalid', message: apiErrorMessage(e) };
      }
      // Not connected (refused at once, or no network): it waits quietly; anything else is said in the console
      if (!(e instanceof HttpErrorResponse && e.status === 0)) console.warn('[partidas sin conexión]', apiErrorMessage(e));
      return null;
    }
  }
}
