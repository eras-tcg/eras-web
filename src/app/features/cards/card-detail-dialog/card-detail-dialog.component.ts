import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CanDirective } from '@core/auth/can.directive';
import { legacyUrl } from '@core/navigation/legacy-url';
import { CARD_TYPE_LABELS, COLOR_LABELS, CatalogCard, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { cardImageUrl, fullEditionId, nameVariants, renderEffect, renderKeywordEffect } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { EditionsStore } from '@data/editions/editions.store';
import { CardDetailComponent, CardFact, CardTextGroup } from '@ui/domain/card-detail/card-detail.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';

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

  protected readonly view = computed(() => {
    const card = this.card();
    const meta = card.meta;
    const ref = this.store.ref();
    const facts: CardFact[] = [];
    const add = (label: string, value: unknown, wide = false) => {
      if (value !== null && value !== undefined && value !== '') facts.push({ label, value: String(value), wide });
    };
    if (meta) {
      add('Tipo de carta', meta.cardType ? (CARD_TYPE_LABELS[meta.cardType] ?? meta.cardType) : null);
      add('Coste', meta.cost);
      add('Fuerza', meta.strength);
      add('Nivel', meta.level);
      add('Iniciador', meta.starter ? 'Sí' : null);
      add('Clases', meta.cardClasses?.join(', '));
      add('Regulación', meta.regulation);
      add('Coste especial', meta.specialCost);
      add('Invocación especial', meta.specialSummonKind ? (SPECIAL_SUMMON_LABELS[meta.specialSummonKind] ?? meta.specialSummonKind) : null);
      add('Rareza', meta.rarity);
      add('Colores', meta.colors?.map((c) => COLOR_LABELS[c] ?? c).join(', '));
      add('Requerimiento', meta.requirement, true);
    }
    const groups: CardTextGroup[] = meta
      ? [
          {
            title: 'Efectos',
            lines: [...(meta.effects ?? []).map((e) => renderEffect(e, ref)), ...(meta.keywordEffects ?? []).map((k) => renderKeywordEffect(k, ref))],
          },
          {
            title: 'Efectos heredados',
            lines: [
              ...(meta.inheritEffects ?? []).map((e) => renderEffect(e, ref)),
              ...(meta.inheritKeywordEffects ?? []).map((k) => renderKeywordEffect(k, ref)),
            ],
          },
        ]
      : [];
    return {
      name: card.name ?? '—',
      edition: fullEditionId(card),
      number: card.number,
      color: card.color_identity,
      colorLabel: card.color_identity ? (COLOR_LABELS[card.color_identity] ?? card.color_identity) : null,
      imageUrl: cardImageUrl(card),
      facts,
      groups,
      notice: meta ? null : 'Esta carta todavía no tiene metadatos.',
    };
  });

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
