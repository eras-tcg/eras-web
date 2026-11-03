import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EditDirective } from '@core/auth/edit.directive';
import { apiErrorMessage } from '@core/http/api-error';
import { AltArt, CardMeta, CatalogCard } from '@data/cards/card.model';
import { altArtName, altArtsOf, nameVariants, withAltArt } from '@data/cards/card-rules';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CardsStore } from '@data/cards/cards.store';
import { FINISHES, FINISH_LABELS, bestAlt, bestFinish, bestFinishAmong, shineOf } from '@data/collection/collection-rules';
import { Finish } from '@data/collection/collection.model';
import { CollectionStore } from '@data/collection/collection.store';
import { metaForImage, metaFormFor } from '@data/cards/meta-rules';
import { FoilKind } from '@data/editions/booster-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { fromPercent, toPercent } from '@data/shop/shop-rules';
import { ShopOddsStore } from '@data/shop/shop-odds.store';
import { CardDetailComponent } from '@ui/domain/card-detail/card-detail.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
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
  /** A copy obtained (as in a pack's opening): its foil shines, and it does not switch to other printings. */
  copy?: { foil: FoilKind | null };
  /** The player's collection is on (catalog): each printing shines in the finest finish they own of it. */
  collection?: boolean;
}

/**
 * One card in detail. ←/→ move through the grid; the printing arrows switch between editions of the same name. In the
 * plain catalog (no collection, no obtained copy) the buttons under the card show its versions: each finish and each
 * alternative art.
 */
@Component({
  selector: 'eras-card-detail-dialog',
  imports: [CardDetailComponent, AlertComponent, ButtonComponent, IconComponent, EditDirective, ToggleGroupComponent],
  templateUrl: './card-detail-dialog.component.html',
  styleUrl: './card-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
})
export class CardDetailDialogComponent {
  protected readonly data = inject<CardDetailDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly store = inject(CardsStore);
  private readonly editions = inject(EditionsStore);
  private readonly admin = inject(CardsAdminApi);
  private readonly modal = inject(ModalService);
  private readonly collection = inject(CollectionStore);
  protected readonly shopOdds = inject(ShopOddsStore);

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

  /** The printing's alternative arts (none for most cards). */
  protected readonly arts = computed(() => altArtsOf(this.card()));

  /** With the collection on, the player's finest copy of this printing with an alternative art, if any. */
  private readonly altOwned = computed(() =>
    this.data.collection && !this.data.copy ? bestAlt(this.collection.collection()?.cards[this.card().id], this.arts().map((a) => a.id)) : null,
  );

  /** The plain catalog: the buttons under the card show its finishes and alternative arts. */
  protected readonly showVersions = !this.data.copy && !this.data.collection;
  /** The version picked under the card (plain catalog only): a finish and an art (null: the usual one). */
  protected readonly pickedFinish = signal<Finish>('plain');
  protected readonly pickedArt = signal<string | null>(null);

  protected readonly finishOptions: ToggleOption[] = FINISHES.map((f) => ({ value: f, label: FINISH_LABELS[f] }));
  protected readonly artOptions = computed<ToggleOption[]>(() => {
    const arts = this.arts();
    return [
      { value: '', label: 'Arte original', text: 'Original' },
      ...arts.map((a, i) => ({ value: a.id, label: `Arte ${altArtName(a, i)}`, text: a.name?.trim() || (arts.length > 1 ? `Alternativo ${i + 1}` : 'Alternativo') })),
    ];
  });

  /** The shine shown: the obtained copy's; with the collection on, the finest owned; else the finish picked. */
  protected readonly foil = computed(() => {
    if (this.data.copy) return this.data.copy.foil;
    if (this.data.collection) return shineOf(this.altOwned()?.finish ?? bestFinish(this.collection.collection()?.cards[this.card().id]));
    return shineOf(this.pickedFinish());
  });

  /** The card as shown: with the alternative art the player has (collection) or picked (catalog); its text is the same. */
  private readonly shown = computed(() => withAltArt(this.card(), this.data.collection ? (this.altOwned()?.art ?? null) : this.pickedArt()));

  protected readonly view = computed(() => cardDetailView(this.shown(), this.store.ref(), this.store.unprogrammedOf(this.card())));

