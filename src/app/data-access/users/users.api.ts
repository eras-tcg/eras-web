import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { PermissionRecord, RoleRecord, RoleUpdate, UserRecord, UserUpdate } from './users.model';

/** UsersService administration endpoints (users, roles, permissions). */
@Injectable({ providedIn: 'root' })
export class UsersAdminApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  // Users (manage_users)
  /** A new account (UsersService's registration): role USER, and an e-mail to validate it. */
  register(username: string, email: string, password: string): Observable<string> {
    return this.http.post(this.api.url('/api/auth/register'), { username, email, password }, { responseType: 'text' });
  }
  listUsers(): Observable<UserRecord[]> {
    return this.http.get<UserRecord[]>(this.api.url('/api/users'));
  }
  updateUser(id: string, update: UserUpdate): Observable<unknown> {
    return this.http.put(this.api.url(`/api/users/update/${encodeURIComponent(id)}`), update);
  }
  setPassword(id: string, newPassword: string): Observable<unknown> {
    return this.http.put(this.api.url(`/api/users/set-password/${encodeURIComponent(id)}`), { newPassword });
  }
  deleteUser(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/users/delete/${encodeURIComponent(id)}`), { responseType: 'text' });
  }

  // Roles (manage_roles)
  listRoles(): Observable<RoleRecord[]> {
    return this.http.get<RoleRecord[]>(this.api.url('/api/roles'));
  }
  createRole(name: string, permissions: string[]): Observable<RoleRecord> {
    return this.http.post<RoleRecord>(this.api.url('/api/roles'), { name, permissions, createMissingPermissions: false });
  }
  updateRole(update: RoleUpdate): Observable<RoleRecord> {
    return this.http.put<RoleRecord>(this.api.url('/api/roles'), { ...update, createMissingPermissions: false });
  }
  deleteRole(name: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/roles/${encodeURIComponent(name)}`), { responseType: 'text' });
  }

  // Permissions (read_permissions to list, manage_permissions to change)
  listPermissions(): Observable<PermissionRecord[]> {
    return this.http.get<PermissionRecord[]>(this.api.url('/api/permissions'));
  }
  createPermission(name: string, description: string | null): Observable<PermissionRecord> {
    return this.http.post<PermissionRecord>(this.api.url('/api/permissions'), { name, description });
  }
  updatePermission(id: string, newName: string, description: string | null): Observable<PermissionRecord> {
    return this.http.put<PermissionRecord>(this.api.url(`/api/permissions/${encodeURIComponent(id)}`), { newName, description });
  }
  deletePermission(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/permissions/${encodeURIComponent(id)}`), { responseType: 'text' });
  }
}
