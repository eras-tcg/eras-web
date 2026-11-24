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
    /* Each side a see-through channel edged in soft gold: straight at its outer end (towards the table's edge), slanted
       as its steps at the inner one (by the value); the steps slanted chips — dull gold off, lit in their side's color;
       the value on the ERAS gem (the site's icon), glowing in the color of the side it is on */
    @media all {
      :host-context(.arcane) .side {
        --channel-h: 0.9rem;
        // The steps' slant (skewX 24°) over the channel's height
        --slant: calc(var(--channel-h) * 0.445);
        // Yours, left of the value: straight at the left, slanted at the right
        --channel: polygon(0 0, 100% 0, calc(100% - var(--slant)) 100%, 0 100%);
        --channel-in: polygon(
          evenodd,
          0 0, 100% 0, calc(100% - var(--slant)) 100%, 0 100%, 0 0,
          1px 1px, calc(100% - 1.5px) 1px, calc(100% - var(--slant) - 0.6px) calc(100% - 1px), 1px calc(100% - 1px), 1px 1px
        );

        position: relative;
        align-items: center;
        gap: 3px;
        block-size: var(--channel-h);
        padding: 0 calc(var(--slant) + 0.2rem) 0 0.35rem;
        background: linear-gradient(180deg, color-mix(in srgb, var(--arcane-stone-dark) 80%, transparent), color-mix(in srgb, #1a1d23 70%, transparent));
        clip-path: var(--channel);
        mask-image: none;
        isolation: isolate;
      }
      // The rival's, right of the value: slanted at the left, straight at the right
      :host-context(.arcane) .side.theirs {
        --channel: polygon(0 0, 100% 0, 100% 100%, var(--slant) 100%);
        --channel-in: polygon(
          evenodd,
          0 0, 100% 0, 100% 100%, var(--slant) 100%, 0 0,
          1.5px 1px, calc(100% - 1px) 1px, calc(100% - 1px) calc(100% - 1px), calc(var(--slant) + 0.6px) calc(100% - 1px), 1.5px 1px
        );

        padding: 0 0.35rem 0 calc(var(--slant) + 0.2rem);
      }
      // Its edge: a ring of soft gold along the shape
      :host-context(.arcane) .side::after {
        position: absolute;
        inset: 0;
        z-index: -1;
        background: var(--arcane-gold-soft);
        clip-path: var(--channel-in);
        content: '';
      }
      // The outermost step ends straight, as the channel: upright, cut on the slant only at its inner side
      :host-context(.arcane) .step:last-child {
        --step-slant: calc(var(--channel-h) * 0.6 * 0.445);

        transform: none;
        clip-path: polygon(0 0, 100% 0, calc(100% - var(--step-slant)) 100%, 0 100%);
      }
      :host-context(.arcane) .side.theirs .step:last-child {
        clip-path: polygon(0 0, 100% 0, 100% 100%, var(--step-slant) 100%);
      }
      :host-context(.arcane) .step {
        block-size: 60%;
        border-radius: 0;
        background: color-mix(in srgb, var(--arcane-gold) 16%, #2a2f38);
        box-shadow: none;
      }
      :host-context(.arcane) .side.mine .step.lit {
        background: linear-gradient(180deg, color-mix(in srgb, var(--arcane-ally) 55%, #fff), var(--arcane-ally));
        box-shadow: 0 0 6px color-mix(in srgb, var(--arcane-ally) 70%, transparent);
      }
      :host-context(.arcane) .side.theirs .step.lit {
        background: linear-gradient(180deg, color-mix(in srgb, var(--arcane-rival) 55%, #fff), var(--arcane-rival));
        box-shadow: 0 0 6px color-mix(in srgb, var(--arcane-rival) 70%, transparent);
      }
      // The number white, outlined in dark: it reads over the gold gem
      :host-context(.arcane) .value {
        inline-size: 2.6rem;
        block-size: 2.6rem;
        color: #fff;
        font-family: var(--font-family-display);
        font-size: 1.15em;
        paint-order: stroke fill;
        -webkit-text-stroke: 4px #1a1206;
        text-shadow: 0 1px 3px rgb(0 0 0 / 70%);
      }
      :host-context(.arcane) .value::before {
        inset: 0;
        border: 0;
        border-radius: 0;
        background: url('/favicon.svg') center / contain no-repeat;
        box-shadow: none;
        filter: drop-shadow(0 3px 5px rgb(0 0 0 / 60%));
        transform: none;
      }
      :host-context(.arcane) .value.mine::before {
        filter: drop-shadow(0 0 8px color-mix(in srgb, var(--arcane-ally) 80%, transparent));
      }
      :host-context(.arcane) .value.theirs::before {
        filter: drop-shadow(0 0 8px color-mix(in srgb, var(--arcane-rival) 80%, transparent));
      }
    }

    /* Wide screens: the phone's marker, across the whole width — each bar fills its side (its steps grow sideways),
       a little taller, the gem in the middle bigger */
    @media not all and (orientation: landscape) and (max-height: 30rem) {
      .compact { gap: var(--space-3); }
      .side { gap: 6px; block-size: 1.1rem; }
      .value { inline-size: 3.25rem; block-size: 3.25rem; font-size: 1.35rem; }
      .value::before { inset: 0.5rem; border-width: 2px; }
      :host-context(.arcane) .side { --channel-h: 1.6rem; gap: 6px; }
      :host-context(.arcane) .value { inline-size: 3.75rem; block-size: 3.75rem; font-size: 1.35rem; }
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
