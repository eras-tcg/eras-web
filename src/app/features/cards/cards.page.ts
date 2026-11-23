import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { EditModeService } from '@core/auth/edit-mode.service';
import { ProgressionStore } from '@core/missions/progression.store';
import { persistedFlag } from '@core/storage/persisted-flag';
import { CardFilters, EMPTY_FILTERS, filterCards, hasActiveFilters, sortCards } from '@data/cards/card-filters';
import { CatalogCard } from '@data/cards/card.model';
import { altArtsOf, cardImageUrl, cardShineUrl, collapseByName, withAltArt } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { AltCopy, bestAlt, bestFinishAmong, shineOf } from '@data/collection/collection-rules';
import { isTestEdition } from '@data/editions/edition-rules';
import { Finish } from '@data/collection/collection.model';
import { CollectionStore } from '@data/collection/collection.store';
import { EditionsStore } from '@data/editions/editions.store';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SplitComponent } from '@ui/layout/split/split.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { InViewDirective } from '@ui/utilities/in-view.directive';
import { openCardDetailDialog } from './card-detail-dialog/card-detail-dialog.component';
import { CardFiltersPanelComponent } from './card-filters-panel/card-filters-panel.component';
import { CardView, DEFAULT_VIEW } from './card-view';

const PAGE_SIZE = 40;

