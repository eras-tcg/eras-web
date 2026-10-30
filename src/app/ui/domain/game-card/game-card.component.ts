import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/** What the table shows of a card with its information on: cost, type, classes and level. */
export interface GameCardInfo {
  cost: number | null;
  type: 'creature' | 'utility' | 'structure' | null;
  classes: readonly string[];
  level: number | null;
}

const TYPE_LABELS = { creature: 'Criatura', utility: 'Utilidad', structure: 'Estructura' } as const;

function roman(n: number): string {
  const parts: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [value, letters] of parts) while (n >= value) { out += letters; n -= value; }
  return out || '0';
}

/** A card on the game table: image or back, tapped rotation, strength and attachment badges, target glow. */
@Component({
  selector: 'eras-game-card',
  imports: [IconComponent],
  template: `
    @if (!hidden() && imageUrl()) {
      <img [src]="imageUrl()" alt="" draggable="false" />
    } @else if (!hidden() && name()) {
      <!-- A card without art (a test card): its name -->
      <span class="face">{{ name() }}</span>
    } @else {
      <span class="back" aria-hidden="true"></span>
    }
    @if (peeked() && !hidden()) {
      <!-- A hidden card shown anyway: its back still covers the lower right corner -->
      <span class="back peek" aria-hidden="true"></span>
    }
    @if (strength() !== null) {
      <span class="strength" [class.up]="modifier() > 0" [class.down]="modifier() < 0">
        {{ modifier() > 0 ? '▲' : modifier() < 0 ? '▼' : '' }}{{ strength() }}
      </span>
    }
    @if (info(); as i) {
      <!-- The table's information: cost and type at the top left, level at the bottom left, classes along the bottom -->
      <span class="info-side">
        @if (i.cost !== null) {
          <span class="info-cost" [attr.aria-label]="'Coste ' + i.cost">{{ i.cost }}</span>
        }
        @if (i.type) {
          <span class="info-type" [title]="typeLabels[i.type]" [attr.aria-label]="typeLabels[i.type]"><eras-icon [name]="i.type" /></span>
        }
      </span>
      @if (i.level !== null) {
        <span class="info-level" [attr.aria-label]="'Nivel ' + i.level">{{ romanOf(i.level) }}</span>
      }
      @if (i.classes.length) {
        <span class="info-classes">
          @for (c of i.classes; track c) {
            <span>{{ c }}</span>
          }
        </span>
      }
    }
    @if (materials()) {
      <span class="badge materials" [attr.aria-label]="materials() + ' materiales'">{{ materials() }}</span>
    }
    @if (resources()) {
      <span class="badge resources" [attr.aria-label]="resources() + ' recursos'">{{ resources() }}</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      inline-size: var(--game-card-width, 4.5rem);
      aspect-ratio: 63 / 88;
      border-radius: var(--radius-sm);
      overflow: visible;
      transition: transform var(--duration-fast) var(--easing-standard), box-shadow var(--duration-fast) var(--easing-standard);
      user-select: none;
    }
    :host(.small) { --game-card-width: 3.25rem; }
    :host(.tapped) { transform: rotate(90deg); }
    :host(.targeted) { box-shadow: 0 0 0 3px var(--color-danger), 0 0 14px var(--color-danger); }
    :host(.source) { box-shadow: 0 0 0 3px var(--color-primary); }
    :host(.selectable) { cursor: crosshair; }
    img, .back, .face { display: block; inline-size: 100%; block-size: 100%; border-radius: inherit; object-fit: cover; }
    .face {
      display: grid;
      place-items: center;
      padding: 0.25rem;
      overflow: hidden;
      border: 1px dashed var(--color-border);
      background: var(--color-surface-muted);
      color: var(--color-text);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      text-align: center;
      overflow-wrap: anywhere;
    }
    .back {
      border: 1px solid rgb(255 255 255 / 25%);
      // Fixed card-back art colors: the same in both themes, like a physical card
      background: var(--color-card-back);
    }
    // Past position t of a "to bottom right" gradient lies 2·(1−t)² of the card: fading from 52% to 72% leaves about
    // 70% of the card in sight and its back over the last 30%, the lower right corner
    .peek {
      position: absolute;
      inset: 0;
      pointer-events: none;
      mask-image: linear-gradient(to bottom right, transparent 52%, #000 72%);
    }
    .strength {
      position: absolute;
      inset-block-start: -0.4rem;
      inset-inline-end: -0.4rem;
      // As big as the card allows: readable at a glance on the field
      min-inline-size: 1.6em;
      padding: 0.05em 0.4em;
      border: 2px solid rgb(27 29 36 / 70%);
      border-radius: var(--radius-pill);
      background: #f59e0b;
      color: #1b1d24;
      font-size: clamp(0.8rem, calc(var(--game-card-width, 4.5rem) * 0.17), 1.35rem);
      font-weight: var(--font-weight-bold);
      line-height: 1.3;
      text-align: center;
    }
    .strength.up { background: #22c55e; }
    .strength.down { background: #ef4444; color: #fff; }
    .badge {
      position: absolute;
      inset-block-end: -0.35rem;
      min-inline-size: 1.1rem;
      padding: 0 0.25rem;
      border-radius: var(--radius-pill);
      color: #fff;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      text-align: center;
      line-height: 1.4;
    }
    .materials { inset-inline-start: -0.3rem; background: #111; }
    /* The table's information, sized with the card so it stays inside it (and off its neighbours) */
    .info-side {
      position: absolute;
      inset-block-start: 4%;
      inset-inline-start: 4%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2em;
      font-size: clamp(0.62rem, calc(var(--game-card-width, 4.5rem) * 0.13), 1.05rem);
      pointer-events: none;
    }
    .info-cost {
      display: grid;
      place-items: center;
      inline-size: 1.75em;
      block-size: 1.75em;
      clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
      background: #1e3a8a;
      color: #fff;
      font-weight: var(--font-weight-bold);
      font-variant-numeric: tabular-nums;
      box-shadow: inset 0 0 0 2px #93c5fd;
    }
    .info-type {
      display: grid;
      place-items: center;
      inline-size: 1.6em;
      block-size: 1.6em;
      border-radius: 50%;
      background: rgb(17 17 24 / 82%);
      color: #f5f5f5;
    }
    .info-type eras-icon { inline-size: 1em; block-size: 1em; }
    .info-level {
      position: absolute;
      inset-block-end: 4%;
      inset-inline-start: 4%;
      min-inline-size: 1.7em;
      padding: 0.05em 0.3em;
      border: 2px solid #f59e0b;
      border-radius: var(--radius-pill);
      background: rgb(17 17 24 / 85%);
      color: #fcd34d;
      font: var(--font-weight-bold) clamp(0.6rem, calc(var(--game-card-width, 4.5rem) * 0.12), 1rem) / 1.2 Georgia, 'Times New Roman', serif;
      text-align: center;
      pointer-events: none;
    }
    .info-classes {
      position: absolute;
      inset-inline: 6% 6%;
      inset-block-end: 18%;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.2em;
      max-block-size: 2.7em;
      overflow: hidden;
      font-size: clamp(0.5rem, calc(var(--game-card-width, 4.5rem) * 0.1), 0.8rem);
      pointer-events: none;
    }
    .info-classes span {
      max-inline-size: 100%;
      padding: 0.05em 0.45em;
      overflow: hidden;
      border-radius: var(--radius-pill);
      background: rgb(17 17 24 / 82%);
      color: #f5f5f5;
      font-weight: var(--font-weight-bold);
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .resources { inset-inline-end: -0.3rem; background: #16a34a; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tapped]': 'tapped()',
    '[class.targeted]': 'targeted()',
    '[class.source]': 'source()',
    '[class.small]': 'small()',
    '[class.selectable]': 'selectable()',
  },
})
export class GameCardComponent {
  readonly imageUrl = input<string | null>(null);
  /** Shown instead of the art when there is none (a test card). */
  readonly name = input<string | null>(null);
  readonly hidden = input(false, { transform: booleanAttribute });
  /** A card hidden from this player that is shown anyway ("Mostrar cartas ocultas"): its back covers a corner. */
  readonly peeked = input(false, { transform: booleanAttribute });
  readonly tapped = input(false, { transform: booleanAttribute });
  readonly strength = input<number | null>(null);
  readonly modifier = input(0);
  readonly materialsCount = input(0);
  readonly resourcesCount = input(0);
  readonly targeted = input(false, { transform: booleanAttribute });
  readonly source = input(false, { transform: booleanAttribute });
  readonly small = input(false, { transform: booleanAttribute });
  /** A target is being chosen. */
  readonly selectable = input(false, { transform: booleanAttribute });
  /** The table's information about it (cost, type, classes, level); null shows none. */
  readonly info = input<GameCardInfo | null>(null);

  protected readonly typeLabels = TYPE_LABELS;
  protected romanOf(level: number): string {
    return roman(level);
  }

  protected readonly materials = computed(() => (this.hidden() ? 0 : this.materialsCount()));
  protected readonly resources = computed(() => (this.hidden() ? 0 : this.resourcesCount()));
}
