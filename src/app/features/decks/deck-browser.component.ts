import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, model, signal } from '@angular/core';
import { DeckFilters, EMPTY_DECK_FILTERS, hasDeckFilters } from '@data/decks/deck-filters';
import { DeckSortKey } from '@data/decks/deck-rules';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SortControlComponent, SortOption } from '@ui/forms/sort-control/sort-control.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { DeckFiltersBarComponent } from './deck-filters-bar.component';

/**
 * Body of the deck lists ("Mazos", "Mazos públicos"), one screen high inside a `fill` page: a filter panel whose
 * bar carries the sorting and folds it into a rail, and the deck grid, the only part that scrolls. The page
 * filters and sorts (two-way `filters`, `sortKey`, `direction`) and projects the covers; [deck-lead] goes first
 * in the grid (e.g. "Nuevo mazo").
 *
 * <eras-deck-browser [(filters)]="f" [(sortKey)]="k" [(direction)]="d" [shown]="n" [total]="t" …>
 *   <a deck-lead …>Nuevo mazo</a> @for (…) { <eras-deck-cover … /> }
 * </eras-deck-browser>
 */
@Component({
  selector: 'eras-deck-browser',
  imports: [DeckFiltersBarComponent, SortControlComponent, GridComponent, EmptyStateComponent, ButtonComponent, IconComponent, SpinnerComponent],
  templateUrl: './deck-browser.component.html',
  styleUrl: './deck-browser.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.folded]': '!showFilters()' },
})
export class DeckBrowserComponent {
  readonly filters = model.required<DeckFilters>();
  readonly sortKey = model.required<DeckSortKey>();
  readonly direction = model.required<'asc' | 'desc'>();
  readonly sortOptions = input.required<SortOption[]>();
  readonly editions = input.required<readonly string[]>();
  /** Offer the author filter (public decks). */
  readonly authors = input<readonly string[]>([]);
  /** Offer the public/private filter (own decks). */
  readonly showVisibility = input(false, { transform: booleanAttribute });
  /** Decks shown after filtering, and in the whole list. */
  readonly shown = input.required<number>();
  readonly total = input.required<number>();
  readonly loading = input(false, { transform: booleanAttribute });
  /** Line above the grid when it has no decks (nothing saved yet, nothing matches…). */
  readonly note = input<string | null>(null);

  // Open beside the list on wide screens, folded into a rail on phones
  protected readonly showFilters = signal(typeof window === 'undefined' || window.matchMedia('(min-width: 56rem)').matches);
  protected readonly filtersActive = computed(() => hasDeckFilters(this.filters()));
  protected readonly emptyFilters = EMPTY_DECK_FILTERS;
  protected readonly countLabel = computed(() => {
    const n = this.shown();
    return `${n} ${n === 1 ? 'mazo' : 'mazos'}${this.filtersActive() ? ' (filtrados)' : ''}`;
  });
}
