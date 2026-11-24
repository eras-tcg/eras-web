import { ScreenLink } from '@core/navigation/screens';
import { SortOption } from '@ui/forms/sort-control/sort-control.component';

export const PUBLIC_SORT_OPTIONS: SortOption[] = [
  { value: 'name', label: 'Nombre' },
  { value: 'username', label: 'Autor' },
  { value: 'createdAt', label: 'Antigüedad' },
];

export const MY_SORT_OPTIONS: SortOption[] = [
  { value: 'name', label: 'Nombre' },
  { value: 'createdAt', label: 'Antigüedad' },
];

export const deckViewLink = (id: string) => ['/deck', id];
export const deckBuilderQuery = (id: string, copy = false) => (copy ? { id, copy: 'true' } : { id });

/** Navigation state of a deck opened from another screen, so its "back" returns there as it was left. */
export interface DeckArrival {
  from?: string;
  /** That screen's query params (a tab, a folder, a search…). */
  query?: Record<string, string>;
}

/** Where a deck can be opened from, other than the player's own decks (the screen tree's default). */
const DECK_ORIGINS: Record<string, ScreenLink> = {
  'public-decks': { route: '/public-decks', label: 'Mazos públicos' },
  tierlist: { route: '/tierlist', label: 'Tierlist' },
};

/** A deck opened from the public list: "back" returns to it, with its tab, folder and search. */
export const fromPublicDecks = (query: Record<string, string>): DeckArrival => ({ from: 'public-decks', query });

/** A deck opened from the tierlist: "back" returns to it, on the same page. */
export const fromTierlist = (query: Record<string, string>): DeckArrival => ({ from: 'tierlist', query });

/** Where "back" leads from a deck, by how it was opened; undefined: the screen tree's default (the player's decks). */
export function deckBackLink(arrival: DeckArrival | null | undefined): ScreenLink | undefined {
  const origin = arrival?.from ? DECK_ORIGINS[arrival.from] : undefined;
  return origin ? { ...origin, queryParams: arrival?.query } : undefined;
}
