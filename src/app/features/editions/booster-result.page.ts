import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { OpenedPack, PackTier, cardsByRarity, groupOpening, openBoxPacks, openPack, packTier, revealOrder, shuffle, upgradeOnePack } from '@data/editions/booster-rules';
import { DecksStore } from '@data/decks/decks.store';
import { pickRandomPackFromBox } from '@data/editions/edition-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { OpeningRequest, isSubEdition, productFor } from '@data/shop/shop-rules';
import { WalletStore } from '@core/wallet/wallet.store';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../cards/card-detail-dialog/card-detail-dialog.component';
import { fitItemWidth } from './fit-grid';
import { OpeningCardComponent } from './opening/opening-card.component';
import { OpeningPackComponent } from './opening/opening-pack.component';
import { PackBreakComponent } from './opening/pack-break.component';
import { ShopCheckout, purchaseTicket } from './shop-checkout';

/** unpaid: offered for sale · packs: the bought packs on the table · opening: one by one · done: the full list. */
type Phase = 'unpaid' | 'packs' | 'opening' | 'done';

/** The rarities that shine (their aura) when they turn face up. */
const SHINY = new Set(['SR', 'SEC']);
/** A pack breaking open (it charges, cracks and shatters): one pack, and each of a box's (quicker). */
const BREAK_MS = { pack: 1600, box: 1000 };
/** Time between two plain cards turning, and between two special ones (slower), in a pack and in a box. */
const PLAIN_MS = { pack: 300, box: 110 };
const SPECIAL_MS = { pack: 1600, box: 1000 };
/** Pause after the plain cards, before the special ones. */
const BEFORE_SPECIAL_MS = 700;
const BETWEEN_PACKS_MS = 650;
/** How long the pack that goes up a rarity shakes on the table before it does. */
const UPGRADE_SHAKE_MS = 1400;
const CARD_RATIO = 63 / 88;
/** The packs on the table: never bigger than this, and this far apart. */
const PACK_MAX_PX = 260;
const PACK_GAP_PX = 12;

/**
 * Opening of something bought in the Editions shop: /booster-result?edition=E1&mode=pack|box&packType=… (for a
 * pack, the type that came out at random). Only a fresh purchase opens (WalletStore ticket); otherwise it offers
 * to buy. First every pack bought lies on the table, shuffled and as big as fits without scrolling (SR, SEC and GOD
 * packs with their aura); "Abrir" tears them in that order without telling their type. Each pack's cards, shuffled,
 * lie face down, the SR and SEC ones glowing; the plain ones turn in order while the special ones only tremble,
 * then the special ones turn one by one, slower and with a bigger flourish. Only at the end the full list shows.
 * "Saltar animación" goes straight to it.
 */
