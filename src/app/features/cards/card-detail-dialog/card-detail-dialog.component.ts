import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, Injector, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EditDirective } from '@core/auth/edit.directive';
import { apiErrorMessage } from '@core/http/api-error';
import { AltArt, CardMeta, CatalogCard } from '@data/cards/card.model';
import { altArtName, altArtsOf, cardCreatureUrl, cardShineUrl, fullEditionId, isGlossyRarity, nameVariants, withAltArt } from '@data/cards/card-rules';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CardsStore } from '@data/cards/cards.store';
import { FINISHES, FINISH_LABELS, bestAlt, bestFinish, bestFinishAmong, nearestFinish, shineOf } from '@data/collection/collection-rules';
import { Finish } from '@data/collection/collection.model';
import { CollectionStore } from '@data/collection/collection.store';
import { FoilKind } from '@data/editions/booster-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { fromPercent, toPercent } from '@data/shop/shop-rules';
import { ShopOddsStore } from '@data/shop/shop-odds.store';
import { CardArtViewerComponent, CardArtViewerData } from '@ui/domain/card-art-viewer/card-art-viewer.component';
import { CardDetailComponent } from '@ui/domain/card-detail/card-detail.component';
import { CreatureSummonComponent } from '@ui/domain/creature-summon/creature-summon.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { DetailFrameComponent } from '@ui/surfaces/detail-frame/detail-frame.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { firstValueFrom } from 'rxjs';
import { cardDetailView } from '../card-detail-view';

export interface CardDetailDialogData {
  /** The grid as currently filtered and sorted; prev/next walk through it. */
  cards: readonly CatalogCard[];
  index: number;
  /** A copy obtained (as in a pack's opening): its foil shines, and it does not switch to other printings. */
  copy?: { foil: FoilKind | null };
  /** The player's collection is on (catalog): each printing shines in the finest finish they own of it. */
  collection?: boolean;
  /** Read only (opened from a game): no administration, even for editors. */
  readonly?: boolean;
}

/**
 * Opens cards in detail: `cards` is the list ←/→ walk (one card alone has no arrows), `index` the one shown first.
 * Every page that shows a card in detail opens it through here.
 */
export function openCardDetailDialog(
  modal: ModalService,
  cards: readonly CatalogCard[],
  index = 0,
  options: Pick<CardDetailDialogData, 'copy' | 'collection' | 'readonly'> = {},
): void {
  const data: CardDetailDialogData = { cards, index, ...options };
  modal.open(CardDetailDialogComponent, { data });
}

/**
 * One card in detail. ←/→ move through the grid; the printing arrows switch between editions of the same name. In the
 * plain catalog (no collection, no obtained copy) the buttons under the card show its versions: each finish and each
 * alternative art.
 */
