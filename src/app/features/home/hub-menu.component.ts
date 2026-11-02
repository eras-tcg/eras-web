import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';

export interface HubMenuItem {
  id: string;
  label: string;
  icon: IconName;
  /** Where it goes; without a route the item emits `picked`. */
  route?: string;
  description?: string;
  /** A small tag beside the label (e.g. "Pronto"). */
  tag?: string;
}

/**
 * Menu of a hub screen. Wide screens: a list of big words on the left, like a game's main menu. Narrow screens:
 * `main` becomes a bar of round buttons fixed at the bottom; `sub` a list of cards with their descriptions.
 */
@Component({
  selector: 'eras-hub-menu',
  imports: [NgTemplateOutlet, RouterLink, IconComponent, SpinnerComponent],
  templateUrl: './hub-menu.component.html',
  styleUrl: './hub-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'navigation', '[class]': 'variant()', '[attr.aria-label]': 'label()' },
})
export class HubMenuComponent {
  readonly items = input.required<HubMenuItem[]>();
  readonly variant = input<'main' | 'sub'>('main');
  readonly label = input('Principal');
  /** Id of the item whose action is running (shows a spinner and disables the menu). */
  readonly busy = input<string | null>(null);

  readonly picked = output<HubMenuItem>();
}
