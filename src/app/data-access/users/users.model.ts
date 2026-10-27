/** GET /api/users (manage_users). */
export interface UserRecord {
  id: string;
  username: string;
  email: string | null;
  /** Role name. */
  role: string | null;
  verified: boolean;
}

/** PUT /api/users/update/{id} */
export interface UserUpdate {
  username: string;
  email: string;
  roleId?: string;
}

export interface PermissionRecord {
  id: string;
  name: string;
  description?: string | null;
}

/** GET /api/roles (manage_roles). Permissions come as objects or, in older data, as names. */
export interface RoleRecord {
  id: string;
  name: string;
  permissions: (PermissionRecord | string)[];
}

export interface RoleUpdate {
  name: string;
  newName?: string;
  permissionsToAdd: string[];
  permissionsToRemove: string[];
}

export function rolePermissionNames(role: RoleRecord): string[] {
  return role.permissions.map((p) => (typeof p === 'string' ? p : p.name)).filter(Boolean);
}

/** What to send to change `role`'s permissions from what it has to `wanted`. */
export function permissionDiff(role: RoleRecord, wanted: readonly string[]): { add: string[]; remove: string[] } {
  const current = rolePermissionNames(role);
  return { add: wanted.filter((p) => !current.includes(p)), remove: current.filter((p) => !wanted.includes(p)) };
}
