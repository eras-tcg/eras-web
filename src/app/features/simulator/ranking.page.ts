import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ChallengerRow, rankTitle } from '@data/ranks/rank.model';
import { RanksStore } from '@data/ranks/ranks.store';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { RankEmblemComponent } from '@ui/domain/rank-emblem/rank-emblem.component';
import { RankProgressComponent } from '@ui/domain/rank-emblem/rank-progress.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { HubScreenComponent } from '../home/hub-screen.component';

/**
 * "Clasificación" (in Social): the player's own rank and the Retador board, the most points first (their place, icon,
 * name and points; the player's own row marked). Only the board's list scrolls; the guide to the leagues opens from
 * the info button beside its title. Back goes where it was opened from (`from`, else Social).
 */
@Component({
  selector: 'eras-ranking-page',
  imports: [HubScreenComponent, AvatarComponent, RankEmblemComponent, RankProgressComponent, SpinnerComponent, RouterLink, ButtonComponent, IconComponent],
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
          <button type="button" erasButton variant="secondary" size="sm" class="guide-button" (click)="openGuide()"><eras-icon name="book" /> Guía de ligas</button>
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
    /* The board takes what is left of the column; only its list scrolls */
    .board {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-2);
      min-block-size: 0;
    }
    .guide-button {
      margin-inline-start: auto;
      letter-spacing: normal;
      text-transform: none;
    }
    .guide-button eras-icon {
      inline-size: 1rem;
      block-size: 1rem;
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
      flex: 1;
      min-block-size: 0;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      overscroll-behavior: none;
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
    .unit,
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
  protected readonly titleOf = rankTitle;
  private readonly modal = inject(ModalService);

  /** "Guía de ligas", in a dialog (its own chunk). */
  protected async openGuide(): Promise<void> {
    const { LeagueGuideDialogComponent } = await import('./league-guide-dialog.component');
    this.modal.open(LeagueGuideDialogComponent, { width: '36rem' });
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