@Component({
  selector: 'eras-booster-result-page',
  imports: [
    DecimalPipe,
    PageComponent,
    GridComponent,
    CardThumbComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
    OpeningPackComponent,
    OpeningCardComponent,
    PackBreakComponent,
  ],
  templateUrl: './booster-result.page.html',
  styleUrl: './booster-result.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoosterResultPage {
  readonly edition = input<string>('');
  readonly mode = input<string>('pack');
  readonly packType = input<string>('');

  protected readonly cards = inject(CardsStore);
  protected readonly wallet = inject(WalletStore);
  private readonly editions = inject(EditionsStore);
  private readonly modal = inject(ModalService);
  private readonly checkout = inject(ShopCheckout);
  private readonly decks = inject(DecksStore);

  protected readonly ready = computed(() => this.cards.cards().length > 0 && this.editions.editions().length > 0);
  protected readonly editionData = computed(() => this.editions.editions().find((e) => e.editionId === this.edition()) ?? null);
  /** What is being opened; "Comprar otro" draws a new pack type for a pack. */
  private readonly request = signal<OpeningRequest | null>(null);
  private readonly current = computed<OpeningRequest>(() => this.request() ?? { mode: this.mode(), packType: this.packType() });
  protected readonly product = computed(() => {
    const edition = this.editionData();
    return edition ? productFor(edition, this.current()) : null;
  });
  protected readonly isBox = computed(() => this.current().mode === 'box');
  protected readonly isStructure = computed(() => this.current().mode === 'structure');
  protected readonly label = computed(() =>
    this.isBox() ? 'Booster box' : this.isStructure() ? 'Structure deck' : `Sobre ${this.current().packType ?? ''}`.trim(),
  );

  protected readonly phase = signal<Phase>('unpaid');
  /** The bought packs, in opening order. */
  protected readonly packs = signal<OpenedPack[]>([]);
  /** opening: the pack being opened, whether it is still breaking open, its cards face up and the ones trembling. */
  protected readonly packIndex = signal(0);
  protected readonly tearing = signal(false);
  protected readonly faceUp = signal<ReadonlySet<number>>(new Set());
  protected readonly trembling = signal<ReadonlySet<number>>(new Set());
  /** packs: whether the pack that goes up a rarity already showed it (until then it wears its old aura). */
  protected readonly upgradeShown = signal(false);

  /** The table's free room, to size the packs so that all of them fit. */
  private readonly table = viewChild<ElementRef<HTMLElement>>('table');
  private readonly room = signal({ width: 0, height: 0 });
  protected readonly packWidth = computed(() =>
    fitItemWidth(this.packs().length, this.room().width, this.room().height, CARD_RATIO, PACK_GAP_PX, PACK_MAX_PX),
  );
  protected readonly openingPack = computed(() => this.packs()[this.packIndex()] ?? null);
  /** Everything that came out, one card after another, rarest first (each with how many came). */
  protected readonly obtained = computed(() => groupOpening(this.packs().flatMap((p) => p.cards)).flatMap((g) => g.cards));
  protected readonly total = computed(() => this.packs().reduce((sum, p) => sum + p.cards.length, 0));

  protected readonly imageUrl = cardImageUrl;
  /** The aura of a card: its rarity when it shines (SR, SEC), none otherwise. */
  protected readonly aura = (card: CatalogCard) => (SHINY.has(card.meta?.rarity ?? '') ? (card.meta?.rarity ?? '').toLowerCase() : null);
  private readonly special = (card: CatalogCard) => SHINY.has(card.meta?.rarity ?? '');

  private readonly reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    void this.cards.load();
    void this.editions.load();
    inject(DestroyRef).onDestroy(() => this.stopTimers());
    // Follow the table's size while it is on screen; measured right away too, as the observer only reports on a
    // painted frame (a tab in the background paints none)
    effect((onCleanup) => {
      const element = this.table()?.nativeElement;
      if (!element) return;
      this.room.set(contentSize(element));
      const observer = new ResizeObserver(() => this.room.set(contentSize(element)));
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
    // Once the catalog is in: a fresh purchase gets its packs on the table, anything else is offered for sale
    let started = false;
    effect(() => {
      if (started || !this.ready()) return;
      const edition = this.editionData();
      const product = this.product();
      started = true;
      untracked(() => {
        if (edition && product && this.wallet.takeTicket(purchaseTicket(edition, product))) void this.deal();
      });
    });
  }

  /** The aura of a pack type: SR, SEC or GOD (none for the plain ones). */
  protected tierOf(packType: string): PackTier {
    return packTier(this.editionData()?.packTypes?.find((p) => p.name === packType));
  }

  /** Buys (again) what this page opens, then deals its packs. */
  protected async buy(): Promise<void> {
    const edition = this.editionData();
    const product = this.product();
    if (!edition || !product || !(await this.checkout.purchase(edition, product))) return;
    this.wallet.takeTicket(purchaseTicket(edition, product));
    if (product.kind === 'pack') this.request.set({ ...this.current(), packType: pickRandomPackFromBox(edition) });
    void this.deal();
  }

  /** Opens the packs one after another. */
  protected start(): void {
    if (this.phase() !== 'packs') return;
    this.upgradeShown.set(true);
    if (this.reduceMotion) return this.skip();
    this.phase.set('opening');
    if (!this.isStructure()) return this.openPackAt(0);
    // A structure deck: it tears open and its whole list shows
    this.tearing.set(true);
    this.later(() => this.skip(), BREAK_MS.pack);
  }

  /** Straight to the full list. */
  protected skip(): void {
    this.stopTimers();
    this.tearing.set(false);
    this.phase.set('done');
  }

  protected openCard(card: CatalogCard): void {
    const flat = this.obtained().map((c) => c.card);
    const data: CardDetailDialogData = { cards: flat, index: flat.indexOf(card) };
    this.modal.open(CardDetailDialogComponent, { data });
  }

  /**
   * Draws what was bought (its cards unseen yet) and lays it on the table: a pack; a box's packs, one of them going up
   * a rarity (always in an edition's box, half the times in a sub-edition's); or a structure deck, whole (the public
   * deck named after it, or else one of each of its cards).
   */
  private async deal(): Promise<void> {
    const edition = this.editionData();
    if (!edition) return;
    this.stopTimers();
    const pool = cardsByRarity(this.cards.cards(), edition.editionId);
    const types = edition.packTypes ?? [];
    const request = this.current();
    let packs: OpenedPack[];
    if (request.mode === 'structure') {
      packs = [{ packType: 'Structure', cards: await this.structureCards(edition.editionId) }];
    } else if (!types.length) {
      return;
    } else if (request.mode === 'box') {
      packs = upgradeOnePack(openBoxPacks(edition, pool), types, pool, isSubEdition(edition.editionId) ? 0.5 : 1);
    } else {
      const type = types.find((p) => p.name === request.packType) ?? types[0];
      packs = [{ packType: type.name, cards: openPack(type, pool) }];
    }
    // They come out in no order, and so do the cards inside each one
    this.packs.set(shuffle(packs.map((p) => ({ ...p, cards: shuffle(p.cards) }))));
    this.packIndex.set(0);
    this.faceUp.set(new Set());
    this.trembling.set(new Set());
    this.upgradeShown.set(false);
    this.phase.set('packs');
    // Once every pack is dealt, the upgraded one (if any) shakes a moment and goes up
    if (this.packs().some((p) => p.upgradedFrom)) this.later(() => this.upgradeShown.set(true), this.packs().length * 45 + UPGRADE_SHAKE_MS);
  }

  /** A structure deck's cards: its public deck (named like the edition, "ST1"), or one of each card of the edition. */
  private async structureCards(editionId: string): Promise<CatalogCard[]> {
    await this.decks.loadPublic();
    const deck = this.decks.publicDecks().find((d) => d.deckName.trim().toUpperCase() === editionId.toUpperCase());
    const byId = new Map(this.cards.cards().map((c) => [c.id, c]));
    const fromDeck = (deck?.cards ?? []).map((id) => byId.get(id)).filter((c): c is CatalogCard => !!c);
    return fromDeck.length ? fromDeck : this.cards.cards().filter((c) => c.edition === editionId && !!c.meta);
  }

  /** How long a pack takes to break open here. */
  protected breakMs(): number {
    return this.isBox() ? BREAK_MS.box : BREAK_MS.pack;
  }

  private openPackAt(index: number): void {
    if (index >= this.packs().length) return this.later(() => this.phase.set('done'), BETWEEN_PACKS_MS);
    this.packIndex.set(index);
    this.faceUp.set(new Set());
    this.trembling.set(new Set());
    this.tearing.set(true);
    this.later(() => {
      this.tearing.set(false);
      this.passCard(0);
    }, this.breakMs());
  }

  /** Goes through the cards in order: a plain one turns, a special one only trembles (it turns at the end). */
  private passCard(index: number): void {
    const pack = this.openingPack();
    if (!pack) return;
    if (index >= pack.cards.length) return this.later(() => this.turnSpecial(0), BEFORE_SPECIAL_MS);
    if (this.special(pack.cards[index])) this.trembling.update((set) => new Set(set).add(index));
    else this.faceUp.update((set) => new Set(set).add(index));
    this.later(() => this.passCard(index + 1), this.isBox() ? PLAIN_MS.box : PLAIN_MS.pack);
  }

  /** The special cards, one by one and slowly; then the next pack. */
  private turnSpecial(n: number): void {
    const pack = this.openingPack();
    if (!pack) return;
    const order = revealOrder(pack.cards, this.special).special;
    if (n >= order.length) return this.later(() => this.openPackAt(this.packIndex() + 1), order.length ? BETWEEN_PACKS_MS : 0);
    const index = order[n];
    this.trembling.update((set) => {
      const next = new Set(set);
      next.delete(index);
      return next;
    });
    this.faceUp.update((set) => new Set(set).add(index));
    this.later(() => this.turnSpecial(n + 1), this.isBox() ? SPECIAL_MS.box : SPECIAL_MS.pack);
  }

  private later(run: () => void, ms: number): void {
    this.timers.push(setTimeout(run, ms));
  }

  private stopTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

/** The room inside an element, without its padding. */
function contentSize(element: HTMLElement): { width: number; height: number } {
  const style = getComputedStyle(element);
  const px = (value: string) => parseFloat(value) || 0;
  return {
    width: element.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
    height: element.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
  };
}
