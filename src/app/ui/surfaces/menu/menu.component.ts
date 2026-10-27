import { CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, Directive, ViewEncapsulation } from '@angular/core';

/**
 * Styled popup menu built on CDK Menu (keyboard navigation, focus, Esc).
 * <ng-template #menu><eras-menu><button erasMenuItem (cdkMenuItemTriggered)="…">Ver</button></eras-menu></ng-template>
 * and open it with [cdkContextMenuTriggerFor]="menu" or [cdkMenuTriggerFor]="menu".
 */
@Component({
  selector: 'eras-menu',
  hostDirectives: [CdkMenu],
  template: '<ng-content />',
  styles: `
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
    .eras-menu hr { margin: var(--space-1) 0; border: 0; border-block-start: var(--border-width) solid var(--color-border); }
  `,
  // Not encapsulated: styles the projected items. Selectors are namespaced.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'eras-menu' },
})
export class MenuComponent {}

@Directive({
  selector: 'button[erasMenuItem]',
  hostDirectives: [{ directive: CdkMenuItem, inputs: ['cdkMenuItemDisabled: disabled'], outputs: ['cdkMenuItemTriggered: triggered'] }],
  host: { class: 'eras-menu-item', type: 'button' },
})
export class MenuItemDirective {}
