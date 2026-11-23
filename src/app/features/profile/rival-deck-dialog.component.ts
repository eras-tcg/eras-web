import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatchDeckCard } from '@data/simulator/matches.api';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

export interface RivalDeckData {
  rival: string;
  deckName?: string | null;
  cards: MatchDeckCard[];
}

/** The list the rival played in a game of the history (the bot's deck as it played it, varied or not). */
@Component({
  selector: 'eras-rival-deck-dialog',
  imports: [ModalComponent],
  template: `
    <eras-modal [title]="'Mazo de ' + data.rival" [subtitle]="(data.deckName ?? 'Mazo') + ' · ' + total + ' cartas'" (closed)="ref.close()">
      <ul class="list">
        @for (c of data.cards; track c.cardId ?? c.cardName) {
          <li><span class="count">{{ c.count }}×</span> {{ c.cardName ?? 'Carta' }}</li>
        }
      </ul>
    </eras-modal>
  `,
  styles: `
    .list {
      margin: 0;
      padding: 0;
      list-style: none;
      columns: 2 14rem;
      column-gap: var(--space-4);
    }
    li {
      padding: var(--space-1) 0;
      break-inside: avoid;
    }
    .count {
      display: inline-block;
      min-inline-size: 2ch;
      font-weight: 700;
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RivalDeckDialogComponent {
  protected readonly ref = inject(DialogRef);
  protected readonly data = inject<RivalDeckData>(DIALOG_DATA);
  protected readonly total = this.data.cards.reduce((n, c) => n + c.count, 0);
}
