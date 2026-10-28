import type { IconName } from '@ui/primitives/icon/icon.component';
import { Permission } from '../auth/auth.model';

export type AdminGroup = 'Cuentas y acceso' | 'Cartas' | 'Partidas';

export interface AdminTool {
  label: string;
  description: string;
  route: string;
  icon: IconName;
  group: AdminGroup;
  /** Shown when the user has any of these. */
  permissions: Permission[];
}

export const ADMIN_GROUPS: AdminGroup[] = ['Cuentas y acceso', 'Cartas', 'Partidas'];

/** Administration tools, grouped as on the /admin page. */
export const ADMIN_TOOLS: AdminTool[] = [
  { label: 'Usuarios', description: 'Cuentas, roles asignados y contraseñas', route: '/users-manager', icon: 'user', group: 'Cuentas y acceso', permissions: ['manage_users'] },
  { label: 'Roles', description: 'Roles y los permisos que otorgan', route: '/roles', icon: 'shield', group: 'Cuentas y acceso', permissions: ['manage_roles'] },
  { label: 'Permisos', description: 'Catálogo de permisos', route: '/permissions', icon: 'key', group: 'Cuentas y acceso', permissions: ['manage_permissions', 'read_permissions'] },
  { label: 'Datos de referencia', description: 'Clases, instancias, tags y efectos keyword', route: '/card-ref', icon: 'list', group: 'Cartas', permissions: ['manage_cards'] },
  { label: 'Metadatos de cartas', description: 'Metadatos sin imagen y asignación de imágenes', route: '/card-meta', icon: 'cards', group: 'Cartas', permissions: ['manage_cards'] },
  { label: 'Gestionar cambios', description: 'Imágenes de cartas pendientes de aplicar', route: '/updates-manager', icon: 'refresh', group: 'Cartas', permissions: ['manage_cards'] },
  { label: 'Registro de partidas', description: 'Partidas jugadas, notas y estadísticas', route: '/games-manager', icon: 'trophy', group: 'Partidas', permissions: ['manage_decks'] },
];
