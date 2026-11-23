import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

/**
 * A link or button that is only its icon, big and bare (no circle): on hover or focus the icon fills with gold from
 * the left, with a soft edge. "Back" on every screen and the dialogs' close button. Name it with `aria-label`; size
 * it with `--sweep-size`.
 * `wash`: the hover also lays a band of gold behind it that fades out to the right, across the row it sits in (the
 * screen's top row): from `--sweep-wash-start` to its left (the window's edge) over `--sweep-wash-width`, and up
 * `--sweep-wash-top` above it (to the window's top).
 * <a erasSweep="chevron-left" wash routerLink="/home" aria-label="Volver al inicio"></a>
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
    /* The wash: gold at the row's left edge fading to nothing on the right; it opens from the left on hover */
    :host(.wash) {
      position: relative;
    }
    :host(.wash)::before {
      position: absolute;
      inset-block: calc(-1 * var(--sweep-wash-top, 0.5rem)) -0.5rem;
      inset-inline-start: calc(-1 * var(--sweep-wash-start, 0px));
      z-index: -1;
      inline-size: var(--sweep-wash-width, 32rem);
      background: linear-gradient(90deg, color-mix(in srgb, var(--color-hub-accent) 32%, transparent), color-mix(in srgb, var(--color-hub-accent) 10%, transparent) 45%, transparent);
      content: '';
      opacity: 0;
      pointer-events: none;
      transform: scaleX(0.2);
      transform-origin: left;
      transition:
        opacity var(--duration-sweep) var(--easing-standard),
        transform var(--duration-sweep) var(--easing-standard);
    }
    :host(.wash:hover)::before,
    :host(.wash:focus-visible)::before {
      opacity: 1;
      transform: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.wash]': 'wash()' },
})
export class SweepIconComponent {
  /** The icon's name (see eras-icon). */
  readonly erasSweep = input.required<IconName>();
  /** Also a gold band behind it on hover, fading out to the right across its row. */
  readonly wash = input(false, { transform: booleanAttribute });
}
