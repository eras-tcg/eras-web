import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HubMenuComponent, HubMenuItem } from './hub-menu.component';
import { HubScreenComponent } from './hub-screen.component';

const LIBRARY_MENU: HubMenuItem[] = [
  { id: 'cards', label: 'Buscador de cartas', icon: 'search', route: '/cards' },
  { id: 'card-editions', label: 'Ediciones', icon: 'layers', route: '/cards/editions' },
  { id: 'collection', label: 'Colección', icon: 'archive', route: '/cards/collection' },
];

/** "Cartas" screen of the hub: the way into the cards, by search, by edition or by what the player owns. */
@Component({
  selector: 'eras-library-page',
  imports: [HubMenuComponent, HubScreenComponent],
  template: `
    <eras-hub-screen title="Cartas">
      <eras-hub-menu variant="sub" label="Cartas" [items]="menu" />
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
export class LibraryPage {
  protected readonly menu = LIBRARY_MENU;
}
