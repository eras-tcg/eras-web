import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

import { RankProgressView, rankDetail } from '@core/ranks/rank-tier';

type SeriesGame = 'won' | 'lost' | 'open';

/**
 * What goes beside the rank's title: the promotion series of Platino and Diamante (its three games, won or lost),
 * Retador's points, and the shields of Plata and Oro.
 */
@Component({
  selector: 'eras-rank-progress',
  template: `
    @let s = standing();
    @if (s.tier === 'CHALLENGER') {
      <span class="points">{{ text() }}</span>
    } @else if (s.inSeries) {
      <span class="series" role="img" [attr.aria-label]="text()">
        @for (r of series(); track $index) {
          <span class="pip" [class.won]="r === 'won'" [class.lost]="r === 'lost'"></span>
        }
      </span>
      @if (!compact()) {
        <span class="points">{{ text() }}</span>
      }
    }
    @if (s.shields > 0 && !compact()) {
      <span class="shields" role="img" [attr.aria-label]="s.shields + (s.shields === 1 ? ' escudo' : ' escudos')">
        @for (_ of shieldList(); track $index) {
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></svg>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }
    .series,
    .shields {
      display: inline-flex;
      gap: 3px;
      align-items: center;
    }
    .pip {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      border: 1.5px solid var(--color-text-muted);
    }
    .pip.won {
      background: var(--color-success);
      border-color: var(--color-success);
    }
    .pip.lost {
      background: var(--color-danger);
      border-color: var(--color-danger);
    }
    .shields svg {
      fill: color-mix(in srgb, var(--color-primary) 35%, transparent);
      stroke: var(--color-primary);
      stroke-width: 2;
    }
    .points {
      font-weight: 700;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankProgressComponent {
  readonly standing = input.required<RankProgressView>();
  /** Without the shields (small places). */
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly text = computed(() => rankDetail(this.standing()) ?? '');
  /** The series' three games: won, lost or still to play. */
  protected readonly series = computed(() => {
    const s = this.standing();
    const open = Math.max(0, 3 - s.seriesWins - s.seriesLosses);
    return [...Array<SeriesGame>(s.seriesWins).fill('won'), ...Array<SeriesGame>(s.seriesLosses).fill('lost'), ...Array<SeriesGame>(open).fill('open')];
  });
  protected readonly shieldList = computed(() => Array.from({ length: this.standing().shields }));
}
