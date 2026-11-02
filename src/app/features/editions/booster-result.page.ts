import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { OpenedPack, PackTier, RARITY_NAMES, cardsByRarity, groupOpening, openBoxPacks, openPack, packTier, revealOrder, shuffle } from '@data/editions/booster-rules';
import { pickRandomPackFromBox } from '@data/editions/edition-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { OpeningRequest, productFor } from '@data/shop/shop-rules';
import { WalletStore } from '@core/wallet/wallet.store';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { Rarity, RarityBadgeComponent } from '@ui/domain/rarity-badge/rarity-badge.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../cards/card-detail-dialog/card-detail-dialog.component';
import { fitItemWidth } from './fit-grid';
import { ShopCheckout, purchaseTicket } from './shop-checkout';

/** unpaid: offered for sale · packs: the bought packs on the table · opening: one by one · done: the full list. */
type Phase = 'unpaid' | 'packs' | 'opening' | 'done';

/** The rarities that shine (their aura) when they turn face up. */
const SHINY = new Set(['SR', 'SEC']);
const TEAR_MS = 850;
/** Time between two plain cards turning, and between two special ones (slower), in a pack and in a box. */
const PLAIN_MS = { pack: 300, box: 110 };
const SPECIAL_MS = { pack: 1600, box: 1000 };
/** Pause after the plain cards, before the special ones. */
const BEFORE_SPECIAL_MS = 700;
const BETWEEN_PACKS_MS = 650;
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
    SectionHeaderComponent,
    CardThumbComponent,
    RarityBadgeComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
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
  protected readonly label = computed(() => (this.isBox() ? 'Booster box' : `Sobre ${this.current().packType ?? ''}`.trim()));

  protected readonly phase = signal<Phase>('unpaid');
  /** The bought packs, in opening order. */
  protected readonly packs = signal<OpenedPack[]>([]);
  /** opening: the pack being opened, whether it is still tearing, its cards face up and the ones trembling. */
  protected readonly packIndex = signal(0);
  protected readonly tearing = signal(false);
  protected readonly faceUp = signal<ReadonlySet<number>>(new Set());
  protected readonly trembling = signal<ReadonlySet<number>>(new Set());

  /** The table's free room, to size the packs so that all of them fit. */
  private readonly table = viewChild<ElementRef<HTMLElement>>('table');
  private readonly room = signal({ width: 0, height: 0 });
  protected readonly packWidth = computed(() =>
    fitItemWidth(this.packs().length, this.room().width, this.room().height, CARD_RATIO, PACK_GAP_PX, PACK_MAX_PX),
  );
  protected readonly openingPack = computed(() => this.packs()[this.packIndex()] ?? null);
  protected readonly groups = computed(() => groupOpening(this.packs().flatMap((p) => p.cards)));
  protected readonly total = computed(() => this.packs().reduce((sum, p) => sum + p.cards.length, 0));

  protected readonly imageUrl = cardImageUrl;
  protected readonly rarityName = (r: string) => RARITY_NAMES[r] ?? r;
  protected readonly asRarity = (r: string) => r as Rarity;
  /** The aura of a card: its rarity when it shines (SR, SEC), none otherwise. */
  protected readonly aura = (card: CatalogCard) => (SHINY.has(card.meta?.rarity ?? '') ? (card.meta?.rarity ?? '').toLowerCase() : null);
  private readonly special = (card: CatalogCard) => SHINY.has(card.meta?.rarity ?? '');

  private readonly reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    void this.cards.load();
    void this.editions.load();
    inject(DestroyRef).onDestroy(() => this.stopTimers());
    // Follow the table's size while it is on screen
    effect((onCleanup) => {
      const element = this.table()?.nativeElement;
      if (!element) return;
      const observer = new ResizeObserver(([entry]) => this.room.set({ width: entry.contentRect.width, height: entry.contentRect.height }));
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
        if (edition && product && this.wallet.takeTicket(purchaseTicket(edition, product))) this.deal();
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
    this.deal();
  }

  /** Opens the packs one after another. */
  protected start(): void {
    if (this.phase() !== 'packs') return;
    if (this.reduceMotion) return this.skip();
    this.phase.set('opening');
    this.openPackAt(0);
  }

  /** Straight to the full list. */
  protected skip(): void {
    this.stopTimers();
    this.tearing.set(false);
    this.phase.set('done');
  }

  protected openCard(card: CatalogCard): void {
    const flat = this.groups().flatMap((g) => g.cards.map((c) => c.card));
    const data: CardDetailDialogData = { cards: flat, index: flat.indexOf(card) };
    this.modal.open(CardDetailDialogComponent, { data });
  }

  /** Draws the packs (their cards unseen yet) and lays them on the table. */
  private deal(): void {
    const edition = this.editionData();
    const types = edition?.packTypes ?? [];
    if (!edition || !types.length) return;
    this.stopTimers();
    const pool = cardsByRarity(this.cards.cards(), edition.editionId);
    const request = this.current();
    let packs: OpenedPack[];
    if (request.mode === 'box') {
      packs = openBoxPacks(edition, pool);
    } else {
      const type = types.find((p) => p.name === request.packType) ?? types[0];
      packs = [{ packType: type.name, cards: openPack(type, pool) }];
    }
    // They come out in no order, and so do the cards inside each one
    this.packs.set(shuffle(packs.map((p) => ({ ...p, cards: shuffle(p.cards) }))));
    this.packIndex.set(0);
    this.faceUp.set(new Set());
    this.trembling.set(new Set());
    this.phase.set('packs');
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
    }, TEAR_MS);
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