@Component({
  selector: 'eras-card-detail-dialog',
  imports: [CardDetailComponent, CardImageComponent, AlertComponent, ButtonComponent, IconComponent, EditDirective, ToggleGroupComponent, DetailFrameComponent, CreatureSummonComponent],
  templateUrl: './card-detail-dialog.component.html',
  styleUrl: './card-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailDialogComponent {
  protected readonly data = inject<CardDetailDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly store = inject(CardsStore);
  private readonly editions = inject(EditionsStore);
  private readonly admin = inject(CardsAdminApi);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  private readonly collection = inject(CollectionStore);
  private readonly injector = inject(Injector);
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
  /**
   * The version picked under the card (plain catalog only): a finish and an art (null: the usual one). The finish is a
   * preference that stays while moving to other cards and printings; the art is the card's own and resets.
   */
  protected readonly preferredFinish = signal<Finish>('plain');
  protected readonly pickedArt = signal<string | null>(null);

  /** The finishes the card shown comes in (every printing comes in all of them). */
  private readonly availableFinishes = computed<readonly Finish[]>(() => FINISHES);
  /** The finish shown: the preferred one, or the closest the card comes in. */
  protected readonly pickedFinish = computed(() => nearestFinish(this.preferredFinish(), this.availableFinishes()) ?? 'plain');

  protected readonly finishOptions = computed<ToggleOption[]>(() => this.availableFinishes().map((f) => ({ value: f, label: FINISH_LABELS[f] })));
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

  /**
   * The card's shine image, from its metadata: its image may come as a copy the page holds (the collection's), whose
   * address says nothing of the card. An alternative art shown keeps its gold and its foil's cut, not its glossy coat
   * (its texts may sit otherwise; the frame, name and code, and the boxes the foil leaves clear are the card's).
   */
  protected readonly shine = computed(() => cardShineUrl(this.card().meta));
  /** Its creature cut out of the illustration (a full-art card): its summon can be seen from here. */
  protected readonly creature = computed(() => cardCreatureUrl(this.card().meta));
  protected readonly summoning = signal(false);
  protected readonly altShown = computed(() => this.shown() !== this.card());

  protected readonly view = computed(() => cardDetailView(this.shown(), this.store.ref(), this.store.unprogrammedOf(this.card())));

  constructor() {
    this.openOwnedPrinting();
    // An alternative art without odds of its own shows the shop's
    void this.shopOdds.load();
  }

  /** The card as shown (its version: finish and art) over the whole screen. */
  protected openArt(): void {
    const data: CardArtViewerData = {
      src: this.view().imageUrl,
      alt: this.view().name,
      foil: this.foil(),
      shine: this.shine(),
      noGloss: this.altShown(),
      gloss: this.glossMask(),
      gold: this.goldMask(),
    };
    this.modal.open(CardArtViewerComponent, { data, maxWidth: '100vw', maxHeight: '100dvh' });
  }

  /** The card builder, loaded only when a mask is drawn. */
  private renderer() {
    return import('../../admin/card-editor/render/card-render.service').then(({ CardRenderService }) =>
      this.injector.get(CardRenderService),
    );
  }

  /**
   * A card of rarity R and above has a glossy coat on its boxes and numbers' circles: where it goes, drawn from its
   * template. Not for an alternative art shown, which may be laid out otherwise.
   */
  private glossMask(): Promise<string | null> | null {
    const meta = this.card().meta;
    if (!meta || !isGlossyRarity(meta.rarity) || this.shown() !== this.card()) return null;
    return this.renderer()
      .then((r) => r.glossMask(meta))
      .catch(() => null);
  }

  /**
   * A card with a gold border (any rarity, as its template draws it: the mask is null without one): where it is, for
   * its metallic shine (an alternative art's too).
   */
  private goldMask(): Promise<string | null> | null {
    const meta = this.card().meta;
    if (!meta) return null;
    return this.renderer()
      .then((r) => r.goldMask(meta))
      .catch(() => null);
  }

  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  // ── Administration (manage_cards) ─────────────────────────────────────
  // The grid behind is a snapshot, so after any change the dialog closes and the catalog reloads.

  /** The card in the card editor (an image without metadata opens there as a new card at its code). */
  protected openEditor(): void {
    const card = this.card();
    const code = `${fullEditionId(card)}-${card.color_identity ?? ''}${String(card.number ?? 0).padStart(2, '0')}`;
    this.ref.close();
    void this.router.navigate(['/card-editor'], { queryParams: card.meta ? { card: card.meta.id } : { slot: code } });
  }

  /** The editor of its creature cut out of the illustration (for its full-art summon), loaded only when opened. */
  protected async openCutout(): Promise<void> {
    const meta = this.card().meta;
    if (!meta) return;
    const { CreatureCutoutDialogComponent } = await import('../../admin/creature-cutout/creature-cutout-dialog.component');
    const v = this.view();
    const ref = this.modal.open<CardMeta | null>(CreatureCutoutDialogComponent, {
      data: {
        metaId: meta.id,
        name: v.name,
        level: meta.level ?? null,
        identity: v.color ? `var(--color-card-${v.color.toLowerCase()})` : '#64748b',
        creature: cardCreatureUrl(meta),
      },
      width: '100vw',
      height: '100dvh',
      maxWidth: '100vw',
      maxHeight: '100dvh',
    });
    const changed = await firstValueFrom(ref.closed);
    if (changed) {
      this.printing.set({ ...this.card(), meta: changed });
      void this.store.load(true);
    }
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

  /** Deletes the whole card: its image and its metadata. */
  protected async remove(): Promise<void> {
    const card = this.card();
    const ok = await this.modal.confirm({
      title: 'Eliminar carta',
      message: `¿Eliminar "${card.name}"? No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    const metaId = card.meta?.id;
    await this.run(async () => {
      await firstValueFrom(this.admin.deleteImage(card.id));
      if (metaId) await firstValueFrom(this.admin.deleteMeta(metaId));
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

  /** Another card or printing opens in its usual art, in the finish preferred (or the closest it comes in). */
  private resetVersion(): void {
    this.pickedArt.set(null);
  }
}
