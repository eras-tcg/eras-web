import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, WritableSignal, inject } from '@angular/core';
import { CardFilters, EMPTY_FILTERS } from '@data/cards/card-filters';
import { FilterOptions } from '@data/cards/card-rules';
import { Edition } from '@data/editions/edition.model';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { CardFiltersPanelComponent } from '../../cards/card-filters-panel/card-filters-panel.component';
import { CardView } from '../../cards/card-view';

export interface BuilderFiltersData {
  filters: WritableSignal<CardFilters>;
  view: WritableSignal<CardView>;
  options: FilterOptions;
  editions: readonly Edition[];
}

/** The catalog filters, in a dialog; changes apply live to the builder's search. */
@Component({
  selector: 'eras-builder-filters-dialog',
  imports: [ModalComponent, ButtonComponent, CardFiltersPanelComponent],
  template: `
    <eras-modal title="Filtros de búsqueda" (closed)="ref.close()">
      <eras-card-filters-panel
        [filters]="data.filters()"
        [view]="data.view()"
        [options]="data.options"
        [editions]="data.editions"
        (filtersChange)="data.filters.set($event)"
        (viewChange)="data.view.set($event)"
      />
      <ng-container modal-footer>
        <button erasButton variant="ghost" type="button" (click)="data.filters.set(empty)">Limpiar filtros</button>
        <button erasButton type="button" (click)="ref.close()">Listo</button>
      </ng-container>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuilderFiltersDialogComponent {
  protected readonly data = inject<BuilderFiltersData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly empty = EMPTY_FILTERS;
}
