import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * A round button with only an icon, floating over something (a card, the hand). Name it with `aria-label`; place it
 * from the parent.
 *
 * <button type="button" erasIconButton icon="eye" aria-label="Ver la carta" (click)="open()"></button>
 */
@Component({
  selector: 'button[erasIconButton]',
  imports: [IconComponent],
  template: `<eras-icon [name]="$any(icon())" />`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      inline-size: 2.5rem;
      block-size: 2.5rem;
      padding: 0;
      border: 1px solid var(--color-border);
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-surface) 90%, transparent);
      color: var(--color-text);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: color var(--duration-fast, 120ms) ease, border-color var(--duration-fast, 120ms) ease, opacity var(--duration-fast, 120ms) ease;
    }
    :host(:hover:not(:disabled)), :host(:focus-visible) { color: var(--color-primary); border-color: var(--color-primary); }
    :host(:disabled) { opacity: 0.4; cursor: default; }
    :host(.size-sm) { inline-size: 1.6rem; block-size: 1.6rem; }
    :host(.size-md) { inline-size: 2rem; block-size: 2rem; }
    eras-icon { inline-size: 50%; block-size: 50%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"size-" + size()' },
})
export class IconButtonComponent {
  readonly icon = input.required<string>();
  /** sm 1.6rem, md 2rem, lg 2.5rem. */
  readonly size = input<'sm' | 'md' | 'lg'>('lg');
}
