import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConnectionService } from '@core/server/connection.service';
import { routeNeedsServer } from '@core/server/server-access';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';

export interface HubMenuItem {
  id: string;
  label: string;
  icon: IconName;
  /** Where it goes; without a route the item emits `picked`. */
  route?: string;
  /** Needs the server (by default: its route does, routeNeedsServer). */
  online?: boolean;
}

/** Whether an item needs the server: said by the item, or by its route. */
export function itemNeedsServer(item: HubMenuItem): boolean {
  return item.online ?? (item.route ? routeNeedsServer(item.route) : false);
}

/**
 * Menu of a hub screen. Wide screens: a list of big words on the left, like a game's main menu. Narrow screens:
 * `main` becomes a bar of round buttons at the bottom; `sub` a list of cards. In the installed app before connecting,
 * what needs the server carries a small cloud crossed out (opening it connects first).
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

  private readonly connection = inject(ConnectionService);

  protected needsConnect(item: HubMenuItem): boolean {
    return this.connection.needsConnect() && itemNeedsServer(item);
  }
}
