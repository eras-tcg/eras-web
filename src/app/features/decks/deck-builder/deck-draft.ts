import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { addCard, canAdd, copiesOfName, entriesFromIds, groupByType, idsFromEntries, removeCard, resolveCover, totalCards } from '@data/decks/deck-rules';
import { Deck, DeckEntry } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';

interface Snapshot {
  name: string;
  entries: DeckEntry[];
  cover: string | null;
  isPrivate: boolean;
}

const EMPTY: Snapshot = { name: 'Nuevo mazo', entries: [], cover: null, isPrivate: false };

/** The deck being edited in the builder. Provided per builder page, so each visit starts clean. */
@Injectable()
export class DeckDraft {
  private readonly decks = inject(DecksStore);
  private readonly auth = inject(AuthService);

  private readonly state = signal<Snapshot>(EMPTY);
  /** Last saved/loaded state; null for a deck never saved. */
  private readonly saved = signal<Snapshot | null>(null);

  readonly id = signal<string | null>(null);
  readonly saving = signal(false);
  /** Cards of the loaded deck that are no longer in the catalog. */
  readonly missing = signal(0);

  readonly name = computed(() => this.state().name);
  readonly entries = computed(() => this.state().entries);
  readonly cover = computed(() => this.state().cover);
  readonly isPrivate = computed(() => this.state().isPrivate);
  readonly total = computed(() => totalCards(this.entries()));
  readonly groups = computed(() => groupByType(this.entries()));
  readonly dirty = computed(() => {
    const base = this.saved() ?? EMPTY;
    const s = this.state();
    return (
      s.name !== base.name ||
      s.cover !== base.cover ||
      s.isPrivate !== base.isPrivate ||
      idsFromEntries(s.entries).sort().join() !== idsFromEntries(base.entries).sort().join()
    );
  });
  readonly canDiscard = computed(() => this.saved() !== null && this.dirty());

  /** Loads a saved deck; `copy` starts a new unsaved deck from it. */
  load(deck: Deck, cards: readonly CatalogCard[], copy: boolean): void {
    const { entries, missing } = entriesFromIds(deck.cards ?? [], cards);
    const snapshot: Snapshot = {
      name: deck.deckName || 'Mazo',
      entries,
      cover: resolveCover(entries, deck.deckImage ?? null),
      isPrivate: deck.privateDeck ?? false,
    };
    this.missing.set(missing.length);
    if (copy) {
      this.id.set(null);
      this.saved.set(null);
      this.state.set({ ...snapshot, name: `${snapshot.name} (copia)` });
    } else {
      this.id.set(deck.id);
      this.saved.set(snapshot);
      this.state.set(snapshot);
    }
  }

  rename(name: string): void {
    this.state.update((s) => ({ ...s, name }));
  }

  togglePrivate(): void {
    this.state.update((s) => ({ ...s, isPrivate: !s.isPrivate }));
  }

  canAdd(card: CatalogCard): boolean {
    return canAdd(this.entries(), card);
  }

  copiesOf(card: CatalogCard): number {
    return copiesOfName(this.entries(), card.name);
  }

  countOf(cardId: string): number {
    return this.entries().find((e) => e.card.id === cardId)?.count ?? 0;
  }

  add(card: CatalogCard): void {
    this.setEntries(addCard(this.entries(), card));
  }

  remove(cardId: string): void {
    this.setEntries(removeCard(this.entries(), cardId));
  }

  /** Replaces the whole list (import). */
  replace(entries: DeckEntry[], name: string | null): void {
    this.state.update((s) => ({ ...s, name: name ?? s.name }));
    this.setEntries(entries);
  }

  setCover(card: CatalogCard): void {
    this.state.update((s) => ({ ...s, cover: cardImageUrl(card) }));
  }

  isCover(card: CatalogCard): boolean {
    return this.cover() !== null && this.cover() === cardImageUrl(card);
  }

  discard(): void {
    const base = this.saved();
    if (base) this.state.set(base);
  }

  /** Saves (create or update). Needs manage_decks; throws a readable message on failure. */
  async save(): Promise<void> {
    const user = this.auth.user();
    if (!user) throw new Error('Inicia sesión para guardar el mazo');
    const s = this.state();
    this.saving.set(true);
    try {
      const saved = await this.decks.save(this.id(), {
        deckName: s.name.trim() || 'Mazo',
        cards: idsFromEntries(s.entries),
        deckImage: s.cover,
        userId: user.id,
        username: user.username,
        privateDeck: s.isPrivate,
      });
      this.id.set(saved.id ?? this.id());
      this.saved.set(s);
    } finally {
      this.saving.set(false);
    }
  }

  private setEntries(entries: DeckEntry[]): void {
    this.state.update((s) => ({ ...s, entries, cover: resolveCover(entries, s.cover) }));
  }
}
