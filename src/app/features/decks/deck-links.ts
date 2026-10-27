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
