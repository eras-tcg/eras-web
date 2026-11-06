import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ChallengerRow, RANK_DIVISIONS, RANK_LABELS, RankTier, rankTitle } from '@data/ranks/rank.model';
import { RanksStore } from '@data/ranks/ranks.store';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { RankEmblemComponent } from '@ui/domain/rank-emblem/rank-emblem.component';
import { RankProgressComponent } from '@ui/domain/rank-emblem/rank-progress.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { HubScreenComponent } from '../home/hub-screen.component';

/** How each league is played, for the guide (low to high). */
const GUIDE: { tiers: RankTier[]; text: string }[] = [
  { tiers: ['IRON', 'BRONZE'], text: 'Cada victoria te sube una división. Las derrotas no te bajan: aquí solo se avanza.' },
  {
    tiers: ['SILVER', 'GOLD'],
    text: 'Cada victoria te sube una división y cada derrota te baja una. Al llegar a la liga tienes 2 escudos: en la división 1 cada derrota gasta uno antes de bajarte de liga.',
  },
  {
    tiers: ['PLATINUM', 'DIAMOND'],
    text: 'Cada victoria te sube una división y cada derrota te baja una; en la división 1 una derrota te baja de liga. En la última división juegas una serie de ascenso: gana 2 de 3 para subir. Si la pierdes, vuelves a la división 4.',
  },
  {
    tiers: ['CHALLENGER'],
    text: 'Sin divisiones: ganas o pierdes de 10 a 30 puntos por partida según la fuerza de tu rival (más por vencer a uno fuerte). Bajo 0 puntos vuelves a Diamante 4.',
  },
];

/**
 * "Clasificación" (in Social): the player's own rank, the Retador board, the most points first (their place, icon,
 * name and points; the player's own row marked), and a guide to how each league is played. Back goes where it was
 * opened from (`from`, else Social).
 */
@Component({
  selector: 'eras-ranking-page',
  imports: [HubScreenComponent, AvatarComponent, RankEmblemComponent, RankProgressComponent, SpinnerComponent, RouterLink],
  template: `
    <eras-hub-screen title="Clasificación" [back]="back()">
      @if (ranks.mine(); as r) {
        <!-- Where I stand: my tier and its progress -->
        <a class="mine" routerLink="/profile">
          <eras-rank-emblem [tier]="r.tier" [size]="48" />
          <span class="mine-text">
            <span class="tier">{{ titleOf(r) }}</span>
            <eras-rank-progress [standing]="r" />
          </span>
          @if (myPlace(); as place) {
            <span class="my-place">#{{ place }}</span>
          }
        </a>
      }

      <section class="board" aria-labelledby="board-title">
        <h2 id="board-title" class="board-title">
          <eras-rank-emblem tier="CHALLENGER" [size]="22" /> Retadores
        </h2>
        @if (rows(); as list) {
          <ol class="list">
            @for (row of list; track row.userId) {
              <li class="row" [class.me]="row.userId === me()">
                <span class="place">{{ row.place }}</span>
                <eras-avatar [url]="row.avatar ?? null" [name]="row.username ?? ''" />
                <span class="name">{{ row.username || 'Jugador' }}{{ row.userId === me() ? ' (tú)' : '' }}</span>
                <span class="points">{{ row.points }} <span class="unit">pts</span></span>
              </li>
            } @empty {
              <li class="empty">Todavía nadie llega a Retador. Gana partidas ranked para ser el primero.</li>
            }
          </ol>
        } @else if (failed()) {
          <p class="empty">No se pudo cargar la clasificación.</p>
        } @else {
          <eras-spinner />
        }
      </section>

      <!-- How the leagues are played -->
      <section class="guide" aria-labelledby="guide-title">
        <h2 id="guide-title" class="board-title">Guía de ligas</h2>
        <p class="intro">Las partidas ranked (Online o Modo solo) mueven tu rango. Cada liga tiene divisiones: empiezas en Hierro 1 y subes de división con cada victoria; al pasar la última, subes de liga.</p>
        @for (g of guide; track g.text) {
          <div class="league">
            <span class="emblems">
              @for (t of g.tiers; track t) {
                <eras-rank-emblem [tier]="t" [size]="32" />
              }
            </span>
            <span class="league-text">
              <strong>{{ namesOf(g.tiers) }}</strong>
              <span class="muted">{{ divisionsOf(g.tiers[0]) }}</span>
              <span>{{ g.text }}</span>
            </span>
          </div>
        }
      </section>
    </eras-hub-screen>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-block-size: 0;
    }
    .mine {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-inline-start: 3px solid var(--color-hub-accent);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      text-decoration: none;
    }
    .mine-text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-1);
    }
    .tier {
      font-family: var(--font-family-display);
      font-size: var(--font-size-lg);
      letter-spacing: 0.04em;
    }
    .my-place {
      font-weight: var(--font-weight-bold, 700);
    }
    .board {
      display: flex;
      flex: none;
      flex-direction: column;
      gap: var(--space-2);
    }
    .board-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: var(--space-3) 0 0;
      font-size: var(--font-size-sm);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      max-block-size: 22rem;
      overflow-y: auto;
      list-style: none;
    }
    .row {
      display: grid;
      grid-template-columns: 2.5rem auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);

      eras-avatar {
        --avatar-size: 2rem;
      }
    }
    .row.me {
      border-color: var(--color-hub-accent);
      box-shadow: 0 0 0 1px var(--color-hub-accent);
    }
    .place {
      font-family: var(--font-family-display);
      font-size: var(--font-size-lg);
      text-align: center;
    }
    .row:nth-child(1) .place {
      color: #fbbf24;
    }
    .row:nth-child(2) .place {
      color: #cbd5e1;
    }
    .row:nth-child(3) .place {
      color: #d29560;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .points {
      font-weight: var(--font-weight-bold, 700);
    }
    .guide {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .intro,
    .league-text span {
      margin: 0;
      font-size: var(--font-size-sm);
    }
    .league {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    .emblems {
      display: flex;
      flex: none;
      gap: var(--space-1);
      inline-size: 4.5rem;
    }
    .league-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .unit,
    .muted,
    .empty {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      font-weight: normal;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingPage {
  protected readonly ranks = inject(RanksStore);
  private readonly auth = inject(AuthService);

  /** Where it was opened from (the profile's "Ver clasificación"), else Social. */
  readonly from = input<string>();
  protected readonly back = computed(() =>
    this.from() === '/profile' ? { route: '/profile', label: 'tu perfil' } : { route: '/social', label: 'Social' },
  );
  protected readonly guide = GUIDE;
  protected readonly titleOf = rankTitle;
  protected namesOf(tiers: RankTier[]): string {
    return tiers.map((t) => RANK_LABELS[t]).join(' y ');
  }
  protected divisionsOf(tier: RankTier): string {
    return RANK_DIVISIONS[tier] ? `${RANK_DIVISIONS[tier]} divisiones` : 'Por puntos';
  }
  protected readonly rows = signal<ChallengerRow[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly me = computed(() => this.auth.user()?.id ?? null);
  /** My place on the board, when I am on it. */
  protected readonly myPlace = computed(() => this.rows()?.find((r) => r.userId === this.me())?.place ?? null);

  constructor() {
    void this.ranks.refreshIfStale();
    void this.ranks
      .challengers()
      .then((rows) => this.rows.set(rows))
      .catch(() => this.failed.set(true));
  }
}
