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
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
    }
    .segment {
      --segment-color: var(--color-text);

      display: inline-flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      min-block-size: 2.1rem;
      padding: var(--space-1) var(--space-2);
      border: 1px solid transparent;
      border-radius: calc(var(--radius-md) - 3px);
      background: transparent;
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
      outline: 2px solid var(--color-focus);
      outline-offset: 1px;
    }
    /* On: tinted with its color, outlined, full-strength text */
    .segment.on {
      border-color: color-mix(in srgb, var(--segment-color) 70%, transparent);
      background: color-mix(in srgb, var(--segment-color) 18%, var(--color-surface));
      color: var(--color-text);
      font-weight: var(--font-weight-bold);
      box-shadow: var(--shadow-sm);
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
      position: relative;
      background: color-mix(in srgb, var(--segment-color) 14%, transparent);
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
      background: color-mix(in srgb, var(--segment-color) 35%, transparent);
    }
    .segment.swatch.on {
      border-color: color-mix(in srgb, var(--segment-color) 60%, #000);
      background: var(--segment-color);
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%), var(--shadow-sm);
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
