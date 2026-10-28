import type { IconName } from '@ui/primitives/icon/icon.component';
import { Permission } from '../auth/auth.model';

export interface NavItem {
  label: string;
  route: string;
  icon: IconName;
  permission?: Permission;
}

/** Main navigation (navbar). */
export const MAIN_NAV: NavItem[] = [
  { label: 'Inicio', route: '/home', icon: 'home' },
  { label: 'Cartas', route: '/cards', icon: 'cards' },
  { label: 'Ediciones', route: '/editions', icon: 'layers' },
  { label: 'Constructor', route: '/deck-builder', icon: 'square-plus' },
  { label: 'Mazos', route: '/public-decks', icon: 'stack' },
  { label: 'Tierlist', route: '/tierlist', icon: 'trophy' },
  { label: 'Cómo jugar', route: '/ruling', icon: 'book' },
  { label: 'Simulador', route: '/simulator', icon: 'gamepad' },
];
