import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { CardsStore } from '@data/cards/cards.store';
import { coverFinish, shineOf } from '@data/collection/collection-rules';
import { CollectionStore } from '@data/collection/collection.store';
import { DeckFilters, EMPTY_DECK_FILTERS, deckEditions, filterDecks, hasDeckFilters, summarizeDecks } from '@data/decks/deck-filters';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DeckBox } from '@data/decks/deckbox.model';
import { DRAG_DECK, DRAG_DECKBOX, boxOf, deckBoxColor, decksIn, dropBoxOn, looseDecks } from '@data/decks/deckbox-rules';
import { DeckBoxesStore } from '@data/decks/deckboxes.store';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { DeckBoxConfigData, DeckBoxConfigDialogComponent, DeckBoxConfigResult } from './deckbox-config-dialog.component';
import { DeckBoxTileComponent } from './deckbox-tile.component';
import { DeckBrowserComponent } from './deck-browser.component';
import { MY_SORT_OPTIONS, deckViewLink } from './deck-links';

/** What is being dragged: one of the player's decks or one of their deckboxes. */
type Dragged = { kind: 'deck'; id: string } | { kind: 'box'; id: string };

/**
 * "Mazos": the signed-in user's own decks (private ones included), in the deck browser (one screen high, only the
 * grid scrolls), kept like on a shelf: the deckboxes first, then the loose decks. A deck is in one deckbox at most.
 * - The first tile is split in two (manage_decks): "Nuevo mazo" and "Nueva deckbox" (its name and color).
 * - Dragging a deck onto a deckbox puts it there; dragging a deckbox onto another takes that one's place.
 * - Tapping a deckbox opens it (`?box=`): its decks, "Mazos" to go back (dropping a deck there takes it out) and
 *   "Editar" for its settings. "Nuevo mazo" inside it saves the new deck there.
 * - With the filters on, the matching decks show from every deckbox, without the deckboxes.
 * Tapping a deck opens it; editing, deleting and choosing its deckbox are there.
 */
