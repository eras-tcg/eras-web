import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

const LABELS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** The positions of each side, from the middle outwards (indexes of LABELS): yours to the left, the rival's to the right. */
const MINE = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const THEIRS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/**
 * Shared gem bar: 21 positions (10…0…10); the marker sits on `index`. Clicking a position moves it.
 * Phones in landscape (no room for 21 buttons): the value in the middle, and on each side a bar of 10 steps that fills
 * from the middle towards the side the gems are on (green yours, red the rival's), as the marker on the table; its
 * steps can be clicked as the positions.
 */
@Component({
  selector: 'eras-shared-bar',
  template: `
    <div class="bar" role="radiogroup" aria-label="Contador compartido de gemas">
      @for (label of labels; track $index; let i = $index) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="i === index()"
          [attr.aria-label]="(i < 10 ? 'Tu lado ' : i > 10 ? 'Lado rival ' : '') + label"
          [class.active]="i === index()"
          [class.mine]="i < 10"
          [class.theirs]="i > 10"
          (click)="positionSelected.emit(i)"
        >
          {{ label }}
        </button>
      }
    </div>

    <div class="compact" aria-hidden="true">
      <div class="side mine">
        @for (i of mine; track i) {
          <button type="button" tabindex="-1" class="step" [class.lit]="index() <= i" (click)="positionSelected.emit(i)"></button>
        }
      </div>
      <button type="button" tabindex="-1" class="value" [class.mine]="index() < 10" [class.theirs]="index() > 10" (click)="positionSelected.emit(10)">
        {{ value() }}
      </button>
      <div class="side theirs">
        @for (i of theirs; track i) {
          <button type="button" tabindex="-1" class="step" [class.lit]="index() >= i" (click)="positionSelected.emit(i)"></button>
        }
      </div>
    </div>
  `,
  styles: `
    .bar { display: grid; grid-template-columns: repeat(21, minmax(0, 1fr)); gap: 2px; }
    .bar button {
      padding: var(--space-1) 0;
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .bar button.mine { border-block-end: 2px solid var(--color-success); }
    .bar button.theirs { border-block-end: 2px solid var(--color-danger); }
    .bar button.active { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-on-primary); font-weight: var(--font-weight-bold); }

    .compact { display: none; }

    /* On every screen: the value and the two bars (the radio group above stays for screen readers) */
    @media all {
      .bar {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      .compact {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: var(--space-2);
      }
      // Each side: slanted steps that light up from the middle outwards, fainter towards the edge of the table
      .side {
        display: flex;
        gap: 3px;
        block-size: 0.5rem;
      }
      .side.mine {
        flex-direction: row-reverse;
        mask-image: linear-gradient(to left, #000 60%, rgb(0 0 0 / 45%));
      }
      .side.theirs { mask-image: linear-gradient(to right, #000 60%, rgb(0 0 0 / 45%)); }
      // Mirrored: each side's steps lean towards the middle
      .side.theirs .step { transform: skewX(24deg); }
      .step {
        flex: 1;
        padding: 0;
        border: 0;
        border-radius: 2px;
        background: color-mix(in srgb, var(--color-text) 16%, transparent);
        transform: skewX(-24deg);
        transition: background var(--duration-fast, 120ms) ease, box-shadow var(--duration-fast, 120ms) ease;
        cursor: pointer;
      }
      .side.mine .step.lit {
        background: linear-gradient(90deg, var(--color-success), color-mix(in srgb, var(--color-success) 70%, white));
        box-shadow: 0 0 6px color-mix(in srgb, var(--color-success) 70%, transparent);
      }
      .side.theirs .step.lit {
        background: linear-gradient(90deg, color-mix(in srgb, var(--color-danger) 70%, white), var(--color-danger));
        box-shadow: 0 0 6px color-mix(in srgb, var(--color-danger) 70%, transparent);
      }
      // The value in a cut gem: its color is the side the gems are on (none in the middle)
      .value {
        position: relative;
        display: grid;
        place-items: center;
        inline-size: 2rem;
        block-size: 2rem;
        padding: 0;
        border: 0;
        background: none;
        color: var(--color-text-muted);
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-bold);
        font-variant-numeric: tabular-nums;
        cursor: pointer;
      }
      .value::before {
        position: absolute;
        inset: 0.3rem;
        z-index: -1;
        border: 1.5px solid currentColor;
        border-radius: 4px;
        background: color-mix(in srgb, currentColor 14%, var(--color-surface));
        box-shadow: 0 0 10px color-mix(in srgb, currentColor 40%, transparent);
        transform: rotate(45deg);
        content: '';
      }
      .value.mine { color: var(--color-success); }
      .value.theirs { color: var(--color-danger); }
      .compact { isolation: isolate; }
    }

    /* "Estilo de la mesa: arcano" (the table sets --arcane-*): a channel cut in the stone with faceted gems, the value
       in a big cut gem ringed in gold; on wide screens, the positions are engraved tiles */
    :host-context(.arcane) .bar button {
      border-color: var(--arcane-gold-soft);
      background: linear-gradient(180deg, #23272f, #15181d);
      color: #b9b2a2;
      font-family: var(--font-family-display);
    }
    :host-context(.arcane) .bar button.mine { border-block-end-color: var(--arcane-ally); }
    :host-context(.arcane) .bar button.theirs { border-block-end-color: var(--arcane-rival); }
    :host-context(.arcane) .bar button.active {
      border-color: var(--arcane-gold);
      background: radial-gradient(circle at 35% 30%, #fff8, transparent 40%), var(--arcane-ally);
      box-shadow: 0 0 0 1px var(--arcane-gold), 0 0 12px color-mix(in srgb, var(--arcane-ally) 60%, transparent);
      color: #fff;
    }
    :host-context(.arcane) .bar button.active.theirs {
      background: radial-gradient(circle at 35% 30%, #fff8, transparent 40%), var(--arcane-rival);
      box-shadow: 0 0 0 1px var(--arcane-gold), 0 0 12px color-mix(in srgb, var(--arcane-rival) 60%, transparent);
    }
    @media all {
      :host-context(.arcane) .side {
        align-items: center;
        gap: 2px;
        block-size: 0.9rem;
        padding: 0 0.35rem;
        border-radius: 0.5rem;
        background: linear-gradient(180deg, var(--arcane-stone-dark), #1a1d23);
        box-shadow: inset 0 2px 4px rgb(0 0 0 / 80%), 0 1px 0 rgb(255 255 255 / 6%), 0 0 0 1px var(--arcane-gold-soft);
        mask-image: none;
      }
      :host-context(.arcane) .step {
        aspect-ratio: 1;
        block-size: auto;
        max-block-size: 0.5rem;
        border: 1px solid #3a404b;
        border-radius: 1px;
        /* A dull gem (a long cut): its ridge catches a faint light, the rest smoky */
        background:
          linear-gradient(180deg, rgb(255 255 255 / 16%) 0 22%, transparent 22%),
          linear-gradient(180deg, #4a4f5a 0, #2f343d 46%, #15181d 54%, #2a2f38 100%);
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 6%);
        transform: rotate(-45deg);
      }
      // Mirrored: each side's gems lean towards the middle
      :host-context(.arcane) .side.theirs .step { transform: rotate(45deg); }
      /* Lit: a cut gem of the side's color — the shine along its ridge, the light facet above, the dark one below */
      :host-context(.arcane) .side.mine .step.lit {
        border-color: #c8f9da;
        background:
          linear-gradient(180deg, rgb(255 255 255 / 70%) 0 18%, transparent 18%),
          linear-gradient(180deg, #b7f7cf 0, var(--arcane-ally) 46%, #0f6b33 54%, #16a34a 100%);
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%), 0 0 8px var(--arcane-ally);
      }
      :host-context(.arcane) .side.theirs .step.lit {
        border-color: #ffd6d6;
        background:
          linear-gradient(180deg, rgb(255 255 255 / 70%) 0 18%, transparent 18%),
          linear-gradient(180deg, #ffd0d0 0, var(--arcane-rival) 46%, #7a1b1e 54%, #c0353a 100%);
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%), 0 0 8px var(--arcane-rival);
      }
      :host-context(.arcane) .value {
        inline-size: 2.4rem;
        block-size: 2.4rem;
        color: #fff;
        font-family: var(--font-family-display);
        text-shadow: 0 1px 2px rgb(0 0 0 / 60%);
      }
      /* The value in a big cut gem: four facets lit from the top left and a shine, ringed in gold */
      :host-context(.arcane) .value::before {
        inset: 0.4rem;
        border: 0;
        background:
          linear-gradient(135deg, rgb(255 255 255 / 45%) 0 20%, transparent 20%),
          conic-gradient(from 0deg at 50% 50%, #9aa0aa 0 25%, #5b616c 25% 50%, #1e2229 50% 75%, #3b414c 75% 100%);
        box-shadow: 0 0 0 2px var(--arcane-gold), 0 3px 8px rgb(0 0 0 / 60%);
      }
      :host-context(.arcane) .value.mine::before {
        background:
          linear-gradient(135deg, rgb(255 255 255 / 55%) 0 20%, transparent 20%),
          conic-gradient(from 0deg at 50% 50%, #86efac 0 25%, var(--arcane-ally) 25% 50%, #0f6b33 50% 75%, #16a34a 75% 100%);
        box-shadow: 0 0 0 2px var(--arcane-gold), 0 0 16px color-mix(in srgb, var(--arcane-ally) 60%, transparent);
      }
      :host-context(.arcane) .value.theirs::before {
        background:
          linear-gradient(135deg, rgb(255 255 255 / 55%) 0 20%, transparent 20%),
          conic-gradient(from 0deg at 50% 50%, #fca5a5 0 25%, var(--arcane-rival) 25% 50%, #7a1b1e 50% 75%, #c0353a 75% 100%);
        box-shadow: 0 0 0 2px var(--arcane-gold), 0 0 16px color-mix(in srgb, var(--arcane-rival) 60%, transparent);
      }
    }

    /* Wide screens: the phone's marker, across the whole width — each bar fills its side (its steps grow sideways),
       a little taller, the gem in the middle bigger */
    @media not all and (orientation: landscape) and (max-height: 30rem) {
      .compact { gap: var(--space-3); }
      .side { gap: 6px; block-size: 1.1rem; }
      .value { inline-size: 3.25rem; block-size: 3.25rem; font-size: 1.35rem; }
      .value::before { inset: 0.5rem; border-width: 2px; }
      :host-context(.arcane) .side { gap: 6px; block-size: 1.6rem; padding: 0 0.75rem; border-radius: 0.8rem; }
      /* Thick bars (thin ones look frail across a wide screen) */
      :host-context(.arcane) .step { max-block-size: 1.15rem; border-width: 1.5px; border-radius: 2px; }
      :host-context(.arcane) .value { inline-size: 3.75rem; block-size: 3.75rem; font-size: 1.35rem; }
      :host-context(.arcane) .value::before { inset: 0.55rem; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedBarComponent {
  readonly index = input.required<number>();
  readonly positionSelected = output<number>();
  protected readonly labels = LABELS;
  protected readonly mine = MINE;
  protected readonly theirs = THEIRS;
  /** The number at the marker (0 in the middle, up to 10 on either side). */
  protected readonly value = computed(() => LABELS[this.index()] ?? 0);
}
