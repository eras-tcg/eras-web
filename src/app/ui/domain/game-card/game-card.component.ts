import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardFaceComponent } from '../card-face/card-face.component';
import { roman } from './roman';

/** What the table shows of a card with its information on: cost, type, classes and level. */
export interface GameCardInfo {
  cost: number | null;
  type: 'creature' | 'utility' | 'structure' | null;
  classes: readonly string[];
  level: number | null;
}

const TYPE_LABELS = { creature: 'Criatura', utility: 'Utilidad', structure: 'Estructura' } as const;


/**
 * A card on the game table: the card itself (eras-card-face: picture or back, still shine, foil, peek) with what the
 * table adds around it: tapped rotation, strength and attachment badges, the table's information, target glow.
 */
@Component({
  selector: 'eras-game-card',
  imports: [IconComponent, CardFaceComponent],
  template: `
    <!-- Face down, or with neither picture nor name: its back. A test card without art shows its name -->
    <eras-card-face
      [src]="imageUrl()"
      [name]="name()"
      [hidden]="hidden() || (!imageUrl() && !name())"
      [peeked]="peeked()"
      [foil]="foil()"
      [turned]="upsideDown()"
      eager
    />
    @if (strength() !== null) {
      <span class="strength" [class.up]="modifier() > 0" [class.down]="modifier() < 0">
        {{ modifier() > 0 ? '▲' : modifier() < 0 ? '▼' : '' }}{{ strength() }}
      </span>
    }
    @if (info(); as i) {
      <!-- The table's information while it is held, each over its place on the printed card: cost at the top left, type
           on the top edge, level in its circle at the bottom left; the classes as badges in the middle -->
      @if (i.cost !== null) {
        <span class="info-cost" [attr.aria-label]="'Coste ' + i.cost">{{ i.cost }}</span>
      }
      @if (i.type) {
        <span class="info-type" role="img" [attr.aria-label]="typeLabels[i.type]" [title]="typeLabels[i.type]"><eras-icon [name]="i.type" /></span>
      }
      @if (i.classes.length) {
        <span class="info-classes">
          @for (c of i.classes; track c) {
            <span class="info-class">{{ c }}</span>
          }
        </span>
      }
      @if (i.level !== null) {
        <span class="info-level" [attr.aria-label]="'Nivel ' + i.level">{{ romanOf(i.level) }}</span>
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
    @use 'mixins/cut-corners';

    :host {
      position: relative;
      display: block;
      inline-size: var(--game-card-width, 4.5rem);
      aspect-ratio: 63 / 88;
      border-radius: var(--radius-card);
      overflow: visible;
      transition: transform var(--duration-fast) var(--easing-standard), box-shadow var(--duration-fast) var(--easing-standard);
      user-select: none;
    }
    :host(.small) { --game-card-width: 3.25rem; }
    :host(.tapped) { transform: rotate(90deg); }
    // The rival's card, as across a real table: the card turns round; its badges go to their places on the turned card
    // (below), their text still upright
    // Exhausted, the rival's card shows its art sideways the other way: its badges' text turns with it
    :host(.upside-down.tapped) { --badge-turn: 180deg; }
    .strength, .badge { rotate: var(--badge-turn, 0deg); }
    :host(.targeted) { box-shadow: 0 0 0 3px var(--color-danger), 0 0 14px var(--color-danger); }
    :host(.source) { box-shadow: 0 0 0 3px var(--color-primary); }
    :host(.selectable) { cursor: crosshair; }
    eras-card-face { position: absolute; inset: 0; }
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
    /* The table's information, sized with the card and inside it (off its neighbours): one row along the top — the
       cost at the left, the type in the middle, the strength at the right, all the same size on the same line — the
       level at the bottom left and the classes as plates across the middle; on the rival's turned card, mirrored */
    :host(.with-info) {
      --info-size: max(1.3rem, 20cqi);
      --info-font: max(0.72rem, 11cqi);
      --info-edge: 3.5%;

      container-type: inline-size;
    }
    .info-cost, .info-type, .info-classes, .info-level { position: absolute; z-index: 1; pointer-events: none; }
    .info-cost, .info-type, .info-level {
      display: grid;
      place-items: center;
      inline-size: var(--info-size);
      aspect-ratio: 1;
      font-size: var(--info-font);
      font-weight: var(--font-weight-bold);
      font-variant-numeric: tabular-nums;
      line-height: 1;
      rotate: var(--badge-turn, 0deg);
    }
    /* The cost: a blue hexagon, lit from above */
    .info-cost {
      inset-block-start: var(--info-edge);
      inset-inline-start: var(--info-edge);
      clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
      background:
        linear-gradient(160deg, rgb(255 255 255 / 35%), transparent 45%),
        linear-gradient(160deg, var(--color-sim-ally), color-mix(in srgb, var(--color-sim-ally) 45%, #000));
      color: #fff;
      text-shadow: 0 1px 2px rgb(0 0 0 / 60%);
    }
    /* The type: its icon on a dark disc ringed in gold, in the middle of the top row */
    .info-type {
      inset-block-start: var(--info-edge);
      inset-inline-start: 50%;
      translate: -50% 0;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 30%, #2a2620, #0c0e12);
      box-shadow: 0 0 0 1.5px var(--color-sim-gold), 0 2px 4px rgb(0 0 0 / 50%);
      color: var(--color-frame-gold-pale);
    }
    .info-type eras-icon { inline-size: 62%; block-size: 62%; }
    /* The level: its roman numeral in gold on a dark disc ringed in gold, at the bottom left */
    .info-level {
      inset-block-end: var(--info-edge);
      inset-inline-start: var(--info-edge);
      border-radius: 50%;
      background: radial-gradient(circle at 50% 30%, #3a2a10, #120c04);
      box-shadow: 0 0 0 1.5px var(--color-sim-gold), 0 2px 4px rgb(0 0 0 / 50%);
      color: var(--color-sim-gold);
      font-family: var(--font-family-display);
      font-size: calc(var(--info-font) * 0.85);
      font-weight: var(--font-weight-regular);
    }
    /* The classes: plates in the game's cut across the middle, one above the other */
    .info-classes {
      inset-inline: 8%;
      inset-block-start: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25em;
      translate: 0 -50%;
      rotate: var(--badge-turn, 0deg);
    }
    .info-class {
      @include cut-corners.cut-corners(0.35em, rgb(12 12 20 / 88%), var(--color-sim-gold));

      max-inline-size: 100%;
      overflow: hidden;
      padding: 0.2em 0.7em;
      color: var(--color-frame-gold-pale);
      font-family: var(--font-family-display);
      font-size: max(0.55rem, 8cqi);
      letter-spacing: 0.06em;
      line-height: 1.2;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
    }
    /* The strength in the top row too: as big as the cost and the type, on the same line; it only grows to fit the
       arrow of a change */
    :host(.with-info) .strength {
      inset-block-start: var(--info-edge);
      inset-inline-end: var(--info-edge);
      z-index: 1;
      display: grid;
      place-items: center;
      min-inline-size: var(--info-size);
      block-size: var(--info-size);
      padding: 0 0.3em;
      border: 0;
      box-shadow: 0 0 0 1.5px rgb(27 29 36 / 70%), 0 2px 4px rgb(0 0 0 / 50%);
      font-size: var(--info-font);
      line-height: 1;
    }
    /* The rival's card is turned round: each badge at its place there (the opposite corner or edge), text upright */
    :host(.upside-down) .strength { inset-block: auto -0.4rem; inset-inline: -0.4rem auto; }
    :host(.upside-down) .badge { inset-block: -0.35rem auto; }
    :host(.upside-down) .materials { inset-inline: auto -0.3rem; }
    :host(.upside-down) .info-cost { inset-block: auto var(--info-edge); inset-inline: auto var(--info-edge); }
    :host(.upside-down) .info-type { inset-block: auto var(--info-edge); }
    :host(.upside-down) .info-level { inset-block: var(--info-edge) auto; inset-inline: auto var(--info-edge); }
    :host(.upside-down.with-info) .strength { inset-block: auto var(--info-edge); inset-inline: var(--info-edge) auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tapped]': 'tapped()',
    '[class.targeted]': 'targeted()',
    '[class.source]': 'source()',
    '[class.small]': 'small()',
    '[class.selectable]': 'selectable()',
    '[class.with-info]': 'info() !== null',
    '[class.upside-down]': 'upsideDown()',
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
  /** The copy's shine, as its owner has it (shown only face up). */
  readonly foil = input<'foil' | 'prism' | null>(null);
  /** The rival's card, turned round as across a real table: its art upside down, its badges at their turned places. */
  readonly upsideDown = input(false, { transform: booleanAttribute });

  protected readonly typeLabels = TYPE_LABELS;
  protected romanOf(level: number): string {
    return roman(level);
  }

  protected readonly materials = computed(() => (this.hidden() ? 0 : this.materialsCount()));
  protected readonly resources = computed(() => (this.hidden() ? 0 : this.resourcesCount()));
}
