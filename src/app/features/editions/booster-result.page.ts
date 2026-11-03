import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl, withAltArt } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { FoilKind, OpenedPack, PackTier, groupOpening, packTier, revealOrder, shuffle } from '@data/editions/booster-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { OpeningRequest, productFor } from '@data/shop/shop-rules';
import { PurchasedPack, WalletStore } from '@core/wallet/wallet.store';
import { CollectionStore } from '@data/collection/collection.store';
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
const BREAK_MS = { pack: 2600, box: 1500 };
/** Time between two plain cards turning, and between two special ones (slower), in a pack and in a box. */
const PLAIN_MS = { pack: 300, box: 110 };
const SPECIAL_MS = { pack: 1600, box: 1000 };
/** Pause after the plain cards, before the special ones. */
const BEFORE_SPECIAL_MS = 700;
const BETWEEN_PACKS_MS = 650;
/** The foils' pass: how long each foil card takes to turn around and show its foil, in a pack and in a box. */
const FOIL_MS = { pack: 1500, box: 1000 };
/** How long the pack that goes up a rarity shakes on the table before it does. */
const UPGRADE_SHAKE_MS = 1400;
const CARD_RATIO = 63 / 88;
/** The packs on the table: never bigger than this, and this far apart. */
const PACK_MAX_PX = 260;
const PACK_GAP_PX = 12;

