import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CanDirective } from '@core/auth/can.directive';
import { legacyUrl } from '@core/navigation/legacy-url';
import { CatalogCard } from '@data/cards/card.model';
import { nameVariants } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { EditionsStore } from '@data/editions/editions.store';
import { CardDetailComponent } from '@ui/domain/card-detail/card-detail.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { cardDetailView } from '../card-detail-view';

export interface CardDetailDialogData {
  /** The grid as currently filtered and sorted; prev/next walk through it. */
  cards: readonly CatalogCard[];
  index: number;
}

/** One card in detail. ←/→ move through the grid; the printing arrows switch between editions of the same name. */
@Component({
  selector: 'eras-card-detail-dialog',
  imports: [CardDetailComponent, ButtonComponent, IconComponent, CanDirective],
  templateUrl: './card-detail-dialog.component.html',
  styleUrl: './card-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
})
export class CardDetailDialogComponent {
  private readonly data = inject<CardDetailDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly store = inject(CardsStore);
  private readonly editions = inject(EditionsStore);

  /** Position in the grid. Switching printings changes `card` but not the grid position. */
  protected readonly index = signal(this.data.index);
  private readonly printing = signal<CatalogCard | null>(null);

  protected readonly gridCard = computed(() => this.data.cards[this.index()]);
  protected readonly card = computed(() => this.printing() ?? this.gridCard());
  protected readonly hasPrevious = computed(() => this.index() > 0);
  protected readonly hasNext = computed(() => this.index() < this.data.cards.length - 1);

  protected readonly variants = computed(() => nameVariants(this.gridCard(), this.store.cards(), this.editions.releaseDates()));
  protected readonly variantIndex = computed(() => this.variants().findIndex((c) => c.id === this.card().id));

  protected readonly view = computed(() => cardDetailView(this.card(), this.store.ref()));

  protected readonly legacyCardsUrl = legacyUrl('/cards');

  protected move(step: -1 | 1): void {
    const next = this.index() + step;
    if (next < 0 || next >= this.data.cards.length) return;
    this.index.set(next);
    this.printing.set(null);
  }

  protected switchPrinting(step: -1 | 1): void {
    const target = this.variants()[this.variantIndex() + step];
    if (target) this.printing.set(target);
  }

  protected onKey(event: KeyboardEvent): void {
    // Leave arrows alone while typing in a field
    if (event.target instanceof Element && event.target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowLeft') this.move(-1);
    if (event.key === 'ArrowRight') this.move(1);
  }
}
