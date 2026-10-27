import { CardSortKey, SortDirection } from '@data/cards/card-filters';

/** How the grid is shown (not what is shown). */
export interface CardView {
  sort: CardSortKey;
  direction: SortDirection;
  /** One card per name (its newest printing). */
  collapse: boolean;
  /** Minimum card width in px. */
  size: number;
}

export const DEFAULT_VIEW: CardView = { sort: 'number', direction: 'asc', collapse: true, size: 200 };

export const SORT_OPTIONS: { value: CardSortKey; label: string }[] = [
  { value: 'number', label: 'Número' },
  { value: 'name', label: 'Nombre' },
  { value: 'cost', label: 'Coste' },
  { value: 'level', label: 'Nivel' },
  { value: 'strength', label: 'Fuerza' },
];
