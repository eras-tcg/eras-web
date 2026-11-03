import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HubScreenComponent } from './hub-screen.component';
import { MissionsBoardComponent } from './missions-board.component';

/** "Misiones" screen of the hub, opened from the menus (home, Jugar, Social): the missions in the left column. */
@Component({
  selector: 'eras-missions-page',
  imports: [HubScreenComponent, MissionsBoardComponent],
  template: `
    <eras-hub-screen title="Misiones">
      <eras-missions-board />
    </eras-hub-screen>
  `,
  styles: `
    eras-missions-board {
      flex: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionsPage {}
