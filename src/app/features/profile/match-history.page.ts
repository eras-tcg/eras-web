import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageComponent } from '@ui/layout/page/page.component';
import { MatchHistoryComponent } from './match-history.component';

/** "Historial de partidas": the signed-in player's games, a view of its own opened from the profile. */
@Component({
  selector: 'eras-match-history-page',
  imports: [PageComponent, MatchHistoryComponent],
  template: `
    <eras-page title="Historial de partidas">
      <eras-match-history />
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHistoryPage {}