/**
 * Opening of something bought in the Editions shop: /booster-result?edition=E1&mode=pack|box|structure. The
 * server draws what was bought (and adds it to the player's collection); this page only shows it. Only a fresh
 * purchase opens (WalletStore ticket); otherwise it offers to buy. First every pack bought lies on the table, shuffled and as big as fits without scrolling (SR, SEC and GOD
 * packs with their aura); "Abrir" tears them in that order without telling their type. Each pack's cards, shuffled,
 * lie face down, the SR and SEC ones glowing; the plain ones turn in order while the special ones only tremble,
 * then the special ones turn one by one, slower and with a bigger flourish; then a second pass turns the foil ones
 * around, coming back with their foil. Only at the end the full list shows.
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
  private readonly collection = inject(CollectionStore);

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
    // A pack's type stays hidden until it is open
    this.isBox() ? 'Booster box' : this.isStructure() ? 'Structure deck' : `Sobre ${this.phase() === 'done' ? (this.current().packType ?? '') : ''}`.trim(),
  );

  protected readonly phase = signal<Phase>('unpaid');
  /** The bought packs, in opening order. */
  protected readonly packs = signal<OpenedPack[]>([]);
  /** opening: the pack being opened, whether it is still breaking open, its cards face up and the ones trembling. */
  protected readonly packIndex = signal(0);
  protected readonly tearing = signal(false);
  protected readonly faceUp = signal<ReadonlySet<number>>(new Set());
  protected readonly trembling = signal<ReadonlySet<number>>(new Set());
  /** The cards of the pack whose foil already showed (the second pass). */
  protected readonly foiled = signal<ReadonlySet<number>>(new Set());
  /** opening: the pack is all shown and stays still until a click moves on. */
  protected readonly waiting = signal(false);
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
  protected readonly obtained = computed(() =>
    groupOpening(
      this.packs().flatMap((p) => p.cards),
      this.packs().flatMap((p) => p.foils ?? p.cards.map(() => null)),
    ).flatMap((g) => g.cards),
  );
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
        const packs = edition && product ? this.wallet.takeTicket(purchaseTicket(edition, product)) : null;
        if (packs) this.deal(packs);
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
    this.deal(this.wallet.takeTicket(purchaseTicket(edition, product)) ?? []);
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

  /** A click once a pack is all shown: the next one (or, after the last, the full list). */
  protected next(): void {
    if (!this.waiting()) return;
    this.waiting.set(false);
    this.openPackAt(this.packIndex() + 1);
  }

  /** Straight to the full list. */
  protected skip(): void {
    this.stopTimers();
    this.waiting.set(false);
    this.tearing.set(false);
    this.phase.set('done');
  }

  /** A card that came out, in detail with its foil (it alone: no arrows to other cards or printings). */
  protected openCard(card: CatalogCard, foil: FoilKind | null): void {
    const data: CardDetailDialogData = { cards: [card], index: 0, copy: { foil } };
    this.modal.open(CardDetailDialogComponent, { data });
  }

  /** A click on a card of the pack once it is all shown: that card in detail (not the next pack). */
  protected inspect(event: Event, card: CatalogCard, index: number): void {
    if (!this.waiting()) return;
    event.stopPropagation();
    this.openCard(card, this.foilOf(index));
  }

  /**
   * Lays on the table what the server drew for the purchase (already in the player's collection): its packs, each
   * card with its finish (a structure deck's are plain), shuffled for the show.
   */
  private deal(drawn: readonly PurchasedPack[]): void {
    this.stopTimers();
    const byId = new Map(this.cards.cards().map((c) => [c.id, c]));
    const packs: OpenedPack[] = drawn.map((p) => {
      const cards = shuffle(p.cards.filter((c) => byId.has(c.id)));
      return {
        packType: p.packType,
        // A copy that came out with the card's alternative art shows it (the same card, another picture)
        cards: cards.map((c) => (c.alt ? withAltArt(byId.get(c.id)!) : byId.get(c.id)!)),
        foils: cards.map((c) => (c.finish === 'plain' ? null : c.finish)),
        ...(p.upgradedFrom ? { upgradedFrom: p.upgradedFrom } : {}),
      };
    });
    // A pack's type is the server's: the title tells it once the opening is over
    if (this.current().mode === 'pack' && packs[0]) this.request.set({ ...this.current(), packType: packs[0].packType });
    this.packs.set(shuffle(packs));
    this.packIndex.set(0);
    this.faceUp.set(new Set());
    this.foiled.set(new Set());
    this.trembling.set(new Set());
    this.upgradeShown.set(false);
    this.phase.set('packs');
    void this.collection.load();
    // Once every pack is dealt, the upgraded one (if any) shakes a moment and goes up
    if (this.packs().some((p) => p.upgradedFrom)) this.later(() => this.upgradeShown.set(true), this.packs().length * 45 + UPGRADE_SHAKE_MS);
  }

  /** How long a pack takes to break open here. */
  protected breakMs(): number {
    return this.isBox() ? BREAK_MS.box : BREAK_MS.pack;
  }

  private openPackAt(index: number): void {
    if (index >= this.packs().length) return this.phase.set('done');
    this.packIndex.set(index);
    this.faceUp.set(new Set());
    this.foiled.set(new Set());
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

  /** The special cards, one by one and slowly; then the foils' pass. */
  private turnSpecial(n: number): void {
    const pack = this.openingPack();
    if (!pack) return;
    const order = revealOrder(pack.cards, this.special).special;
    if (n >= order.length) return this.later(() => this.foilPass(0), order.length ? BETWEEN_PACKS_MS : 0);
    const index = order[n];
    this.trembling.update((set) => {
      const next = new Set(set);
      next.delete(index);
      return next;
    });
    this.faceUp.update((set) => new Set(set).add(index));
    this.later(() => this.turnSpecial(n + 1), this.isBox() ? SPECIAL_MS.box : SPECIAL_MS.pack);
  }

  /** The second pass: the foil cards, one by one, turn around and come back with their foil; then it waits for a click. */
  private foilPass(n: number): void {
    const pack = this.openingPack();
    if (!pack) return;
    const order = (pack.foils ?? []).map((foil, i) => (foil ? i : -1)).filter((i) => i >= 0);
    if (n >= order.length) return this.waiting.set(true);
    this.foiled.update((set) => new Set(set).add(order[n]));
    this.later(() => this.foilPass(n + 1), this.isBox() ? FOIL_MS.box : FOIL_MS.pack);
  }

  /** The foil of a card of the pack being opened. */
  protected foilOf(index: number): FoilKind | null {
    return this.openingPack()?.foils?.[index] ?? null;
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
