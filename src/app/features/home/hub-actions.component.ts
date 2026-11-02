import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';

interface HubAction {
  label: string;
  route: string;
  icon: IconName;
}

/** Main sections of the home hub: four big round buttons and a row of smaller shortcuts. */
@Component({
  selector: 'eras-hub-actions',
  imports: [RouterLink, IconComponent],
  templateUrl: './hub-actions.component.html',
  styleUrl: './hub-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'navigation', 'aria-label': 'Principal' },
})
export class HubActionsComponent {
  protected readonly actions: HubAction[] = [
    { label: 'Jugar', route: '/simulator', icon: 'gamepad' },
    { label: 'Mazos', route: '/my-decks', icon: 'stack' },
    { label: 'Cartas', route: '/cards', icon: 'cards' },
    { label: 'Ediciones', route: '/editions', icon: 'layers' },
  ];
  protected readonly shortcuts: HubAction[] = [
    { label: 'Constructor', route: '/deck-builder', icon: 'square-plus' },
    { label: 'Mazos públicos', route: '/public-decks', icon: 'stack' },
    { label: 'Tierlist', route: '/tierlist', icon: 'trophy' },
    { label: 'Cómo jugar', route: '/ruling', icon: 'book' },
  ];
}
