import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ToggleOption {
  value: string;
  /** Accessible name. */
  label: string;
  /** Text shown in the button; defaults to the label. Ignored for swatches. */
  text?: string;
  /** CSS color: a swatch (`swatch: true`) or a dot before the text. */
  color?: string;
  /** Show only a color swatch, no text. */
  swatch?: boolean;
}

/**
 * One block of joined toggle buttons (segmented control). Works for single or multiple choice:
 * the parent decides which values are on and handles `toggled`.
 * <eras-toggle-group label="Color" [options]="colors" [selected]="active" (toggled)="toggle($event)" />
 */
@Component({
  selector: 'eras-toggle-group',
  template: `
    <span class="label">{{ label() }}</span>
    <div class="group" role="group" [attr.aria-label]="label()">
      @for (o of options(); track o.value) {
        <button
          type="button"
          class="segment"
          [class.on]="selected().includes(o.value)"
          [class.swatch]="o.swatch"
          [attr.aria-pressed]="selected().includes(o.value)"
          [attr.aria-label]="o.swatch ? o.label : null"
          [style.--segment-color]="o.color ?? null"
          (click)="toggled.emit(o.value)"
        >
          @if (!o.swatch) {
            @if (o.color) {
              <span class="dot" aria-hidden="true"></span>
            }
            {{ o.text ?? o.label }}
          }
        </button>
      }
    </div>
  `,
  styles: `
    @use 'mixins/cut-corners';

    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .label {
      color: var(--color-text);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
    }
    .group {
      display: flex;
      inline-size: 100%;
      padding: 3px;
      gap: 3px;

      @include cut-corners.cut-corners(0.6rem, var(--color-surface-muted), var(--color-border));
    }
    .segment {
      --segment-color: var(--color-text);
      --segment-fill: transparent;
      --segment-edge: transparent;

      @include cut-corners.cut-corners(0.45rem, var(--segment-fill), var(--segment-edge));

      display: inline-flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      min-block-size: 2.1rem;
      padding: var(--space-1) var(--space-2);
      color: var(--color-text-subtle);
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--duration-fast) var(--easing-standard),
        border-color var(--duration-fast) var(--easing-standard),
        color var(--duration-fast) var(--easing-standard),
        opacity var(--duration-fast) var(--easing-standard);
    }
    .segment:hover {
      color: var(--color-text-muted);
    }
    .segment:focus-visible {
      --segment-edge: var(--color-focus);

      outline: none;
    }
    /* On: tinted with its color, outlined, full-strength text */
    .segment.on {
      --segment-edge: color-mix(in srgb, var(--segment-color) 70%, transparent);
      --segment-fill: color-mix(in srgb, var(--segment-color) 18%, var(--color-surface));

      color: var(--color-text);
      font-weight: var(--font-weight-bold);
    }
    .dot {
      inline-size: 0.6rem;
      block-size: 0.6rem;
      border-radius: 50%;
      background: var(--segment-color);
      opacity: 0.35;
    }
    .segment.on .dot {
      opacity: 1;
    }
    /* Swatches: the whole button takes the color when on; off ones are faint and crossed out */
    .segment.swatch {
      --segment-fill: color-mix(in srgb, var(--segment-color) 14%, transparent);
    }
    .segment.swatch::after {
      position: absolute;
      inset: 50% 18%;
      block-size: 2px;
      border-radius: 2px;
      background: var(--color-text-subtle);
      transform: rotate(-20deg);
      content: '';
    }
    .segment.swatch:hover {
      --segment-fill: color-mix(in srgb, var(--segment-color) 35%, transparent);
    }
    .segment.swatch.on {
      --segment-edge: color-mix(in srgb, var(--segment-color) 60%, #000);
      --segment-fill: var(--segment-color);
    }
    .segment.swatch.on::after {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleGroupComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly ToggleOption[]>();
  readonly selected = input.required<readonly string[]>();
  readonly toggled = output<string>();
}
