import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { COLOR_LABELS, CARD_COLORS, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { CardsStore } from '@data/cards/cards.store';
import {
  DeckScope,
  DeckSearch,
  EMPTY_DECK_SEARCH,
  archetypeLabel,
  deckArchetypes,
  deckEditionsOf,
  deckSummons,
  folderLabel,
  folderOf,
  hasDeckSearch,
  profileDecks,
  searchDecks,
  systemFolders,
} from '@data/decks/deck-search';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DeckBox, DeckBoxColor } from '@data/decks/deckbox.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { CrumbsComponent } from '@ui/layout/crumbs/crumbs.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { PillComponent } from '@ui/primitives/pill/pill.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { TabItem, TabsComponent } from '@ui/surfaces/tabs/tabs.component';
import { DeckBoxTileComponent } from './deckbox-tile.component';
import { PUBLIC_SORT_OPTIONS, deckViewLink, fromPublicDecks } from './deck-links';

/** A criterion chip: a select whose first option is "any". */
interface Chip {
  key: 'color' | 'archetype' | 'summon' | 'edition';
  label: string;
  options: { value: string; label: string }[];
}

/** A folder tile: a deckbox-like tile made of its first decks' covers. */
interface Tile {
  box: DeckBox;
  count: number;
  covers: (string | null)[];
}

const COVER_COLUMN = 'var(--cover-column, min(11rem, 40vw, 34dvh))';

/**
 * Public decks, in two tabs: the system's (one folder per edition, the Structures apart; each edition's decks are the
 * ones its new cards make, at least one per color) and the community's (searched, never split). One search box (name,
 * author, archetype, color or a card in it) and the common criteria as chips (color, archetype, special summon, edition,
 * order) filter both: each tab says how many of its decks match.
 */