  constructor() {
    this.openOwnedPrinting();
    // An alternative art without odds of its own shows the shop's
    void this.shopOdds.load();
  }

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

  // ── Alternative arts (manage_cards) ──────────────────────────────────
  // These stay in the dialog: the card shown takes the metadata the server answers, and the catalog reloads behind.

  protected readonly toPercent = toPercent;
  protected readonly altArtName = altArtName;

  /** A new alternative art from a chosen file (CardMeta.altArts), with the shop's odds until changed. */
  protected async addAlt(event: Event): Promise<void> {
    const file = this.pickedFile(event);
    const metaId = this.card().meta?.id;
    if (!file || !metaId) return;
    await this.changeArts(() => firstValueFrom(this.admin.addAltArt(metaId, file, null)), 'No se pudo guardar el arte alternativo');
  }

  /** A new image for one art (its odds and the copies already pulled with it stay). */
  protected async replaceAlt(art: AltArt, event: Event): Promise<void> {
    const file = this.pickedFile(event);
    const metaId = this.card().meta?.id;
    if (!file || !metaId) return;
    await this.changeArts(() => firstValueFrom(this.admin.replaceAltArt(metaId, art.id, file)), 'No se pudo cambiar el arte alternativo');
  }

  /** Saves one art's name (empty: "Alternativo N") and its own odds typed as a percent (empty: the shop's). */
  protected async saveAlt(art: AltArt, name: string, typedOdds: string): Promise<void> {
    const metaId = this.card().meta?.id;
    if (!metaId) return;
    const odds = typedOdds.trim() === '' ? null : fromPercent(typedOdds);
    if (odds === null && typedOdds.trim() !== '') {
      this.actionError.set('La probabilidad debe ser un número de 0 a 100 %');
      return;
    }
    const change = { name: name.trim() || null, odds };
    await this.changeArts(() => firstValueFrom(this.admin.updateAltArt(metaId, art.id, change)), 'No se pudo guardar el arte alternativo');
  }

  protected async removeAlt(art: AltArt, index: number): Promise<void> {
    const card = this.card();
    const metaId = card.meta?.id;
    if (!metaId) return;
    const ok = await this.modal.confirm({
      title: 'Quitar arte alternativo',
      message: `"${card.name}" ya no saldrá con el arte «${altArtName(art, index)}». Las copias que ya lo tienen se verán con el arte normal.`,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    if (this.pickedArt() === art.id) this.pickedArt.set(null);
    await this.changeArts(() => firstValueFrom(this.admin.removeAltArt(metaId, art.id)), 'No se pudo quitar el arte alternativo');
  }

  private pickedFile(event: Event): File | null {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    return file;
  }

  private async changeArts(task: () => Promise<CardMeta>, fallback: string): Promise<void> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      const meta = await task();
      this.printing.set({ ...this.card(), meta });
      void this.store.load(true);
    } catch (e) {
      this.actionError.set(apiErrorMessage(e, fallback));
    } finally {
      this.busy.set(false);
    }
  }

  protected pickArt(value: string): void {
    this.pickedArt.set(value === '' ? null : value);
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
    this.resetVersion();
    this.openOwnedPrinting();
  }

  /**
   * With the collection on, a card the player lacks in the grid's printing opens on the printing they own in the
   * finest finish (the grid counts every printing of a name).
   */
  private openOwnedPrinting(): void {
    const owned = this.collection.collection();
    if (!this.data.collection || this.data.copy || bestFinish(owned?.cards[this.gridCard().id])) return;
    const best = bestFinishAmong(owned, this.variants().map((c) => c.id));
    const target = best && this.variants().find((c) => bestFinish(owned?.cards[c.id]) === best);
    if (target) this.printing.set(target);
  }

  protected switchPrinting(step: -1 | 1): void {
    const target = this.variants()[this.variantIndex() + step];
    if (!target) return;
    this.printing.set(target);
    this.resetVersion();
  }

  /** Another card or printing opens in its usual version. */
  private resetVersion(): void {
    this.pickedFinish.set('plain');
    this.pickedArt.set(null);
  }

  protected onKey(event: KeyboardEvent): void {
    // Leave arrows alone while typing in a field
    if (event.target instanceof Element && event.target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowLeft') this.move(-1);
    if (event.key === 'ArrowRight') this.move(1);
  }
}
