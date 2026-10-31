import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { PluralPipe } from '@ui/utilities/plural.pipe';
import { CardPeekComponent } from '../card-peek.component';

const TYPE_ORDER: Record<string, number> = { creature: 0, utility: 1, structure: 2 };

/** The deck you joined with: every card, as cards, in order (creatures by level, then utilities and structures), only to look at. */
@Component({
  selector: 'eras-decklist-dialog',
  imports: [PluralPipe, ModalComponent, GameCardComponent, CardPeekComponent],
  template: `
    <eras-modal size="xl" title="Tu mazo" [subtitle]="cards().length | plural: 'carta'" (closed)="ref.close()">
      <ol class="cards" aria-label="Cartas de tu mazo">
        @for (c of cards(); track c.instanceId) {
          <li>
            <eras-game-card [imageUrl]="c.imageUrl" [name]="c.cardName" [attr.aria-label]="c.cardName" />
            <eras-card-peek [card]="c" [mine]="true" />
          </li>
        }
      </ol>
    </eras-modal>
  `,
  styles: `
    li { position: relative; }
    .cards {
      --game-card-width: 7.5rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li { display: flex; justify-content: center; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecklistDialogComponent {
  protected readonly ref = inject(DialogRef);
  private readonly game = inject(GameStore);

  protected readonly cards = computed<CardSlot[]>(() =>
    [...(this.game.myState()?.originalDeck ?? [])].sort(
      (a, b) =>
        (TYPE_ORDER[a.cardType ?? ''] ?? 3) - (TYPE_ORDER[b.cardType ?? ''] ?? 3) ||
        (a.level ?? 0) - (b.level ?? 0) ||
        (a.cardName ?? '').localeCompare(b.cardName ?? '', 'es'),
    ),
  );
}
