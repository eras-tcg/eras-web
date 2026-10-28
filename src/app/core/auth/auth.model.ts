export interface AuthUser {
  id: string;
  username: string;
  permissions: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** A user record as UsersService returns it (GET /api/users, manage_users only). */
export interface AccountRecord {
  id: string;
  username: string;
  email?: string | null;
}

export interface AccountUpdate {
  username: string;
  email: string;
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
