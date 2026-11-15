import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BarListComponent } from '@ui/data/bar-list/bar-list.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { editionMetrics } from '@data/editions/edition-slots';

export interface EditionMetricsData {
  title: string;
  metrics: ReturnType<typeof editionMetrics>;
  /** A structure deck's size (its cards' copies); null for other editions. */
  deck: number | null;
}

/** An edition's card counts by rarity, level and card type. Open with ModalService. */
@Component({
  selector: 'eras-edition-metrics-dialog',
  imports: [ModalComponent, StackComponent, BarListComponent],
  template: `
    <eras-modal [title]="data.title" [subtitle]="data.metrics.total + ' cartas' + (data.deck !== null ? ' · mazo de ' + data.deck : '')" (closed)="ref.close()">
      <eras-stack [gap]="4">
        <eras-bar-list title="Rareza" [items]="data.metrics.rarity" [total]="data.metrics.total" />
        @if (data.deck !== null) {
          <eras-bar-list title="Rareza en el mazo (por copias)" [items]="data.metrics.rarityInDeck" [total]="data.deck" />
        }
        <eras-bar-list title="Nivel" [items]="data.metrics.level" [total]="data.metrics.total" />
        <eras-bar-list title="Tipo de carta" [items]="data.metrics.type" [total]="data.metrics.total" />
      </eras-stack>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionMetricsDialogComponent {
  protected readonly data = inject<EditionMetricsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef>(DialogRef);
}
