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
    <eras-modal title="Preferencias de partida" size="xl" (closed)="ref.close()">
      <eras-game-preferences-panel inGame />
    </eras-modal>
  `,
  styles: `
    /* The room of a big dialog: two columns of options, roomier, tall enough to show a whole section at once */
    eras-game-preferences-panel {
      --prefs-columns: 2;
      --prefs-gap: var(--space-2);
      --pref-padding: var(--space-3) var(--space-4);
      --prefs-height: min(34rem, calc(100dvh - 14rem));
    }
    @media (max-width: 48rem) {
      eras-game-preferences-panel {
        --prefs-columns: 1;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePreferencesDialogComponent {
  protected readonly ref = inject(DialogRef);
}
