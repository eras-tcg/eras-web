import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { UsersAdminApi } from '@data/users/users.api';
import { RoleRecord, UserRecord } from '@data/users/users.model';
import { TableComponent } from '@ui/data/table/table.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { feedbackState } from './admin-feedback';
import { PluralPipe } from '@ui/utilities/plural.pipe';

/** User accounts (manage_users). Changing a user's role also needs manage_roles (to list roles). */
@Component({
  selector: 'eras-users-page',
  imports: [PluralPipe, PageComponent, CardComponent, GridComponent, StackComponent, FormFieldComponent, TableComponent, AlertComponent, EmptyStateComponent, BadgeComponent, ButtonComponent, IconComponent, SpinnerComponent],
  templateUrl: './users.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly api = inject(UsersAdminApi);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);

  protected readonly fb = feedbackState();
  protected readonly users = signal<UserRecord[]>([]);
  protected readonly roles = signal<RoleRecord[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly query = signal('');
  protected readonly busyId = signal<string | null>(null);

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = [...this.users()].sort((a, b) => a.username.localeCompare(b.username, 'es', { sensitivity: 'base' }));
    return q ? list.filter((u) => [u.username, u.email, u.role].some((v) => v?.toLowerCase().includes(q))) : list;
  });
  protected readonly unverified = computed(() => this.users().filter((u) => !u.verified).length);

  // ── Edit panel ────────────────────────────────────────────────────────
  protected readonly editing = signal<UserRecord | null>(null);
  protected readonly editUsername = signal('');
  protected readonly editEmail = signal('');
  protected readonly editRoleId = signal('');
  protected readonly saving = signal(false);
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly savingPassword = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordOk = signal(false);

  protected readonly isSelf = (u: UserRecord) => u.id === this.auth.user()?.id;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.fb.clear();
    try {
      const [users, roles] = await Promise.all([
        firstValueFrom(this.api.listUsers()),
        // Roles need manage_roles: without it users still load, only the role picker is hidden
        firstValueFrom(this.api.listRoles()).catch(() => null),
      ]);
      this.users.set(users);
      this.roles.set(roles);
    } catch (e) {
      this.fb.fail(e, 'No se pudieron cargar los usuarios');
    } finally {
      this.loading.set(false);
    }
  }

  protected edit(user: UserRecord): void {
    this.editing.set(user);
    this.editUsername.set(user.username);
    this.editEmail.set(user.email ?? '');
    this.editRoleId.set(this.roles()?.find((r) => r.name === user.role)?.id ?? '');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.passwordError.set(null);
    this.passwordOk.set(false);
  }

  protected async save(): Promise<void> {
    const user = this.editing();
    if (!user) return;
    const username = this.editUsername().trim();
    const email = this.editEmail().trim();
    if (!username || !email) return;
    this.saving.set(true);
    this.fb.clear();
    try {
      const roleId = this.editRoleId() || undefined;
      await firstValueFrom(this.api.updateUser(user.id, { username, email, roleId }));
      const role = this.roles()?.find((r) => r.id === roleId)?.name ?? user.role;
      this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, username, email, role } : u)));
      this.editing.set(null);
      this.fb.ok(`Usuario ${username} actualizado`);
    } catch (e) {
      this.fb.fail(e, 'No se pudo actualizar el usuario');
    } finally {
      this.saving.set(false);
    }
  }

  protected async setPassword(): Promise<void> {
    const user = this.editing();
    if (!user) return;
    this.passwordError.set(null);
    this.passwordOk.set(false);
    if (!this.newPassword()) return this.passwordError.set('Ingresa una contraseña');
    if (this.newPassword() !== this.confirmPassword()) return this.passwordError.set('Las contraseñas no coinciden');
    this.savingPassword.set(true);
    try {
      await firstValueFrom(this.api.setPassword(user.id, this.newPassword()));
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.passwordOk.set(true);
    } catch (e) {
      this.passwordError.set(apiErrorMessage(e, 'No se pudo cambiar la contraseña'));
    } finally {
      this.savingPassword.set(false);
    }
  }

  protected async remove(user: UserRecord): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Eliminar usuario',
      message: `¿Eliminar la cuenta de "${user.username}"? Sus mazos no se borran.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.busyId.set(user.id);
    this.fb.clear();
    try {
      await firstValueFrom(this.api.deleteUser(user.id));
      this.users.update((list) => list.filter((u) => u.id !== user.id));
      if (this.editing()?.id === user.id) this.editing.set(null);
      this.fb.ok(`Usuario ${user.username} eliminado`);
    } catch (e) {
      this.fb.fail(e, 'No se pudo eliminar el usuario');
    } finally {
      this.busyId.set(null);
    }
  }
}
