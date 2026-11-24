import { CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, Directive, ViewEncapsulation, booleanAttribute, input } from '@angular/core';

/**
 * Styled popup menu built on CDK Menu (keyboard navigation, focus, Esc).
 * <ng-template #menu><eras-menu><button erasMenuItem (cdkMenuItemTriggered)="…">Ver</button></eras-menu></ng-template>
 * and open it with [cdkContextMenuTriggerFor]="menu" or [cdkMenuTriggerFor]="menu".
 * `floating`: no panel around the options; each one floats on its own, a card in the game's cut (mixins/cut-corners),
 * and they come in one after the other (the game's menu over the table, as its phases).
 */
@Component({
  selector: 'eras-menu',
  hostDirectives: [CdkMenu],
  template: '<ng-content />',
  styles: `
    @use 'mixins/cut-corners';

    .eras-menu {
      display: flex;
      flex-direction: column;
      min-inline-size: 11rem;
      padding: var(--space-1);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-lg);
    }
    .eras-menu-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--color-text);
      font-size: var(--font-size-sm);
      text-align: start;
      cursor: pointer;
    }
    .eras-menu-item:hover, .eras-menu-item:focus-visible { background: var(--color-surface-muted); outline: none; }
    .eras-menu-item.danger { color: var(--color-danger); }
    .eras-menu-item:disabled { opacity: 0.45; cursor: default; }
    .eras-menu-label { padding: var(--space-2) var(--space-3) var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-xs); }
    .eras-menu hr { margin: var(--space-1) 0; border: 0; border-block-start: var(--border-width) solid var(--color-border); }

    .eras-menu.floating {
      gap: var(--space-1);
      padding: 0;
      border: 0;
      background: none;
      box-shadow: none;
    }
    .eras-menu.floating hr {
      margin: var(--space-1) 0 0;
      border: 0;
    }
    .eras-menu.floating .eras-menu-item {
      --menu-item-fill: color-mix(in srgb, var(--color-surface) 92%, transparent);
      --menu-item-edge: var(--color-border);

      @include cut-corners.cut-corners(0.55rem, var(--menu-item-fill), var(--menu-item-edge));

      padding: var(--space-2) var(--space-4) var(--space-2) var(--space-3);
      backdrop-filter: blur(6px);
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-medium);
      animation: eras-menu-item-in var(--duration-base) var(--easing-standard) both;
    }
    .eras-menu.floating .eras-menu-item:hover,
    .eras-menu.floating .eras-menu-item:focus-visible {
      --menu-item-edge: var(--color-hub-accent);
      --menu-item-fill: color-mix(in srgb, var(--color-hub-accent) 14%, var(--color-surface));

      background: var(--menu-item-edge);
    }
    .eras-menu.floating .eras-menu-item.danger { --menu-item-edge: color-mix(in srgb, var(--color-danger) 60%, transparent); }
    .eras-menu.floating .eras-menu-item:nth-child(2) { animation-delay: 40ms; }
    .eras-menu.floating .eras-menu-item:nth-child(3) { animation-delay: 80ms; }
    .eras-menu.floating .eras-menu-item:nth-child(4) { animation-delay: 120ms; }
    .eras-menu.floating .eras-menu-item:nth-child(n + 5) { animation-delay: 160ms; }
    @keyframes eras-menu-item-in {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
    }
  `,
  // Not encapsulated: styles the projected items. Selectors are namespaced.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'eras-menu', '[class.floating]': 'floating()' },
})
export class MenuComponent {
  /** No panel: the options float on their own as cards in the game's cut. */
  readonly floating = input(false, { transform: booleanAttribute });
}

@Directive({
  selector: 'button[erasMenuItem]',
  hostDirectives: [{ directive: CdkMenuItem, inputs: ['cdkMenuItemDisabled: disabled'], outputs: ['cdkMenuItemTriggered: triggered'] }],
  host: { class: 'eras-menu-item', type: 'button' },
})
export class MenuItemDirective {}
