import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarStore } from '@core/auth/avatar.store';
import { PlaymatStore } from '@core/auth/playmat.store';
import { RANK_LABELS, rankTitle } from '@data/ranks/rank.model';
import { RanksStore } from '@data/ranks/ranks.store';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { RankEmblemComponent } from '@ui/domain/rank-emblem/rank-emblem.component';
import { RankProgressComponent } from '@ui/domain/rank-emblem/rank-progress.component';

/**
 * The top of the profile: who the player is as others see them (their icon and name, over their playmat) and where
 * they stand in the ranked ladder (league and division, record, highest league, a link to the board).
 */
@Component({
  selector: 'eras-profile-hero',
  imports: [AvatarComponent, RankEmblemComponent, RankProgressComponent, RouterLink],
  template: `
    <section class="hero" [class.has-playmat]="!!playmat.url()" [style.--playmat]="playmatImage()" aria-label="Tu perfil">
      <div class="identity">
        <eras-avatar [url]="avatar.url()" [name]="username()" />
        <h2 class="name">{{ username() }}</h2>
      </div>

      <div class="rank">
        @if (ranks.mine(); as r) {
          <eras-rank-emblem [tier]="r.tier" [size]="64" />
          <div class="rank-text">
            <span class="tier">{{ title() }}</span>
            <eras-rank-progress [standing]="r" />
            <span class="record">
              <span><strong>{{ r.wins }}</strong> victorias</span>
              <span><strong>{{ r.losses }}</strong> derrotas</span>
              <span>Máximo <strong>{{ peak() }}</strong></span>
            </span>
          </div>
          <a class="board-link" routerLink="/ranking" [queryParams]="{ from: '/profile' }">Ver clasificación</a>
        } @else if (ranks.failed()) {
          <span class="muted">No se pudo cargar tu rango.</span>
        } @else {
          <span class="muted">Juega partidas ranked (Online o Modo solo) para tener rango.</span>
        }
      </div>
    </section>
  `,
  styles: `
    .hero {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4) var(--space-6);
      padding: var(--space-5) var(--space-6);
      overflow: hidden;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: linear-gradient(110deg, color-mix(in srgb, var(--color-primary) 14%, var(--color-surface)), var(--color-surface) 60%);
    }
    /* Their playmat behind, darkened towards the text */
    .hero.has-playmat {
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--color-surface) 92%, transparent) 25%, color-mix(in srgb, var(--color-surface) 55%, transparent)),
        var(--playmat) center / cover no-repeat;
    }
    .identity {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-inline-size: 0;

      eras-avatar {
        --avatar-size: 4.5rem;
      }
    }
    .name {
      margin: 0;
      overflow: hidden;
      font-family: var(--font-family-display);
      font-size: var(--font-size-2xl, 1.75rem);
      letter-spacing: 0.04em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rank {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-surface) 80%, transparent);
    }
    .rank-text {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .tier {
      font-family: var(--font-family-display);
      font-size: var(--font-size-xl);
      letter-spacing: 0.04em;
    }
    .record {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);

      strong {
        color: var(--color-text);
      }
    }
    .board-link {
      align-self: flex-end;
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      white-space: nowrap;
    }
    .muted {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    @media (max-width: 40rem) {
      .hero {
        padding: var(--space-4);
      }
      .identity eras-avatar {
        --avatar-size: 3.5rem;
      }
      .rank {
        flex-wrap: wrap;
        inline-size: 100%;
      }
      .rank-text {
        flex: 1;
        min-inline-size: 0;
      }
      .board-link {
        flex-basis: 100%;
        align-self: auto;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileHeroComponent {
  readonly username = input.required<string>();
  protected readonly ranks = inject(RanksStore);
  protected readonly avatar = inject(AvatarStore);
  protected readonly playmat = inject(PlaymatStore);

  protected readonly playmatImage = computed(() => {
    const url = this.playmat.url();
    return url ? `url("${url.replace(/"/g, '%22')}")` : null;
  });
  protected readonly title = computed(() => {
    const r = this.ranks.mine();
    return r ? rankTitle(r) : '';
  });
  protected readonly peak = computed(() => {
    const r = this.ranks.mine();
    return r ? RANK_LABELS[r.peak] : '';
  });

  constructor() {
    // Fresh when the profile opens (a ranked game may have just ended), unless just read
    void this.ranks.refreshIfStale();
  }
}
