import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/**
 * One option of the table's sidebar: its icon and its name. Expanded, the name is beside the icon (at the expanded
 * width, so the opening animation uncovers it instead of reflowing it); collapsed, the name shows as a card beside the
 * bar while the pointer is on it, and still names the button. {@code on} paints a preference that is on; a notice is
 * a highlighted line that is not a button.
 *
 * <button type="button" erasSidebarItem icon="eye" [on]="shown()" (click)="toggle()">Mostrar cartas ocultas</button>
 */
@Component({
  selector: '[erasSidebarItem]',
  imports: [IconComponent],
  template: `<eras-icon [name]="$any(icon())" /><span><ng-content /></span>`,
  styleUrl: './sidebar-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.on]': 'on() === true',
    '[class.danger]': 'danger()',
    '[class.notice]': 'notice()',
    '[attr.aria-pressed]': 'on() === null || notice() ? null : on()',
  },
})
export class SidebarItemComponent {
  readonly icon = input.required<string>();
  /** A preference: on or off (null for an action). */
  readonly on = input<boolean | null>(null);
  readonly danger = input(false, { transform: booleanAttribute });
  readonly notice = input(false, { transform: booleanAttribute });
}
