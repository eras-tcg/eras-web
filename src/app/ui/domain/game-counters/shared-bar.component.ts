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

    /* Phones in landscape: the value and the two bars (the radio group above stays for screen readers) */
    @media (orientation: landscape) and (max-height: 30rem) {
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
