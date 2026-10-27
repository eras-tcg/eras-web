import { Permission } from '../auth/auth.model';

export interface NavItem {
  label: string;
  /** Angular route (page already migrated) */
  route?: string;
  /** Path in the legacy Vue app (page not migrated yet) */
  legacyPath?: string;
  permission?: Permission;
}

/** Main navigation. A page moves from `legacyPath` to `route` when it is migrated. */
export const MAIN_NAV: NavItem[] = [
  { label: 'Inicio', route: '/home' },
  { label: 'Cartas', route: '/cards' },
  { label: 'Ediciones', route: '/editions' },
  { label: 'Constructor de mazos', route: '/deck-builder' },
  { label: 'Mazos', route: '/public-decks' },
  { label: 'Tierlist', route: '/tierlist' },
  { label: 'Cómo jugar', route: '/ruling' },
  { label: 'Simulador', legacyPath: '/simulator' },
];
