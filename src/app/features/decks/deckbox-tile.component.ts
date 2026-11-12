import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { DeckBox } from '@data/decks/deckbox.model';
import { deckBoxColor } from '@data/decks/deckbox-rules';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/** How the covers split the tile: each piece's clip-path, by how many decks show (1 to 4). */
const PIECES: Record<number, readonly string[]> = {
  1: ['none'],
  // Two halves, cut along the diagonal
  2: ['polygon(0 0, 100% 0, 0 100%)', 'polygon(100% 0, 100% 100%, 0 100%)'],
  // Three slanted thirds (each a third of the tile)
  3: [
    'polygon(0 0, 40% 0, 26% 100%, 0 100%)',
    'polygon(40% 0, 74% 0, 60% 100%, 26% 100%)',
    'polygon(74% 0, 100% 0, 100% 100%, 60% 100%)',
  ],
  // Four quarters, the upright cut slanted like the others
  4: [
    'polygon(0 0, 57% 0, 50% 50%, 0 50%)',
    'polygon(57% 0, 100% 0, 100% 50%, 50% 50%)',
    'polygon(0 50%, 50% 50%, 43% 100%, 0 100%)',
    'polygon(50% 50%, 100% 50%, 100% 100%, 43% 100%)',
  ],
};

/** The cut lines drawn between the pieces (viewBox 0 0 100 100, stretched over the tile). */
const CUTS: Record<number, readonly string[]> = {
  1: [],
  2: ['M100 0 L0 100'],
  3: ['M40 0 L26 100', 'M74 0 L60 100'],
  4: ['M57 0 L43 100', 'M0 50 L100 50'],
};

/**
 * A deckbox in "Mazos", the size of a deck cover: its background is made of the covers of its first decks (one deck
 * fills it; two split along the diagonal; three in thirds; four or more, the first four in quarters; none, a plain
 * background), with a label in the middle (its color, name and how many decks). `dropTarget` lights it while a deck
 * is dragged over it. Tapping it opens it.
 */
@Component({
  selector: 'eras-deckbox-tile',
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="tile"
      [class.drop]="dropTarget()"
      [class.empty]="pieces().length === 0"
      [style.--box]="color()"
      [attr.aria-label]="'Abrir la deckbox ' + box().name + ', ' + countLabel()"
      (click)="opened.emit()"
    >
      @for (piece of pieces(); track $index) {
        @if (piece.url) {
          <img class="piece" [src]="piece.url" alt="" loading="lazy" draggable="false" [style.clip-path]="piece.clip" />
        } @else {
          <span class="piece blank" [style.clip-path]="piece.clip"></span>
        }
      }
      @if (pieces().length === 0) {
        <span class="placeholder" aria-hidden="true"><eras-icon name="box" /></span>
      }
      @if (cuts().length) {
        <svg class="cuts" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          @for (cut of cuts(); track $index) {
            <path [attr.d]="cut" vector-effect="non-scaling-stroke" />
          }
        </svg>
      }
      <span class="shade" aria-hidden="true"></span>
      <span class="label">
        <span class="name">{{ box().name }}</span>
        <span class="count">{{ countLabel() }}</span>
      </span>
    </button>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .tile {
      position: relative;
      display: grid;
      place-items: center;
      inline-size: 100%;
      aspect-ratio: 63 / 88;
      padding: 0;
      border: 0;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-surface-muted);
      box-shadow: var(--shadow-sm);
      color: inherit;
      cursor: pointer;
      transition:
        transform var(--duration-fast) var(--easing-standard),
        box-shadow var(--duration-fast) var(--easing-standard);
    }
    .tile:hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-2px);
    }
    .tile:focus-visible {
      outline: 3px solid var(--color-focus);
      outline-offset: 2px;
    }
    .tile.empty {
      background: linear-gradient(160deg, var(--color-surface-muted), color-mix(in srgb, var(--color-surface-muted) 80%, var(--color-text)));
    }
    /* Each cover fills the tile; its clip-path keeps only its piece */
    .piece {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .piece.blank {
      background: var(--color-surface-muted);
    }
    .placeholder {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--color-text-subtle);
    }
    .placeholder eras-icon {
      inline-size: 32%;
      block-size: 32%;
      margin-block-end: 45%;
    }
    .cuts {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .cuts path {
      fill: none;
      stroke: var(--color-surface);
      stroke-width: 3;
    }
    /* A soft veil so the label stands out over any art */
    .shade {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, color-mix(in srgb, var(--color-text) 35%, transparent), transparent 70%);
    }
    .label {
      position: relative;
      display: grid;
      gap: var(--space-1);
      justify-items: center;
      max-inline-size: 84%;
      padding: var(--space-2);
      border-block-start: 4px solid var(--box);
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--color-surface) 94%, transparent);
      color: var(--color-text);
      box-shadow: var(--shadow-md);
      text-align: center;
    }
    .name {
      display: -webkit-box;
      overflow: hidden;
      font-family: var(--font-family-display);
      /* Shrinks with the tile so a word fits whole on a phone */
      font-size: clamp(0.7rem, 8.5cqi, var(--font-size-sm));
      letter-spacing: 0.02em;
      text-transform: uppercase;
      overflow-wrap: break-word;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .count {
      color: var(--color-text-muted);
      font-size: clamp(0.65rem, 7cqi, var(--font-size-xs));
    }
    .drop {
      box-shadow:
        0 0 0 3px var(--color-focus),
        var(--shadow-lg);
      transform: scale(1.03);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckBoxTileComponent {
  readonly box = input.required<DeckBox>();
  /** Cover URLs of its first decks (null for a deck without a cover); up to four show. */
  readonly covers = input<readonly (string | null)[]>([]);
  readonly count = input.required<number>();
  readonly dropTarget = input(false, { transform: booleanAttribute });
  readonly opened = output<void>();

  protected readonly color = computed(() => deckBoxColor(this.box()));
  protected readonly pieces = computed(() => {
    const shown = this.covers().slice(0, 4);
    const clips = PIECES[shown.length] ?? [];
    return shown.map((url, i) => ({ url, clip: clips[i] }));
  });
  protected readonly cuts = computed(() => CUTS[this.pieces().length] ?? []);
  protected readonly countLabel = computed(() => {
    const n = this.count();
    return n === 0 ? 'Vacía' : `${n} ${n === 1 ? 'mazo' : 'mazos'}`;
  });
}
