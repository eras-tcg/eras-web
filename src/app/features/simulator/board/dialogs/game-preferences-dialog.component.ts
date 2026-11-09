import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { GamePreferencesPanelComponent } from '../game-preferences-panel.component';

/**
 * "Preferencias de partida", from the game's menu: the player's preferences in sections (the same ones the profile
 * shows), with the game's own (its bots, the browser's full screen). Opened under the board's injector.
 */
@Component({
  selector: 'eras-game-preferences-dialog',
  imports: [ModalComponent, GamePreferencesPanelComponent],
  template: `
    <eras-modal title="Preferencias de partida" (closed)="ref.close()">
      <eras-game-preferences-panel inGame />
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePreferencesDialogComponent {
  protected readonly ref = inject(DialogRef);
}
