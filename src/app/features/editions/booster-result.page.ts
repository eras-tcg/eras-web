import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { RARITY_NAMES, cardsByRarity, groupOpening, openBox, openPack } from '@data/editions/booster-rules';
import { pickRandomPackFromBox } from '@data/editions/edition-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { OpeningRequest, productFor } from '@data/shop/shop-rules';
import { WalletStore } from '@data/shop/wallet.store';
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
import { ShopCheckout, purchaseTicket } from './shop-checkout';

type Phase = 'unpaid' | 'sealed' | 'opening' | 'open';

/** Rarities that shine when they turn face up. */
const SHINY = new Set(['SR', 'SEC']);
const OPENING_MS = 900;
const FLIP_STAGGER_MS = 140;

/**
 * Opening of something bought in the Editions shop: /booster-result?edition=E1&mode=pack|box&packType=…[&random=1].
 * Only a fresh purchase opens (WalletStore ticket); otherwise it offers to buy. The sealed pack opens with a tap; a
 * pack's cards come face down and turn one by one (or all), the rare ones shine; a box goes to its summary.
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
  readonly random = input<string>();

  protected readonly cards = inject(CardsStore);
  protected readonly wallet = inject(WalletStore);
  private readonly editions = inject(EditionsStore);
  private readonly modal = inject(ModalService);
  private readonly checkout = inject(ShopCheckout);

  protected readonly ready = computed(() => this.cards.cards().length > 0 && this.editions.editions().length > 0);
  protected readonly editionData = computed(() => this.editions.editions().find((e) => e.editionId === this.edition()) ?? null);
  /** What is being opened; "Comprar otro" draws a new pack type for a random pack of a box. */
  private readonly request = signal<OpeningRequest | null>(null);
  private readonly current = computed<OpeningRequest>(() => this.request() ?? { mode: this.mode(), packType: this.packType(), random: this.random() });
  protected readonly product = computed(() => {
    const edition = this.editionData();
    return edition ? productFor(edition, this.current()) : null;
  });
  protected readonly isBox = computed(() => this.current().mode === 'box');

  protected readonly phase = signal<Phase>('unpaid');
  protected readonly picked = signal<CatalogCard[]>([]);
  protected readonly groups = computed(() => groupOpening(this.picked()));
  /** Positions of the pack's cards already face up. */
  protected readonly faceUp = signal<ReadonlySet<number>>(new Set());
  protected readonly allUp = computed(() => this.isBox() || this.faceUp().size >= this.picked().length);

  protected readonly title = computed(() => this.product()?.name ?? (this.isBox() ? 'Caja' : 'Sobre'));
  protected readonly imageUrl = cardImageUrl;
  protected readonly rarityName = (r: string) => RARITY_NAMES[r] ?? r;
  protected readonly asRarity = (r: string) => r as Rarity;
  protected readonly shiny = (card: CatalogCard) => SHINY.has(card.meta?.rarity ?? '');

  private readonly reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    void this.cards.load();
    void this.editions.load();
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
    // Once the catalog is in: a fresh purchase gets its sealed pack, anything else is offered for sale
    let started = false;
    effect(() => {
      if (started || !this.ready()) return;
      const edition = this.editionData();
      const product = this.product();
      started = true;
      untracked(() => {
        if (edition && product && this.wallet.takeTicket(purchaseTicket(edition, product))) this.seal();
      });
    });
  }

  /** Buys (again) what this page opens, then shows it sealed. */
  protected async buy(): Promise<void> {
    const edition = this.editionData();
    const product = this.product();
    if (!edition || !product || !(await this.checkout.purchase(edition, product))) return;
    this.wallet.takeTicket(purchaseTicket(edition, product));
    if (product.kind === 'random') this.request.set({ ...this.current(), packType: pickRandomPackFromBox(edition) });
    this.seal();
  }

  /** Tearing the pack open. */
  protected open(): void {
    if (this.phase() !== 'sealed') return;
    this.phase.set('opening');
    this.later(() => this.phase.set('open'), this.reduceMotion ? 0 : OPENING_MS);
  }

  protected flip(index: number): void {
    this.faceUp.update((up) => new Set(up).add(index));
  }

  /** Turns the rest face up one after another. */
  protected revealAll(): void {
    const down = this.picked()
      .map((_, i) => i)
      .filter((i) => !this.faceUp().has(i));
    down.forEach((index, n) => this.later(() => this.flip(index), this.reduceMotion ? 0 : n * FLIP_STAGGER_MS));
  }

  protected openCard(card: CatalogCard): void {
    const flat = this.isBox() ? this.groups().flatMap((g) => g.cards.map((c) => c.card)) : this.picked();
    const data: CardDetailDialogData = { cards: flat, index: flat.indexOf(card) };
    this.modal.open(CardDetailDialogComponent, { data });
  }

  /** Draws the cards (unseen yet) and shows the sealed pack. */
  private seal(): void {
    const edition = this.editionData();
    const packs = edition?.packTypes ?? [];
    if (!edition || !packs.length) return;
    const pool = cardsByRarity(this.cards.cards(), edition.editionId);
    const request = this.current();
    const pack = packs.find((p) => p.name === request.packType) ?? packs[0];
    this.picked.set(request.mode === 'box' ? openBox(edition, pool) : openPack(pack, pool));
    this.faceUp.set(new Set());
    this.phase.set('sealed');
  }

  private later(run: () => void, ms: number): void {
    this.timers.push(setTimeout(run, ms));
  }
}
