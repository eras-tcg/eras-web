import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { Deck } from '@data/decks/deck.model';
import { GamesApi } from '@data/games/games.api';
import { Game } from '@data/games/games.model';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { GameFormComponent } from './game-form.component';

export interface GameEditData {
  game: Game;
  decks: readonly Deck[];
}

/** Edits a registered game. Closes with the saved game. */
@Component({
  selector: 'eras-game-edit-dialog',
  imports: [ModalComponent, GameFormComponent, AlertComponent, ButtonComponent],
  template: `
    <eras-modal title="Editar partida" (closed)="ref.close()">
      @if (error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      <eras-game-form [value]="game()" [decks]="data.decks" (valueChange)="game.set($event)" />
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [loading]="saving()" [disabled]="saving()" (click)="save()">Guardar</button>
      </ng-container>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameEditDialogComponent {
  protected readonly data = inject<GameEditData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Game>>(DialogRef);
  private readonly api = inject(GamesApi);

  // Older games may lack the lives list
  protected readonly game = signal<Game>(
    structuredClone({
      ...this.data.game,
      player1: { ...this.data.game.player1, lives: this.data.game.player1?.lives ?? [] },
      player2: { ...this.data.game.player2, lives: this.data.game.player2?.lives ?? [] },
    }),
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async save(): Promise<void> {
    const game = this.game();
    if (!game.id) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.ref.close(await firstValueFrom(this.api.updateGame(game.id, game)));
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo guardar la partida'));
    } finally {
      this.saving.set(false);
    }
  }
}
