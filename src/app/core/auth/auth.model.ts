export interface AuthUser {
  id: string;
  username: string;
  permissions: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** Permission codes defined by UsersService (open-ended: new codes are plain strings). */
export type Permission =
  | 'manage_editions'
  | 'manage_cards'
  | 'manage_decks'
  | 'manage_home'
  | 'manage_users'
  | 'manage_roles'
  | 'manage_permissions'
  | 'read_permissions'
  | (string & {});
