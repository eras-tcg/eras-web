import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

/**
 * A link or button that is only its icon, big and bare (no circle): on hover or focus the icon fills with gold from
 * the left, with a soft edge. "Back" on every screen and the dialogs' close button. Name it with `aria-label`; size
 * it with `--sweep-size`.
 * <a erasSweep="chevron-left" routerLink="/home" aria-label="Volver al inicio"></a>
 */
@Component({
  selector: 'a[erasSweep], button[erasSweep]',
  imports: [IconComponent],
  template: `
    <eras-icon [name]="erasSweep()" />
    <eras-icon class="lit" [name]="erasSweep()" />
  `,
  styles: `
    :host {
      --sweep-size: 2.25rem;

      display: inline-grid;
      flex-shrink: 0;
      place-items: center;
      padding: 0;
      border: 0;
      background: none;
      color: var(--color-text-muted);
      cursor: pointer;
      text-decoration: none;
      transition: transform var(--duration-fast) var(--easing-standard);
    }
    eras-icon {
      grid-area: 1 / 1;
      inline-size: var(--sweep-size);
      block-size: var(--sweep-size);
    }
    /* The gold copy shows through a mask that slides in from the left: a gold edge with a soft fade */
    .lit {
      color: var(--color-hub-accent);
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-hub-accent) 55%, transparent));
      mask: linear-gradient(90deg, #000 40%, transparent 60%) 100% 0 / 260% 100% no-repeat;
      transition: mask-position var(--duration-sweep) var(--easing-standard);
    }
    :host(:hover) .lit,
    :host(:focus-visible) .lit {
      mask-position: 0 0;
    }
    :host(:focus-visible) {
      outline: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SweepIconComponent {
  /** The icon's name (see eras-icon). */
  readonly erasSweep = input.required<IconName>();
}
