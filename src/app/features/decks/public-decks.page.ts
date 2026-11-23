import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { COLOR_LABELS, CARD_COLORS, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { CardsStore } from '@data/cards/cards.store';
import {
  DECK_FOLDERS,
  DeckSearch,
  EMPTY_DECK_SEARCH,
  FORMAT_LABELS,
  archetypeLabel,
  deckArchetypes,
  deckSummons,
  folderOf,
  hasDeckSearch,
  profileDecks,
  searchDecks,
} from '@data/decks/deck-search';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DeckBox } from '@data/decks/deckbox.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { DeckBoxTileComponent } from './deckbox-tile.component';
import { FROM_PUBLIC_DECKS, PUBLIC_SORT_OPTIONS, deckViewLink } from './deck-links';

/** A criterion chip: a select whose first option is "any". */
interface Chip {
  key: 'color' | 'archetype' | 'summon' | 'format' | 'origin';
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Public decks: one search box over every deck (name, author, archetype or a card in it) with the common criteria as
 * chips (color, archetype, special summon, format, origin and order), and, while nothing is searched, quick-access
 * folders (Structure, Bloque E1, Arquetipos: the system's; Comunidad: the players'). A folder opens like a deckbox and
 * the search then looks inside it. The system's decks always come first, in the system's order; the players' follow,
 * sorted as chosen.
 */
@Component({
  selector: 'eras-public-decks-page',
  imports: [PageComponent, DeckCoverComponent, DeckBoxTileComponent, GridComponent, AlertComponent, EmptyStateComponent, ButtonComponent, IconComponent, SpinnerComponent],
  template: `
    <eras-page title="Mazos públicos" width="wide">
      @if (store.error(); as error) {
        <eras-alert tone="danger">{{ error }}</eras-alert>
      }

      <div class="search" role="search">
        <label class="box">
          <eras-icon name="search" />
          <input
            type="search"
            placeholder="Buscar mazo, autor, arquetipo o carta…"
            aria-label="Buscar mazos"
            [value]="search().text"
            (input)="set('text', $any($event.target).value)"
          />
        </label>
        <div class="chips">
          @for (chip of chips(); track chip.key) {
            <label class="chip" [class.on]="!!search()[chip.key]">
              <span class="sr-only">{{ chip.label }}</span>
              <select (change)="set(chip.key, $any($event.target).value)">
                <option value="" [selected]="!search()[chip.key]">{{ chip.label }}</option>
                @for (o of chip.options; track o.value) {
                  <option [value]="o.value" [selected]="o.value === search()[chip.key]">{{ o.label }}</option>
                }
              </select>
              <eras-icon name="chevron-down" />
            </label>
          }
          <label class="chip">
            <span class="sr-only">Orden</span>
            <select (change)="sortKey.set($any($event.target).value)">
              @for (o of sortOptions; track o.value) {
                <option [value]="o.value" [selected]="o.value === sortKey()">Orden: {{ o.label }}</option>
              }
            </select>
            <eras-icon name="chevron-down" />
          </label>
        </div>
      </div>

      @if (loading()) {
        <eras-empty-state title="Cargando mazos…"><eras-spinner /></eras-empty-state>
      } @else if (showFolders()) {
        <h2 class="heading">Accesos rápidos</h2>
        <eras-grid minColumn="var(--cover-column, min(11rem, 40vw, 34dvh))" [gap]="4">
          @for (f of folders(); track f.box.id) {
            <eras-deckbox-tile noun="la carpeta" [box]="f.box" [count]="f.count" [covers]="f.covers" (opened)="set('folder', f.box.id)" />
          }
        </eras-grid>
      } @else {
        <div class="results-head">
          @if (openFolderLabel(); as label) {
            <button erasButton variant="ghost" size="sm" type="button" (click)="search.set(empty)"><eras-icon name="chevron-left" /> Accesos rápidos</button>
            <span class="crumb">{{ label }}</span>
          }
          <span class="count">{{ results().length }} {{ results().length === 1 ? 'mazo' : 'mazos' }}</span>
          @for (a of active(); track a.key) {
            <button class="tag" type="button" [attr.aria-label]="'Quitar ' + a.label" (click)="set(a.key, '')">{{ a.label }} <eras-icon name="x" /></button>
          }
          @if (active().length) {
            <button erasButton variant="ghost" size="sm" type="button" (click)="clear()">Limpiar</button>
          }
        </div>
        @if (results().length === 0) {
          <p class="note">Ningún mazo coincide con la búsqueda.</p>
        }
        <eras-grid minColumn="var(--cover-column, min(11rem, 40vw, 34dvh))" [gap]="4">
          @for (deck of results(); track deck.id) {
            <eras-deck-cover
              [name]="deck.deckName"
              [author]="deck.username ?? null"
              [imageUrl]="deck.deckImage ?? null"
              [cardCount]="deck.cards.length"
              (selected)="open(deck)"
            />
          }
        </eras-grid>
      }
    </eras-page>
  `,
  styles: `
    .search {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-block-end: var(--space-5);
    }
    .box {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text-muted);
    }
    .box:focus-within {
      border-color: var(--color-hub-accent);
    }
    .box input {
      flex: 1;
      min-inline-size: 0;
      border: 0;
      background: none;
      color: var(--color-text);
      font: inherit;
      font-size: var(--font-size-md);
      outline: none;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text-muted);
    }
    .chip.on {
      border-color: var(--color-hub-accent);
      color: var(--color-text);
    }
    .chip select {
      appearance: none;
      padding: var(--space-1) calc(var(--space-3) + 1rem) var(--space-1) var(--space-3);
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      font-size: var(--font-size-sm);
      cursor: pointer;
    }
    .chip select option {
      color: var(--color-text);
      background: var(--color-surface);
    }
    .chip eras-icon {
      position: absolute;
      inset-inline-end: var(--space-2);
      inline-size: 0.9rem;
      block-size: 0.9rem;
      pointer-events: none;
    }
    .heading {
      margin: 0 0 var(--space-3);
      font-size: var(--font-size-lg);
    }
    .results-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-block-end: var(--space-3);
    }
    .crumb {
      font-weight: 700;
    }
    .count,
    .note {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 2px var(--space-2);
      border: 1px solid var(--color-hub-accent);
      border-radius: 999px;
      background: none;
      color: var(--color-text);
      font: inherit;
      font-size: var(--font-size-sm);
      cursor: pointer;
    }
    .tag eras-icon {
      inline-size: 0.8rem;
      block-size: 0.8rem;
    }
    .sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicDecksPage {
  protected readonly store = inject(DecksStore);
  private readonly cards = inject(CardsStore);
  private readonly router = inject(Router);

  protected readonly sortOptions = PUBLIC_SORT_OPTIONS;
  protected readonly empty = EMPTY_DECK_SEARCH;
  protected readonly sortKey = signal<DeckSortKey>('name');
  protected readonly search = signal<DeckSearch>(EMPTY_DECK_SEARCH);
  protected readonly loading = computed(() => this.store.loading() && this.store.publicDecks().length === 0);

  private readonly profiles = computed(() => profileDecks(this.store.publicDecks(), this.cards.cards()));

  protected readonly chips = computed<Chip[]>(() => [
    { key: 'color', label: 'Color', options: CARD_COLORS.map((c) => ({ value: c, label: COLOR_LABELS[c] ?? c })) },
    { key: 'archetype', label: 'Arquetipo', options: deckArchetypes(this.profiles()).map((a) => ({ value: a, label: archetypeLabel(a) })) },
    { key: 'summon', label: 'Invocación', options: deckSummons(this.profiles()).map((k) => ({ value: k, label: SPECIAL_SUMMON_LABELS[k] ?? k })) },
    { key: 'format', label: 'Formato', options: Object.entries(FORMAT_LABELS).map(([value, label]) => ({ value, label })) },
    { key: 'origin', label: 'Origen', options: [{ value: 'system', label: 'ERAS' }, { value: 'community', label: 'Comunidad' }] },
  ]);

  /** The folders while nothing is searched nor open. */
  protected readonly showFolders = computed(() => !hasDeckSearch(this.search()) && !this.search().folder);
  protected readonly folders = computed(() =>
    DECK_FOLDERS.map((f, order) => {
      const inside = this.ordered(this.store.publicDecks().filter((d) => folderOf(d) === f.id));
      const box: DeckBox = { id: f.id, userId: '', name: f.label, color: f.color, order, deckIds: inside.map((d) => d.id) };
      return { box, count: inside.length, covers: inside.slice(0, 4).map((d) => d.deckImage ?? null) };
    }).filter((f) => f.count > 0),
  );
  protected readonly openFolderLabel = computed(() => DECK_FOLDERS.find((f) => f.id === this.search().folder)?.label ?? null);
  protected readonly results = computed(() => this.ordered(searchDecks(this.store.publicDecks(), this.search(), this.profiles())));

  /** The criteria chosen, as removable tags. */
  protected readonly active = computed(() => {
    const s = this.search();
    const out: { key: keyof DeckSearch; label: string }[] = [];
    if (s.text.trim()) out.push({ key: 'text', label: `«${s.text.trim()}»` });
    for (const chip of this.chips()) {
      const v = s[chip.key];
      if (v) out.push({ key: chip.key, label: `${chip.label}: ${chip.options.find((o) => o.value === v)?.label ?? v}` });
    }
    return out;
  });

  constructor() {
    void this.store.loadPublic();
    // Colors, archetypes and cards of each deck come from the card catalog
    void this.cards.load();
  }

  protected set<K extends keyof DeckSearch>(key: K, value: DeckSearch[K]): void {
    this.search.update((s) => ({ ...s, [key]: value }));
  }

  /** Every criterion off; an open folder stays open. */
  protected clear(): void {
    this.search.update((s) => ({ ...EMPTY_DECK_SEARCH, folder: s.folder }));
  }

  protected open(deck: Deck): void {
    void this.router.navigate(deckViewLink(deck.id), { state: FROM_PUBLIC_DECKS });
  }

  /** The system's decks in their order, then the players' as chosen (newest first by age). */
  private ordered(decks: Deck[]): Deck[] {
    const system = decks.filter((d) => d.systemDeck).sort((a, b) => (a.systemOrder ?? 0) - (b.systemOrder ?? 0));
    const key = this.sortKey();
    const community = sortDecks(decks.filter((d) => !d.systemDeck), key, key === 'createdAt' ? 'desc' : 'asc');
    return [...system, ...community];
  }
}
