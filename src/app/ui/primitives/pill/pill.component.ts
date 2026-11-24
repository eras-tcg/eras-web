import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A short piece of text that floats over content (a count over a scrolling grid, say) on its own small glass
 * surface, beside `erasButton variant="float"` / `"glass"`.
 * <span erasPill>24 cartas</span>
 */
@Component({
  selector: 'span[erasPill]',
  template: '<ng-content />',
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-bg) 80%, transparent);
      backdrop-filter: blur(6px);
      font-size: var(--font-size-sm);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PillComponent {}
