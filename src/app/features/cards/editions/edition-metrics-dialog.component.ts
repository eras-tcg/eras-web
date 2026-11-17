import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardMeta, COLOR_LABELS } from '@data/cards/card.model';
import { BarListComponent } from '@ui/data/bar-list/bar-list.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { editionMetrics } from '@data/editions/edition-slots';

export interface EditionMetricsData {
  title: string;
  /** The edition's cards. */
  metas: readonly CardMeta[];
  /** A structure deck: its size (its cards' copies) is shown too. */
  structure: boolean;
}

/** The colors in the order the site shows them. */
const COLOR_ORDER = ['B', 'G', 'P', 'R', 'W'];

/** An edition's card counts by rarity, level and card type, for all its cards or one color. Open with ModalService. */
@Component({
  selector: 'eras-edition-metrics-dialog',
  imports: [ModalComponent, StackComponent, BarListComponent, ChipComponent],
  template: `
    <eras-modal [title]="data.title" [subtitle]="subtitle()" (closed)="ref.close()">
      <eras-stack [gap]="4">
        @if (colors().length > 1) {
          <eras-stack direction="row" [gap]="1" wrap role="group" aria-label="Color">
            <button erasChip [selected]="color() === null" (click)="color.set(null)">Todos</button>
            @for (c of colors(); track c) {
              <button erasChip [selected]="color() === c" (click)="color.set(c)">{{ colorLabels[c] ?? c }}</button>
            }
          </eras-stack>
        }
        <eras-bar-list title="Rareza" [items]="metrics().rarity" [total]="metrics().total" />
        @if (deck(); as d) {
          <eras-bar-list title="Rareza en el mazo (por copias)" [items]="metrics().rarityInDeck" [total]="d" />
        }
        <eras-bar-list title="Nivel" [items]="metrics().level" [total]="metrics().total" />
        <eras-bar-list title="Tipo de carta" [items]="metrics().type" [total]="metrics().total" />
      </eras-stack>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionMetricsDialogComponent {
  protected readonly data = inject<EditionMetricsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef>(DialogRef);
  protected readonly colorLabels = COLOR_LABELS;

  /** The color shown; null: every card. */
  protected readonly color = signal<string | null>(null);
  protected readonly colors = computed(() =>
    [...new Set(this.data.metas.map((m) => (m.colorIdentity ?? '').toUpperCase()).filter(Boolean))].sort(
      (a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b),
    ),
  );
  private readonly shown = computed(() => {
    const c = this.color();
    return c ? this.data.metas.filter((m) => (m.colorIdentity ?? '').toUpperCase() === c) : this.data.metas;
  });
  protected readonly metrics = computed(() => editionMetrics(this.shown()));
  /** A structure deck's size among the cards shown (their copies); null for other editions. */
  protected readonly deck = computed(() =>
    this.data.structure ? this.shown().reduce((sum, m) => sum + (m.deckCopies ?? 0), 0) : null,
  );
  protected readonly subtitle = computed(() => {
    const d = this.deck();
    return `${this.metrics().total} cartas${d !== null ? ' · mazo de ' + d : ''}`;
  });
}
