import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RANK_LABELS, RankTier } from '@core/ranks/rank-tier';

/** How each tier's gem is drawn: its silhouette, its cuts (cut out of it, as the ERAS gem's edges) and its tones. */
interface GemArt {
  /** The silhouette's points (64-unit box). */
  outline: string;
  /** The cuts: one path, stroked out of the silhouette. */
  cuts: string;
  /** Lit side (top left) and far side. */
  light: string;
  dark: string;
}

/**
 * Each tier a stone more cut than the one below, in the ERAS gem's language («Espiral», design/cardback): solid faces in
 * one tone lit from the top left, the cuts empty, no outlines. A rough iron stone with a crack, bronze, silver, a gold
 * hexagonal cut, a platinum emerald cut, a diamond with every facet.
 */
const ART: Record<Exclude<RankTier, 'CHALLENGER'>, GemArt> = {
  IRON: {
    outline: '14,24 24,12 42,10 54,22 52,42 38,54 20,52 10,38',
    cuts: 'M26 11 L33 31 L24 53 M33 31 L53 30',
    light: '#9ca3af',
    dark: '#374151',
  },
  BRONZE: {
    outline: '22,6 42,6 58,22 58,42 42,58 22,58 6,42 6,22',
    cuts: 'M26.5 17 L37.5 17 L47 26.5 L47 37.5 L37.5 47 L26.5 47 L17 37.5 L17 26.5 Z M26.5 17 L22 6 M47 26.5 L58 22 M37.5 47 L42 58 M17 37.5 L6 42',
    light: '#f0b27a',
    dark: '#8a4f24',
  },
  SILVER: {
    outline: '32,5 8.6,18.5 8.6,45.5 32,59 55.4,45.5 55.4,18.5',
    cuts: 'M32 20 L21.6 26 L21.6 38 L32 44 L42.4 38 L42.4 26 Z M32 20 L32 5 M21.6 38 L8.6 45.5 M42.4 38 L55.4 45.5',
    light: '#f8fafc',
    dark: '#7c8a9e',
  },
  // A hexagonal cut: a wide table, every corner cut to the girdle (silver's hexagon, all six faces apart)
  GOLD: {
    outline: '32,4 7.8,18 7.8,46 32,60 56.2,46 56.2,18',
    cuts: 'M32 17 L19 24.5 L19 39.5 L32 47 L45 39.5 L45 24.5 Z M32 17 L32 4 M19 24.5 L7.8 18 M19 39.5 L7.8 46 M32 47 L32 60 M45 39.5 L56.2 46 M45 24.5 L56.2 18',
    light: '#fde68a',
    dark: '#b7791f',
  },
  PLATINUM: {
    outline: '18,6 46,6 56,16 56,48 46,58 18,58 8,48 8,16',
    cuts: 'M23 15 L41 15 L47 21 L47 43 L41 49 L23 49 L17 43 L17 21 Z M23 15 L18 6 M41 15 L46 6 M47 21 L56 16 M47 43 L56 48 M41 49 L46 58 M23 49 L18 58 M17 43 L8 48 M17 21 L8 16',
    light: '#99f6e4',
    dark: '#0f766e',
  },
  DIAMOND: {
    outline: '16,10 48,10 60,25 32,60 4,25',
    cuts: 'M4 25 L60 25 M16 10 L22 25 L32 10 L42 25 L48 10 M22 25 L32 60 M42 25 L32 60 M13 25 L32 60 M51 25 L32 60',
    light: '#dbeafe',
    dark: '#2563eb',
  },
};

/**
 * Retador: the ERAS gem itself («Espiral»: the table turned, the five edges to the girdle bowed), its five side faces in
 * the game's five colours (azul, verde, violeta, rojo, blanco) and a gold table. Drawn from design/cardback at 0.15.
 */