@Component({
  selector: 'eras-public-decks-page',
  imports: [PageComponent, CrumbsComponent, PillComponent, TabsComponent, DeckCoverComponent, DeckBoxTileComponent, GridComponent, AlertComponent, EmptyStateComponent, ButtonComponent, IconComponent, SpinnerComponent],
  template: `
    <eras-page title="Mazos públicos" width="wide">
      @if (store.error(); as error) {
        <eras-alert tone="danger">{{ error }}</eras-alert>
      }

      <eras-tabs class="tabs" label="Origen de los mazos" [tabs]="tabs()" [selected]="search().scope" (selectedChange)="go($any($event), '')" />

      <div class="search" role="search">
        <label class="box">
          <eras-icon name="search" />
          <input
            type="search"
            [placeholder]="placeholder()"
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

      @if (search().folder; as folder) {
        <eras-crumbs class="crumbs">
          <button crumbs-back erasButton variant="glass" size="sm" type="button" (click)="go('system', '')"><eras-icon name="chevron-left" /> Ediciones</button>
          <ng-container crumbs-here>{{ folderTitle(folder) }}</ng-container>
        </eras-crumbs>
      }

      @if (loading()) {
        <eras-empty-state title="Cargando mazos…"><eras-spinner /></eras-empty-state>
      } @else if (view() === 'folders') {
        <eras-grid [minColumn]="coverColumn" [gap]="4">
          @for (t of folders(); track t.box.id) {
            <eras-deckbox-tile noun="la carpeta" [box]="t.box" [count]="t.count" [covers]="t.covers" (opened)="go('system', t.box.id)" />
          }
        </eras-grid>
      } @else {
        <div class="results-head">
          <span erasPill>{{ results().length }} {{ results().length === 1 ? 'mazo' : 'mazos' }}</span>
          @for (a of active(); track a.key) {
            <button class="tag" type="button" [attr.aria-label]="'Quitar ' + a.label" (click)="set(a.key, '')">{{ a.label }} <eras-icon name="x" /></button>
          }
          @if (active().length) {
            <button erasButton variant="glass" size="sm" type="button" (click)="clear()"><eras-icon name="x" /> Limpiar filtros</button>
          }
        </div>
        @if (results().length === 0) {
          <p class="note">Ningún mazo coincide con la búsqueda.</p>
        }
        <eras-grid [minColumn]="coverColumn" [gap]="4">
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
    .tabs {
      margin-block-end: var(--space-4);
    }
    .search {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-block-end: var(--space-4);
    }
    .box {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface-glass);
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
      background: var(--color-surface-glass);
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
    .crumbs {
      margin-block-end: var(--space-3);
    }
    .results-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-block-end: var(--space-3);
    }
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
  private readonly route = inject(ActivatedRoute);

  protected readonly sortOptions = PUBLIC_SORT_OPTIONS;
  protected readonly coverColumn = COVER_COLUMN;
  // The tab, folder, search and order live in the address: "back" from a deck (and a reload) returns to them
  private readonly initial = readQuery(this.route.snapshot.queryParamMap);
  protected readonly sortKey = signal<DeckSortKey>(this.initial.sort);
  protected readonly search = signal<DeckSearch>(this.initial.search);
  private readonly query = computed(() => writeQuery(this.search(), this.sortKey()));
  protected readonly loading = computed(() => this.store.loading() && this.store.publicDecks().length === 0);

  private readonly profiles = computed(() => profileDecks(this.store.publicDecks(), this.cards.cards()));

  protected readonly chips = computed<Chip[]>(() => [
    { key: 'color', label: 'Color', options: CARD_COLORS.map((c) => ({ value: c, label: COLOR_LABELS[c] ?? c })) },
    { key: 'archetype', label: 'Arquetipo', options: deckArchetypes(this.profiles()).map((a) => ({ value: a, label: archetypeLabel(a) })) },
    { key: 'summon', label: 'Invocación', options: deckSummons(this.profiles()).map((k) => ({ value: k, label: SPECIAL_SUMMON_LABELS[k] ?? k })) },
    { key: 'edition', label: 'Edición', options: deckEditionsOf(this.profiles()).map((e) => ({ value: e, label: e })) },
  ]);

  /** What shows: the two ways in, the system's edition folders, or decks (a folder, the community or a search). */
  protected readonly view = computed<'folders' | 'decks'>(() => {
    const s = this.search();
    return s.scope === 'system' && !s.folder && !hasDeckSearch(s) ? 'folders' : 'decks';
  });

  /** The two tabs, each with how many of its decks match the search (all of them while nothing is searched). */
  protected readonly tabs = computed<TabItem[]>(() => {
    const s = { ...this.search(), folder: '' };
    const n = (scope: DeckScope) => searchDecks(this.store.publicDecks(), { ...s, scope }, this.profiles()).length;
    return [
      { key: 'system', label: `Sistema (${n('system')})` },
      { key: 'community', label: `Comunidad (${n('community')})` },
    ];
  });

  protected readonly placeholder = computed(() => {
    const s = this.search();
    return s.folder ? `Buscar en ${folderLabel(s.folder)}…` : 'Buscar mazo, autor, arquetipo o carta…';
  });

  protected readonly folders = computed<Tile[]>(() => {
    const all = this.store.publicDecks();
    return systemFolders(all).map((f) => this.tile(f, folderLabel(f), 'blue', all.filter((d) => d.systemDeck && folderOf(d) === f)));
  });

  protected readonly results = computed(() => this.ordered(searchDecks(this.store.publicDecks(), this.search(), this.profiles())));

  /** An edition folder's title: "Structure", "E1.2". */
  protected folderTitle(folder: string): string {
    return folderLabel(folder);
  }

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
    effect(() => {
      const queryParams = this.query();
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    });
    void this.store.loadPublic();
    // Colors, archetypes, editions and cards of each deck come from the card catalog
    void this.cards.load();
  }

  protected set<K extends keyof DeckSearch>(key: K, value: DeckSearch[K]): void {
    this.search.update((s) => ({ ...s, [key]: value }));
  }

  /** Into a tab (and an edition folder), keeping the criteria chosen. */
  protected go(scope: DeckScope, folder: string): void {
    this.search.update((s) => ({ ...s, scope, folder }));
  }

  /** Every criterion off; the part open stays. */
  protected clear(): void {
    this.search.update((s) => ({ ...EMPTY_DECK_SEARCH, scope: s.scope, folder: s.folder }));
  }

  protected open(deck: Deck): void {
    void this.router.navigate(deckViewLink(deck.id), { state: fromPublicDecks(this.query()) });
  }

  private tile(id: string, name: string, color: DeckBoxColor, decks: Deck[]): Tile {
    const inside = this.ordered(decks);
    const box: DeckBox = { id, userId: '', name, color, order: 0, deckIds: inside.map((d) => d.id) };
    return { box, count: inside.length, covers: inside.slice(0, 4).map((d) => d.deckImage ?? null) };
  }

  /** The system's decks in their order (edition by edition, color by color), then the players' as chosen. */
  private ordered(decks: Deck[]): Deck[] {
    const system = decks.filter((d) => d.systemDeck).sort((a, b) => (a.systemOrder ?? 0) - (b.systemOrder ?? 0));
    const key = this.sortKey();
    const community = sortDecks(decks.filter((d) => !d.systemDeck), key, key === 'createdAt' ? 'desc' : 'asc');
    return [...system, ...community];
  }
}

/** Address keys of the page's state (only what differs from the start: the system's tab, no search, by name). */
const QUERY = { scope: 'tab', folder: 'ed', text: 'q', color: 'color', archetype: 'arq', summon: 'inv', edition: 'edicion' } as const;

function readQuery(params: { get(key: string): string | null }): { search: DeckSearch; sort: DeckSortKey } {
  const get = (k: string) => params.get(k) ?? '';
  const scope: DeckScope = get(QUERY.scope) === 'community' ? 'community' : 'system';
  const sort = get('orden');
  return {
    search: {
      ...EMPTY_DECK_SEARCH,
      scope,
      folder: scope === 'system' ? get(QUERY.folder) : '',
      text: get(QUERY.text),
      color: get(QUERY.color),
      archetype: get(QUERY.archetype),
      summon: get(QUERY.summon),
      edition: get(QUERY.edition),
    },
    sort: sort === 'username' || sort === 'createdAt' ? sort : 'name',
  };
}

function writeQuery(s: DeckSearch, sort: DeckSortKey): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.scope === 'community') out[QUERY.scope] = 'community';
  for (const key of ['folder', 'text', 'color', 'archetype', 'summon', 'edition'] as const) if (s[key]) out[QUERY[key]] = s[key];
  if (sort !== 'name') out['orden'] = sort;
  return out;
}
