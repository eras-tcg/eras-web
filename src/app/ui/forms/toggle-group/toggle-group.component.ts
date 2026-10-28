import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ToggleOption {
  value: string;
  /** Accessible name (and tooltip). */
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
          [attr.title]="o.label"
          [style.--segment-color]="o.color ?? null"
          (click)="toggled.emit(o.value)"
        >
          @if (o.swatch) {
            <span class="chip" aria-hidden="true"></span>
          } @else {
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
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      gap: 3px;
    }
    .segment {
      display: inline-flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      min-block-size: 2rem;
      padding: var(--space-1) var(--space-2);
      border: 0;
      border-radius: calc(var(--radius-md) - 3px);
      background: transparent;
      color: var(--color-text-muted);
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--duration-fast) var(--easing-standard),
        color var(--duration-fast) var(--easing-standard),
        opacity var(--duration-fast) var(--easing-standard);
    }
    .segment:hover {
      color: var(--color-text);
    }
    .segment.on {
      background: var(--color-surface);
      color: var(--color-text);
      box-shadow: var(--shadow-sm);
    }
    .segment:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 1px;
    }
    .dot {
      inline-size: 0.55rem;
      block-size: 0.55rem;
      border-radius: 50%;
      background: var(--segment-color);
    }
    /* Swatches: the color fills the button; "off" ones fade out */
    .segment.swatch {
      padding: 3px;
    }
    .chip {
      inline-size: 100%;
      block-size: 1.5rem;
      border: 1px solid rgb(0 0 0 / 25%);
      border-radius: calc(var(--radius-md) - 5px);
      background: var(--segment-color);
      opacity: 0.25;
      transition: opacity var(--duration-fast) var(--easing-standard);
    }
    .segment.swatch:hover .chip {
      opacity: 0.55;
    }
    .segment.swatch.on .chip {
      opacity: 1;
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
