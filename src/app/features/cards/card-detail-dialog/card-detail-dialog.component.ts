import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EditDirective } from '@core/auth/edit.directive';
import { apiErrorMessage } from '@core/http/api-error';
import { CatalogCard } from '@data/cards/card.model';
import { nameVariants } from '@data/cards/card-rules';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CardsStore } from '@data/cards/cards.store';
import { metaForImage, metaFormFor } from '@data/cards/meta-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { CardDetailComponent } from '@ui/domain/card-detail/card-detail.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { firstValueFrom } from 'rxjs';
import { cardDetailView } from '../card-detail-view';
import { MetaFormData, MetaFormDialogComponent } from '../meta-form/meta-form-dialog.component';
import { cardImageUrl } from '@data/cards/card-rules';

export interface CardDetailDialogData {
  /** The grid as currently filtered and sorted; prev/next walk through it. */
  cards: readonly CatalogCard[];
  index: number;
}

/** One card in detail. ←/→ move through the grid; the printing arrows switch between editions of the same name. */
@Component({
  selector: 'eras-card-detail-dialog',
  imports: [CardDetailComponent, AlertComponent, ButtonComponent, IconComponent, EditDirective],
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
  private readonly admin = inject(CardsAdminApi);
  private readonly modal = inject(ModalService);

  /** Position in the grid. Switching printings changes `card` but not the grid position. */
  protected readonly index = signal(this.data.index);
  private readonly printing = signal<CatalogCard | null>(null);

  protected readonly gridCard = computed(() => this.data.cards[this.index()]);
  protected readonly card = computed(() => this.printing() ?? this.gridCard());
  protected readonly hasPrevious = computed(() => this.index() > 0);
  protected readonly hasNext = computed(() => this.index() < this.data.cards.length - 1);
  /** Only a list of cards has arrows (one card alone, as from the simulator, has none). */
  protected readonly navigable = this.data.cards.length > 1;

  protected readonly variants = computed(() => nameVariants(this.gridCard(), this.store.cards(), this.editions.releaseDates()));
  protected readonly variantIndex = computed(() => this.variants().findIndex((c) => c.id === this.card().id));

  protected readonly view = computed(() => cardDetailView(this.card(), this.store.ref()));

  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  // ── Administration (manage_cards) ─────────────────────────────────────
  // The grid behind is a snapshot, so after any change the dialog closes and the catalog reloads.

  protected async editMeta(): Promise<void> {
    const card = this.card();
    const data: MetaFormData = {
      form: card.meta ? metaFormFor(card) : metaForImage(card, this.store.metaList()),
      metaId: card.meta?.id ?? null,
      imageUrl: cardImageUrl(card),
      ref: this.store.ref(),
    };
    this.ref.close();
    const saved = await firstValueFrom(this.modal.open<boolean>(MetaFormDialogComponent, { data, width: 'min(64rem, 96vw)' }).closed);
    if (saved) void this.store.load(true);
  }

  protected async rename(): Promise<void> {
    const card = this.card();
    const name = await this.modal.prompt({ title: 'Renombrar carta', label: 'Nombre de la imagen', value: card.name ?? '', confirmLabel: 'Renombrar' });
    if (!name || name === card.name) return;
    await this.run(() => firstValueFrom(this.admin.renameImage(card.id, name)), 'No se pudo renombrar');
  }

  protected async remove(what: 'meta' | 'image' | 'both'): Promise<void> {
    const card = this.card();
    const text = { meta: 'los metadatos', image: 'la imagen', both: 'la imagen y los metadatos' }[what];
    const ok = await this.modal.confirm({ title: 'Eliminar', message: `¿Eliminar ${text} de "${card.name}"? No se puede deshacer.`, confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const metaId = card.meta?.id;
    await this.run(async () => {
      if (what !== 'meta') await firstValueFrom(this.admin.deleteImage(card.id));
      if (what !== 'image' && metaId) await firstValueFrom(this.admin.deleteMeta(metaId));
    }, 'No se pudo eliminar');
  }

  private async run(task: () => Promise<unknown>, fallback: string): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await task();
      this.ref.close();
      void this.store.load(true);
    } catch (e) {
      this.actionError.set(apiErrorMessage(e, fallback));
    } finally {
      this.busy.set(false);
    }
  }

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
