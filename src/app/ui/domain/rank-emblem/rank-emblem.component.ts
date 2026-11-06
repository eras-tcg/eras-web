import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RANK_LABELS, RankTier } from '@core/ranks/rank-tier';

/** How each tier's gem is drawn: its outline, its facets and its colours (light to dark). */
interface GemArt {
  outline: string;
  facets: string[];
  light: string;
  dark: string;
  edge: string;
}

/** Each tier a gem more cut and brighter than the one below: a rough stone up to a diamond of the five colours. */
const ART: Record<RankTier, GemArt> = {
  IRON: {
    outline: '14,24 24,12 42,10 54,22 52,42 38,54 20,52 10,38',
    facets: ['M24 12 L30 30 L42 10', 'M30 30 L54 22', 'M30 30 L38 54', 'M30 30 L10 38'],
    light: '#9ca3af',
    dark: '#374151',
    edge: '#1f2937',
  },
  BRONZE: {
    outline: '32,6 54,19 54,45 32,58 10,45 10,19',
    facets: ['M32 18 L43 25 L43 39 L32 46 L21 39 L21 25 Z', 'M32 6 L32 18', 'M54 19 L43 25', 'M54 45 L43 39', 'M32 58 L32 46', 'M10 45 L21 39', 'M10 19 L21 25'],
    light: '#f0b27a',
    dark: '#8a4f24',
    edge: '#5c3416',
  },
  SILVER: {
    outline: '22,6 42,6 58,22 58,42 42,58 22,58 6,42 6,22',
    facets: [
      'M26 18 L38 18 L46 26 L46 38 L38 46 L26 46 L18 38 L18 26 Z',
      'M22 6 L26 18', 'M42 6 L38 18', 'M58 22 L46 26', 'M58 42 L46 38', 'M42 58 L38 46', 'M22 58 L26 46', 'M6 42 L18 38', 'M6 22 L18 26',
    ],
    light: '#f8fafc',
    dark: '#7c8a9e',
    edge: '#475569',
  },
  GOLD: {
    outline: '18,14 46,14 58,26 32,58 6,26',
    facets: ['M6 26 L58 26', 'M18 14 L24 26 L32 14 L40 26 L46 14', 'M24 26 L32 58 L40 26', 'M14 26 L32 58 L50 26'],
    light: '#fde68a',
    dark: '#b7791f',
    edge: '#7c4a03',
  },
  PLATINUM: {
    outline: '18,6 46,6 56,16 56,48 46,58 18,58 8,48 8,16',
    facets: [
      'M22 14 L42 14 L48 20 L48 44 L42 50 L22 50 L16 44 L16 20 Z',
      'M26 22 L38 22 L40 24 L40 40 L38 42 L26 42 L24 40 L24 24 Z',
      'M18 6 L22 14', 'M46 6 L42 14', 'M56 16 L48 20', 'M56 48 L48 44', 'M46 58 L42 50', 'M18 58 L22 50', 'M8 48 L16 44', 'M8 16 L16 20',
    ],
    light: '#99f6e4',
    dark: '#0f766e',
    edge: '#134e4a',
  },
  DIAMOND: {
    outline: '16,12 48,12 60,26 32,60 4,26',
    facets: ['M4 26 L60 26', 'M16 12 L22 26 L32 12 L42 26 L48 12', 'M22 26 L32 60 L42 26', 'M12 26 L32 60 L52 26', 'M32 12 L32 26'],
    light: '#dbeafe',
    dark: '#2563eb',
    edge: '#1e3a8a',
  },
  CHALLENGER: {
    outline: '16,16 48,16 60,30 32,62 4,30',
    facets: ['M4 30 L60 30', 'M16 16 L22 30 L32 16 L42 30 L48 16', 'M32 16 L32 30'],
    light: '#fef3c7',
    dark: '#d97706',
    edge: '#78350f',
  },
};

/** Retador's pavilion: one facet per colour of the game (azul, verde, violeta, rojo, blanco). */
const CHALLENGER_FACETS: { points: string; fill: string }[] = [
  { points: '4,30 15,30 32,62', fill: 'var(--color-card-b)' },
  { points: '15,30 26,30 32,62', fill: 'var(--color-card-g)' },
  { points: '26,30 38,30 32,62', fill: 'var(--color-card-p)' },
  { points: '38,30 49,30 32,62', fill: 'var(--color-card-r)' },
  { points: '49,30 60,30 32,62', fill: 'var(--color-card-w)' },
];

let nextId = 0;

/**
 * A ranked tier's emblem: a gem, more cut and brighter tier by tier (a rough iron stone, bronze, silver, gold, a
 * platinum emerald cut, a diamond) and, for Retador, a crowned diamond of the game's five colours.
 */
@Component({
  selector: 'eras-rank-emblem',
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" role="img" [attr.aria-label]="label()">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" [attr.stop-color]="art().light" />
          <stop offset="1" [attr.stop-color]="art().dark" />
        </linearGradient>
      </defs>
      @if (tier() === 'CHALLENGER') {
        <path d="M20 13 L22 4 L27 9 L32 2 L37 9 L42 4 L44 13 Z" fill="#fbbf24" stroke="#78350f" stroke-width="1.2" stroke-linejoin="round" />
      }
      <polygon [attr.points]="art().outline" [attr.fill]="'url(#' + gradientId + ')'" [attr.stroke]="art().edge" stroke-width="2" stroke-linejoin="round" />
      @if (tier() === 'CHALLENGER') {
        @for (f of challengerFacets; track f.fill) {
          <polygon [attr.points]="f.points" [attr.fill]="f.fill" opacity="0.9" />
        }
      }
      @for (d of art().facets; track d) {
        <path [attr.d]="d" fill="none" [attr.stroke]="art().edge" stroke-width="1" stroke-opacity="0.55" stroke-linejoin="round" />
      }
      <!-- The shine on its top left -->
      <path d="M20 18 L26 16 L23 24 Z" fill="#fff" opacity="0.55" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.45));
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankEmblemComponent {
  readonly tier = input.required<RankTier>();
  /** Side in px. */
  readonly size = input(40);

  protected readonly gradientId = `rank-gem-${++nextId}`;
  protected readonly art = computed(() => ART[this.tier()]);
  protected readonly label = computed(() => `Rango ${RANK_LABELS[this.tier()]}`);
  protected readonly challengerFacets = CHALLENGER_FACETS;
}