@Component({
  selector: 'eras-my-decks-page',
  imports: [RouterLink, PageComponent, DeckBrowserComponent, DeckCoverComponent, DeckBoxTileComponent, AlertComponent, ButtonComponent, IconComponent],
  templateUrl: './my-decks.page.html',
  styleUrl: './my-decks.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyDecksPage {
  /** `?box=`: the open deckbox (bound by the router). */
  readonly box = input<string>();

  protected readonly store = inject(DecksStore);
  protected readonly boxes = inject(DeckBoxesStore);
  private readonly cards = inject(CardsStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly collection = inject(CollectionStore);
  private readonly modal = inject(ModalService);

  protected readonly canManage = computed(() => this.auth.can('manage_decks'));
  protected readonly sortOptions = MY_SORT_OPTIONS;
  protected readonly sortKey = signal<DeckSortKey>('name');
  protected readonly direction = signal<'asc' | 'desc'>('asc');
  protected readonly filters = signal<DeckFilters>(EMPTY_DECK_FILTERS);
  protected readonly filtering = computed(() => hasDeckFilters(this.filters()));
  protected readonly error = signal<string | null>(null);

  /** The open deckbox (null: the shelf, or a deckbox that no longer exists). */
  protected readonly openBox = computed(() => this.boxes.boxes().find((b) => b.id === this.box()) ?? null);
  private readonly summaries = computed(() => summarizeDecks(this.store.myDecks(), this.cards.cards()));
  protected readonly editions = computed(() => deckEditions(this.summaries()));

  /** The decks in sight before filtering: the open deckbox's, every deck while filtering, otherwise the loose ones. */
  private readonly inSight = computed(() => {
    const open = this.openBox();
    const all = this.store.myDecks();
    if (open) return decksIn(open, all);
    return this.filtering() ? all : looseDecks(all, this.boxes.boxes());
  });
  protected readonly decks = computed(() =>
    sortDecks(filterDecks(this.inSight(), this.filters(), this.summaries()), this.sortKey(), this.direction()),
  );
  /** The deckboxes on the shelf, each with how many decks it has and the covers of its first four. */
  protected readonly shelf = computed(() => {
    if (this.openBox() || this.filtering()) return [];
    const all = this.store.myDecks();
    return this.boxes.boxes().map((box) => {
      const inside = decksIn(box, all);
      return { box, count: inside.length, covers: inside.slice(0, 4).map((d) => d.deckImage ?? null) };
    });
  });
  /** How many decks the count above the grid says: every deck on the shelf, the matches, or the deckbox's. */
  protected readonly shown = computed(() => (this.openBox() || this.filtering() ? this.decks().length : this.store.myDecks().length));
  protected readonly note = computed(() => {
    if (this.store.error()) return null;
    if (this.openBox()) {
      if (this.inSight().length === 0) {
        return this.canManage()
          ? 'Esta deckbox está vacía. Arrastra mazos hasta ella en Mazos, o elige su deckbox en la vista de cada mazo.'
          : 'Esta deckbox está vacía.';
      }
      return this.decks().length === 0 ? 'Ningún mazo de esta deckbox coincide con los filtros.' : null;
    }
    if (this.store.myDecks().length === 0) return 'Aún no tienes mazos guardados.';
    return this.filtering() && this.decks().length === 0 ? 'Ningún mazo coincide con los filtros.' : null;
  });
  protected readonly openColor = computed(() => {
    const open = this.openBox();
    return open ? deckBoxColor(open) : null;
  });

  // ── Dragging ────────────────────────────────────────────────────────────
  protected readonly dragged = signal<Dragged | null>(null);
  /** Where a drop would land: a deckbox id, or 'out' (back to the shelf, from inside a deckbox). */
  protected readonly dropOn = signal<string | null>(null);

  constructor() {
    const userId = this.auth.user()?.id;
    if (userId) {
      void this.store.loadMine(userId);
      void this.boxes.load(userId);
    }
    // Colors and editions of each deck come from the card catalog
    void this.cards.load();
  }

  protected view(deck: Deck): void {
    void this.router.navigate(deckViewLink(deck.id));
  }

  protected openShelfBox(box: DeckBox): void {
    void this.router.navigate([], { queryParams: { box: box.id } });
  }

  protected closeBox(): void {
    void this.router.navigate([], { queryParams: { box: null } });
  }

  /** "Nueva deckbox", or "Editar" inside one: its name and color (and, editing, its place or deleting it). */
  protected configureBox(box?: DeckBox): void {
    const data: DeckBoxConfigData = { box };
    const ref = this.modal.open<DeckBoxConfigResult, DeckBoxConfigData>(DeckBoxConfigDialogComponent, { data, width: 'min(26rem, 94vw)' });
    ref.closed.subscribe((result) => {
      if (result && 'deleted' in result) this.closeBox();
    });
  }

  /** The player's finest copy of a deck's cover card shines over the cover. */
  protected coverShine(deck: Deck): 'foil' | 'prism' | null {
    return shineOf(coverFinish(deck, this.cards.cards(), this.collection.collection()));
  }

  protected startDrag(event: DragEvent, dragged: Dragged): void {
    if (!this.canManage() || !event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(dragged.kind === 'deck' ? DRAG_DECK : DRAG_DECKBOX, dragged.id);
    this.dragged.set(dragged);
  }

  protected endDrag(): void {
    this.dragged.set(null);
    this.dropOn.set(null);
  }

  /** Over a deckbox: a deck goes in, another deckbox takes its place. */
  protected overBox(event: DragEvent, box: DeckBox): void {
    const dragged = this.dragged();
    if (!dragged || (dragged.kind === 'box' && dragged.id === box.id)) return;
    if (dragged.kind === 'deck' && boxOf(dragged.id, this.boxes.boxes())?.id === box.id) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropOn.set(box.id);
  }

  /** Over "Mazos" inside a deckbox: a deck dropped there is taken out. */
  protected overShelf(event: DragEvent): void {
    if (this.dragged()?.kind !== 'deck') return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropOn.set('out');
  }

  protected leave(target: string): void {
    if (this.dropOn() === target) this.dropOn.set(null);
  }

  protected async dropOnBox(event: DragEvent, box: DeckBox): Promise<void> {
    event.preventDefault();
    const dragged = this.dragged();
    this.endDrag();
    if (!dragged) return;
    if (dragged.kind === 'deck') await this.attempt(() => this.boxes.moveDeck(dragged.id, box.id));
    else await this.attempt(() => this.boxes.reorder(dropBoxOn(this.boxes.boxes(), dragged.id, box.id)));
  }

  protected async dropOnShelf(event: DragEvent): Promise<void> {
    event.preventDefault();
    const dragged = this.dragged();
    this.endDrag();
    if (dragged?.kind === 'deck') await this.attempt(() => this.boxes.moveDeck(dragged.id, null));
  }

  private async attempt(task: () => Promise<void>): Promise<void> {
    this.error.set(null);
    try {
      await task();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo mover');
    }
  }
}
