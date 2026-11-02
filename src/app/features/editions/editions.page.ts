import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EditDirective } from '@core/auth/edit.directive';
import { EditionsStore } from '@data/editions/editions.store';
import { Edition } from '@data/editions/edition.model';
import { shopProducts } from '@data/shop/shop-rules';
import { WalletStore } from '@data/shop/wallet.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { EditionFormDialogComponent } from './edition-form/edition-form-dialog.component';
import { WalletBadgeComponent } from './wallet-badge.component';

/**
 * Editions as a shop with simulated gems (WalletStore): every edition as a card-shaped tile with its prices;
 * each one opens its own screen (/editions/:id) to see the odds and the cards and to buy. One screen high, only
 * the grid scrolls. With manage_editions, create editions.
 */
@Component({
  selector: 'eras-editions-page',
  imports: [DecimalPipe, RouterLink, EditDirective, PageComponent, GridComponent, WalletBadgeComponent, AlertComponent, EmptyStateComponent, ButtonComponent, IconComponent, SpinnerComponent],
  templateUrl: './editions.page.html',
  styleUrl: './editions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionsPage {
  protected readonly store = inject(EditionsStore);
  protected readonly wallet = inject(WalletStore);
  private readonly modal = inject(ModalService);

  protected readonly products = (edition: Edition) => shopProducts(edition);

  constructor() {
    void this.store.load();
    this.wallet.refresh();
  }

  protected openForm(): void {
    this.modal.open(EditionFormDialogComponent, { data: null });
  }
}
