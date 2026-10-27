import { Permission } from '../auth/auth.model';

export interface AdminTool {
  label: string;
  description: string;
  /** Angular route (migrated) or legacy Vue path. */
  route?: string;
  legacyPath?: string;
  /** Shown when the user has any of these. */
  permissions: Permission[];
}

/** Administration tools, in the same groups as the legacy navbar menu. */
export const ADMIN_TOOLS: AdminTool[] = [
  { label: 'Usuarios', description: 'Cuentas, roles asignados y contraseñas', route: '/users-manager', permissions: ['manage_users'] },
  { label: 'Roles', description: 'Roles y los permisos que otorgan', route: '/roles', permissions: ['manage_roles'] },
  { label: 'Permisos', description: 'Catálogo de permisos', route: '/permissions', permissions: ['manage_permissions', 'read_permissions'] },
  { label: 'Datos de referencia', description: 'Clases, instancias, tags y efectos keyword', route: '/card-ref', permissions: ['manage_cards'] },
  { label: 'Metadatos de cartas', description: 'Metadatos sin imagen y asignación de imágenes', route: '/card-meta', permissions: ['manage_cards'] },
  { label: 'Gestionar cambios', description: 'Imágenes de cartas pendientes de aplicar', route: '/updates-manager', permissions: ['manage_cards'] },
  { label: 'Registro de partidas', description: 'Partidas jugadas y notas', route: '/games-manager', permissions: ['manage_decks'] },
];