/** Card catalog: filter, sort and browse every card; click one for its detail. */
@Component({
  selector: 'eras-cards-page',
  imports: [
    PageComponent,
    SplitComponent,
    GridComponent,
    StackComponent,
    CardFiltersPanelComponent,
    CardThumbComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
    InViewDirective,
  ],
  templateUrl: './cards.page.html',
  styles: `
    .lacking { filter: grayscale(1); }
    .toolbar {
      position: sticky;
      z-index: 2;
      inset-block-start: 0;
      padding: var(--space-3) var(--space-2);
      pointer-events: none;
    }
    /* Floating over the cards: each piece its own small surface, the row itself clear */
    .toolbar > * { pointer-events: auto; }
    .count {
      padding: var(--space-1) var(--space-3);
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-bg) 80%, transparent);
      backdrop-filter: blur(6px);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardsPage {
  /** `?edition=E1` (bound by the router). */
  readonly edition = input<string>();

  /** The card's shine image (an alternative art takes its foil's cut from it). */
  protected readonly shineUrl = cardShineUrl;
  protected readonly store = inject(CardsStore);
  protected readonly editions = inject(EditionsStore);
  private readonly collection = inject(CollectionStore);
  private readonly editMode = inject(EditModeService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly filters = signal<CardFilters>(EMPTY_FILTERS);
  private readonly wide = typeof window === 'undefined' || window.matchMedia('(min-width: 56rem)').matches;
  // Phones in landscape: little height, so smaller cards (six or seven columns, on the size slider's steps) to see
  // more than one row
  private readonly phoneLandscape =
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape) and (max-height: 30rem)').matches;
  // Narrow screens start with two columns instead of one huge card
  protected readonly view = signal<CardView>(
    this.phoneLandscape ? { ...DEFAULT_VIEW, size: 110 } : this.wide ? DEFAULT_VIEW : { ...DEFAULT_VIEW, size: 150 },
  );
  protected readonly showFilters = signal(this.wide);
  protected readonly renderCount = signal(PAGE_SIZE);

  protected readonly canManage = computed(() => this.editMode.allows('manage_cards'));
  /** The editors' mark "Sin metadatos": hidden unless turned on. Remembered on the device. */
  protected readonly showNoMeta = persistedFlag('eras-cards-mark-no-meta');
  /** The player's collection on the cards: each in its finest finish owned, in grey when they have none. */
  protected readonly showCollection = persistedFlag('eras-cards-show-collection');

  /** Filtered and sorted, before collapsing repeated names (the count shows collapsed). */
  private readonly filtered = computed(() =>
    sortCards(filterCards(this.store.cards(), this.filters(), this.canManage()), this.view().sort, this.view().direction),
  );
  private readonly collapsed = computed(() => collapseByName(this.filtered(), this.editions.releaseDates()));
  protected readonly displayed = computed(() => (this.view().collapse ? this.collapsed() : this.filtered()));
  protected readonly visible = computed(() => this.displayed().slice(0, this.renderCount()));
  protected readonly count = computed(() => this.collapsed().length);
  protected readonly filtersActive = computed(() => hasActiveFilters(this.filters()));
  protected readonly imageUrl = cardImageUrl;
  protected readonly shineOf = shineOf;

  /** Ids of every printing by name: a card shown once per name counts the copies of all its printings. */
  private readonly printings = computed(() => {
    const byName = new Map<string, string[]>();
    for (const card of this.store.cards()) {
      const name = (card.name ?? '').toLowerCase();
      if (name) byName.set(name, [...(byName.get(name) ?? []), card.id]);
    }
    return byName;
  });

  constructor() {
    // Exploring the catalog is a step of the "Bienvenida" missions
    inject(ProgressionStore).visit('cartas');
    void this.store.load();
    void this.editions.load();

    // URL → filter (deep links from Editions/Home and the browser back button)
    effect(() => {
      const edition = this.edition() ?? '';
      untracked(() => {
        if (this.filters().edition !== edition) this.filters.update((f) => ({ ...f, edition }));
      });
    });

    // Filter → URL, so the selected edition can be shared and survives a reload
    effect(() => {
      const edition = this.filters().edition;
      untracked(() => {
        if ((this.edition() ?? '') !== edition) {
          void this.router.navigate([], { queryParams: { edition: edition || null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
      });
    });

    // A new result set starts again from the first page
    effect(() => {
      this.displayed();
      untracked(() => this.renderCount.set(PAGE_SIZE));
    });
  }

  /** Missing metadata first (only when its mark is on); with metadata, always whether the simulator runs it. */
  protected badge(card: CatalogCard): string | null {
    if (!card.meta) return this.showNoMeta() ? 'Sin metadatos' : null;
    return this.store.unprogrammedOf(card) ? 'Sin programar' : null;
  }

  /** The finest finish the player owns of a card (of any printing when shown once per name), null when none. */
  protected owned(card: CatalogCard): Finish | null {
    const finish = bestFinishAmong(this.collection.collection(), this.idsOf(card)) ?? this.ownedAlt(card)?.finish ?? null;
    // A card in testing is outside the collection: always available, as a plain copy
    return finish ?? (isTestEdition(card.edition) ? 'plain' : null);
  }

  /** The player's finest copy of a card with one of its alternative arts (shown instead), null when none. */
  protected ownedAlt(card: CatalogCard): AltCopy | null {
    const arts = altArtsOf(card).map((a) => a.id);
    if (!arts.length) return null;
    const cards = this.collection.collection()?.cards;
    for (const id of this.idsOf(card)) {
      const copy = bestAlt(cards?.[id], arts);
      if (copy) return copy;
    }
    return null;
  }

  protected altImageUrl(card: CatalogCard, art: AltCopy): string | null {
    return cardImageUrl(withAltArt(card, art.art));
  }

  /** The printings a catalog entry stands for (all of a name when shown once per name). */
  private idsOf(card: CatalogCard): string[] {
    return this.view().collapse && card.name ? (this.printings().get(card.name.toLowerCase()) ?? [card.id]) : [card.id];
  }

  protected showMore(): void {
    if (this.renderCount() < this.displayed().length) this.renderCount.update((n) => n + PAGE_SIZE);
  }

  protected clearFilters(): void {
    this.filters.set(EMPTY_FILTERS);
  }

  protected open(card: CatalogCard): void {
    const cards = this.displayed();
    openCardDetailDialog(this.modal, cards, cards.indexOf(card), { collection: this.showCollection() });
  }
}
