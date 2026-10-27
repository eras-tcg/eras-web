import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Small dot in a card color (B, G, P, R, W). */
@Component({
  selector: 'eras-color-pip',
  template: '',
  styles: `
    :host {
      display: inline-block;
      inline-size: 0.75em;
      block-size: 0.75em;
      border-radius: 50%;
      border: var(--border-width) solid var(--color-border);
      background: var(--pip-color, var(--color-surface-muted));
      vertical-align: middle;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--pip-color]': 'value()', 'aria-hidden': 'true' },
})
export class ColorPipComponent {
  readonly color = input.required<string | null>();
  protected readonly value = computed(() => {
    const c = this.color()?.toLowerCase();
    return c && /^[bgprw]$/.test(c) ? `var(--color-card-${c})` : null;
  });
}
