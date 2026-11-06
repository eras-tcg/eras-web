import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HubMenuComponent, HubMenuItem } from './hub-menu.component';
import { HubScreenComponent } from './hub-screen.component';

const SOCIAL_MENU: HubMenuItem[] = [
  { id: 'public-decks', label: 'Mazos públicos', icon: 'stack', route: '/public-decks' },
  { id: 'tierlist', label: 'Tierlist', icon: 'trophy', route: '/tierlist' },
  { id: 'ranking', label: 'Clasificación', icon: 'list', route: '/ranking' },
];

/** "Social" screen of the hub: what the community shares. */
@Component({
  selector: 'eras-social-page',
  imports: [HubMenuComponent, HubScreenComponent],
  template: `
    <eras-hub-screen title="Social">
      <eras-hub-menu variant="sub" label="Comunidad" [items]="menu" />
    </eras-hub-screen>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-block-size: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialPage {
  protected readonly menu = SOCIAL_MENU;
}