const CHALLENGER_FACES: { d: string; fill: string }[] = [
  { d: 'M38.2 15.1 Q39 6.7 32 2 L14.4 7.7 L3.5 22.7 Q10.1 17.5 17.8 20.9 Z', fill: 'var(--color-card-b)' },
  { d: 'M17.8 20.9 Q10.1 17.5 3.5 22.7 L3.5 41.3 L14.4 56.3 Q11.5 48.4 17.1 42.1 Z', fill: 'var(--color-card-g)' },
  { d: 'M17.1 42.1 Q11.5 48.4 14.4 56.3 L32 62 L49.6 56.3 Q41.2 56.6 37 49.3 Z', fill: 'var(--color-card-p)' },
  { d: 'M37 49.3 Q41.2 56.6 49.6 56.3 L60.5 41.3 L60.5 22.7 Q58.2 30.8 50 32.6 Z', fill: 'var(--color-card-r)' },
  { d: 'M50 32.6 Q58.2 30.8 60.5 22.7 L49.6 7.7 L32 2 Q39 6.7 38.2 15.1 Z', fill: 'var(--color-card-w)' },
];
const CHALLENGER_TABLE = 'M38.2 15.1 L17.8 20.9 L17.1 42.1 L37 49.3 L50 32.6 Z';
const CHALLENGER_CUTS =
  'M38.2 15.1 Q39 6.7 32 2 M17.8 20.9 Q10.1 17.5 3.5 22.7 M17.1 42.1 Q11.5 48.4 14.4 56.3 M37 49.3 Q41.2 56.6 49.6 56.3 M50 32.6 Q58.2 30.8 60.5 22.7 ' +
  CHALLENGER_TABLE;

let nextId = 0;

/**
 * A ranked tier's emblem: a stone more cut tier by tier (iron, bronze, silver, gold, a platinum emerald cut, a diamond)
 * and, for Retador, the ERAS gem in the game's five colours; all in the ERAS gem's flat language, the cuts empty.
 */
@Component({
  selector: 'eras-rank-emblem',
  template: `
    <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" role="img" [attr.aria-label]="label()">
      <defs>
        <!-- Lit from the top left, to the far side -->
        <linearGradient [attr.id]="id + '-tone'" x1="0.1" y1="0.1" x2="0.9" y2="0.9">
          <stop offset="0" [attr.stop-color]="art()?.light ?? '#fff6cf'" />
          <stop offset="1" [attr.stop-color]="art()?.dark ?? '#8a5c0e'" />
        </linearGradient>
        <!-- A soft glow where the light falls -->
        <radialGradient [attr.id]="id + '-glow'" cx="0.42" cy="0.38" r="0.34">
          <stop offset="0" stop-color="#fff" stop-opacity="0.4" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <!-- Retador's five colours under one light: brighter top left, darker far side -->
        <linearGradient [attr.id]="id + '-shade'" x1="0.1" y1="0.1" x2="0.9" y2="0.9">
          <stop offset="0" stop-color="#fff" stop-opacity="0.25" />
          <stop offset="0.5" stop-color="#fff" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.35" />
        </linearGradient>
        <radialGradient [attr.id]="id + '-table'" cx="0.45" cy="0.45" r="0.65">
          <stop offset="0" stop-color="#fff6cf" />
          <stop offset="0.5" stop-color="#f3cf62" />
          <stop offset="1" stop-color="#b9821c" />
        </radialGradient>
        <!-- The cuts, out of the stone -->
        <mask [attr.id]="id + '-cut'" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          <path [attr.d]="cuts()" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
        </mask>
      </defs>
      <g [attr.mask]="'url(#' + id + '-cut)'">
        @if (art(); as a) {
          <polygon [attr.points]="a.outline" [attr.fill]="'url(#' + id + '-tone)'" />
          <polygon [attr.points]="a.outline" [attr.fill]="'url(#' + id + '-glow)'" />
        } @else {
          @for (f of challengerFaces; track f.fill) {
            <path [attr.d]="f.d" [attr.fill]="f.fill" />
          }
          <!-- the faces' light: the same tone over all five -->
          <path [attr.d]="challengerOutline" [attr.fill]="'url(#' + id + '-shade)'" />
          <path [attr.d]="challengerTable" [attr.fill]="'url(#' + id + '-table)'" />
        }
      </g>
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

  protected readonly id = `rank-gem-${++nextId}`;
  protected readonly art = computed(() => {
    const tier = this.tier();
    return tier === 'CHALLENGER' ? null : ART[tier];
  });
  protected readonly cuts = computed(() => this.art()?.cuts ?? CHALLENGER_CUTS);
  protected readonly label = computed(() => `Rango ${RANK_LABELS[this.tier()]}`);
  protected readonly challengerFaces = CHALLENGER_FACES;
  protected readonly challengerTable = CHALLENGER_TABLE;
  protected readonly challengerOutline = 'M32 2 L49.6 7.7 L60.5 22.7 L60.5 41.3 L49.6 56.3 L32 62 L14.4 56.3 L3.5 41.3 L3.5 22.7 L14.4 7.7 Z';
}
