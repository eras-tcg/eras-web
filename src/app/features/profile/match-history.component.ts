import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { apiErrorMessage } from '@core/http/api-error';
import { GameStore } from '@data/simulator/game.store';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { MatchesApi, MatchSummary } from '@data/simulator/matches.api';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';

const PAGE = 20;

/** How a game ended, said to the player. */
const REASONS: Record<string, string> = {
  lives: 'por vidas',
  deck: 'sin mazo',
  surrender: 'por rendición',
  abandon: 'por abandono',
};

/** A row of the history, from the signed-in player's side. */
interface Row {
  id: string;
  endedAt: string;
  mode: string;
  ranked: boolean;
  rival: string;
  deck: string;
  result: 'won' | 'lost' | 'none';
  detail: string;
  /** It can still be watched again. */
  replay: boolean;
}

/** The signed-in player's last games (online and Modo solo): the result, the rival, the deck and how long it took. */
@Component({
  selector: 'eras-match-history',
  imports: [DatePipe, CardComponent, BadgeComponent, ButtonComponent, SpinnerComponent, AlertComponent],
  template: `
    <eras-card padding="md">
      @if (replayError(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      @if (rows(); as list) {
        <ul class="list">
          @for (r of list; track r.id) {
            <li class="row" [class.won]="r.result === 'won'" [class.lost]="r.result === 'lost'">
              <span class="result">{{ r.result === 'won' ? 'Victoria' : r.result === 'lost' ? 'Derrota' : 'Sin resultado' }}</span>
              <span class="main">
                <span class="rival">vs {{ r.rival }}</span>
                <span class="meta">{{ r.deck }} · {{ r.detail }}</span>
              </span>
              <span class="kind">
                <eras-badge>{{ r.mode }}</eras-badge>
                <eras-badge [color]="r.ranked ? 'var(--color-primary)' : null">{{ r.ranked ? 'Ranked' : 'Amistosa' }}</eras-badge>
              </span>
              <time class="when" [attr.datetime]="r.endedAt">{{ r.endedAt | date: 'd MMM, HH:mm' }}</time>
              @if (r.replay) {
                <button erasButton variant="secondary" size="sm" type="button" class="watch" [loading]="opening() === r.id" [disabled]="!!opening()" (click)="watch(r.id)">
                  Ver repetición
                </button>
              }
            </li>
          } @empty {
            <li class="empty">Todavía no juegas partidas online ni en Modo solo.</li>
          }
        </ul>
        @if (more()) {
          <button erasButton variant="secondary" type="button" [loading]="loading()" (click)="next()">Ver más</button>
        }
      } @else if (failed()) {
        <p class="empty">No se pudo cargar el historial.</p>
      } @else {
        <eras-spinner />
      }
    </eras-card>
  `,
  styles: `
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: var(--space-3) 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: grid;
      grid-template-columns: 6.5rem minmax(0, 1fr) auto auto auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-inline-start: 4px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    .row.won {
      border-inline-start-color: var(--color-success);
    }
    .row.lost {
      border-inline-start-color: var(--color-danger);
    }
    .result {
      font-weight: 700;
    }
    .main {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .rival {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta,
    .when,
    .empty {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .kind {
      display: flex;
      gap: var(--space-1);
    }
    @media (max-width: 40rem) {
      .row {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .kind,
      .when {
        justify-self: end;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHistoryComponent {
  private readonly api = inject(MatchesApi);
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameStore);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalService);

  /** The game whose replay is being opened. */
  protected readonly opening = signal<string | null>(null);
  protected readonly replayError = signal<string | null>(null);

  private readonly games = signal<MatchSummary[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly loading = signal(false);
  /** The last page came full: there may be more. */
  protected readonly more = signal(false);
  private page = 0;

  protected readonly rows = computed<Row[] | null>(() => {
    const me = this.auth.user()?.id;
    return this.games()?.map((g) => toRow(g, me)) ?? null;
  });

  constructor() {
    void this.load();
  }

  /** Opens the game's replay on the board (warned first when the cards' rules changed since). */
  protected async watch(id: string): Promise<void> {
    if (this.opening()) return;
    this.opening.set(id);
    this.replayError.set(null);
    try {
      const opened = await firstValueFrom(this.api.replay(id));
      if (!opened.sameRules) {
        const ok = await this.modal.confirm({
          title: 'Las reglas cambiaron',
          message: 'Algunas cartas cambiaron desde esta partida: la repetición puede no ser exacta.',
          confirmLabel: 'Ver igual',
        });
        if (!ok) return;
      }
      await this.game.connect(opened.roomId);
      this.game.joinRoom(null);
      await this.router.navigate(['/simulator', opened.roomId, 'board']);
    } catch (e) {
      this.replayError.set(apiErrorMessage(e, 'No se pudo abrir la repetición'));
      this.game.disconnect();
    } finally {
      this.opening.set(null);
    }
  }

  protected next(): void {
    if (!this.loading()) void this.load(this.page + 1);
  }

  private async load(page = 0): Promise<void> {
    this.loading.set(true);
    try {
      const games = await firstValueFrom(this.api.mine(page, PAGE));
      this.page = page;
      // A game played meanwhile shifts the pages: the ones already shown are not repeated
      this.games.update((g) => {
        const shown = new Set((g ?? []).map((x) => x.id));
        return [...(g ?? []), ...games.filter((x) => !shown.has(x.id))];
      });
      this.more.set(games.length === PAGE);
    } catch {
      if (!this.games()) this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}

/** A game seen from the player's side. */
export function toRow(g: MatchSummary, me: string | undefined): Row {
  const mine = g.players.find((p) => p.userId === me);
  const rival = g.players.find((p) => p.userId !== me);
  const minutes = Math.max(1, Math.round(g.durationMs / 60000));
  const reason = g.endReason ? REASONS[g.endReason] ?? g.endReason : '';
  return {
    id: g.id,
    endedAt: g.endedAt,
    mode: g.mode === 'solo' ? 'Modo solo' : 'Online',
    ranked: g.ranked,
    rival: rival?.username || (rival?.bot ? 'Bot' : 'Rival'),
    deck: mine?.deckName ?? 'Mazo',
    result: !g.winnerId ? 'none' : g.winnerId === me ? 'won' : 'lost',
    replay: !!g.hasLog,
    detail: [`${g.turns} ${g.turns === 1 ? 'turno' : 'turnos'}`, `${minutes} min`, reason].filter(Boolean).join(' · '),
  };
}
