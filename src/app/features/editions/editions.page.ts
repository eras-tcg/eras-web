import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EditDirective } from '@core/auth/edit.directive';
import { EditionsStore } from '@data/editions/editions.store';
import { Edition } from '@data/editions/edition.model';
import { isStructure, shopProducts } from '@data/shop/shop-rules';
import { WalletStore } from '@core/wallet/wallet.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { EditionFormDialogComponent } from './edition-form/edition-form-dialog.component';

/**
 * Editions as a shop with simulated gems (WalletStore): every edition as a card-shaped tile with its prices, the
 * editions (packs and boxes) apart from the structure decks;
 * each one opens its own screen (/editions/:id) to see the odds and the cards and to buy. One screen high, only
 * the grid scrolls. With manage_editions, create editions.
 */
@Component({
  selector: 'eras-editions-page',
  imports: [DecimalPipe, RouterLink, EditDirective, PageComponent, GridComponent, AlertComponent, EmptyStateComponent, ButtonComponent, IconComponent, SpinnerComponent],
  templateUrl: './editions.page.html',
  styleUrl: './editions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionsPage {
  protected readonly store = inject(EditionsStore);
  protected readonly wallet = inject(WalletStore);
  private readonly modal = inject(ModalService);

  protected readonly products = (edition: Edition) => shopProducts(edition);
  /** The shelves: editions (packs and boxes) and structure decks, each only when it has something. */
  protected readonly shelves = computed(() => {
    const all = this.store.editions();
    return [
      { title: 'Sobres', editions: all.filter((e) => !isStructure(e.editionId)) },
      { title: 'Structure decks', editions: all.filter((e) => isStructure(e.editionId)) },
    ].filter((s) => s.editions.length > 0);
  });

  constructor() {
    void this.store.load();
    this.wallet.refresh();
  }

  protected openForm(): void {
    this.modal.open(EditionFormDialogComponent, { data: null });
  }
}
