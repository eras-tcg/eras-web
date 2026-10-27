import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UsersAdminApi } from '@data/users/users.api';
import { PermissionRecord, RoleRecord, permissionDiff, rolePermissionNames } from '@data/users/users.model';
import { TableComponent } from '@ui/data/table/table.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { MultiselectComponent } from '@ui/forms/multiselect/multiselect.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { feedbackState } from './admin-feedback';

type Draft = { mode: 'create' } | { mode: 'edit'; role: RoleRecord };

/** Roles and the permissions each grants (manage_roles). */
@Component({
  selector: 'eras-roles-page',
  imports: [PageComponent, CardComponent, StackComponent, FormFieldComponent, MultiselectComponent, TableComponent, AlertComponent, EmptyStateComponent, BadgeComponent, ButtonComponent, IconComponent, SpinnerComponent],
  template: `
    <eras-page title="Roles" subtitle="Cada usuario tiene un rol; el rol define sus permisos">
      <ng-container ngProjectAs="[page-actions]">
        <button erasButton variant="secondary" type="button" [disabled]="loading()" (click)="load()">Recargar</button>
        <button erasButton type="button" (click)="startCreate()"><eras-icon name="plus" /> Nuevo rol</button>
      </ng-container>

      @if (fb.feedback(); as f) {
        <eras-alert [tone]="f.tone">{{ f.text }}</eras-alert>
      }

      @if (draft(); as d) {
        <eras-card>
          <eras-stack [gap]="3">
            <strong>{{ d.mode === 'edit' ? 'Editar rol ' + d.role.name : 'Nuevo rol' }}</strong>
            <eras-form-field label="Nombre" required>
              <input [value]="name()" (input)="name.set($any($event.target).value)" />
            </eras-form-field>
            <eras-multiselect label="Permisos" placeholder="Ninguno" [options]="permissionNames()" [value]="selected()" (valueChange)="selected.set($event)" />
            <eras-stack direction="row" [gap]="2">
              <button erasButton type="button" [loading]="saving()" [disabled]="saving() || !name().trim()" (click)="save()">
                {{ d.mode === 'edit' ? 'Guardar cambios' : 'Crear rol' }}
              </button>
              <button erasButton variant="ghost" type="button" (click)="draft.set(null)">Cancelar</button>
            </eras-stack>
          </eras-stack>
        </eras-card>
      }

      @if (loading() && roles().length === 0) {
        <eras-empty-state title="Cargando…"><eras-spinner /></eras-empty-state>
      } @else if (roles().length === 0) {
        <eras-empty-state title="No hay roles" />
      } @else {
        <eras-table>
          <table>
            <thead>
              <tr>
                <th>Rol</th>
                <th>Permisos</th>
                <th class="actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (role of roles(); track role.name) {
                <tr>
                  <td><strong>{{ role.name }}</strong></td>
                  <td>
                    <eras-stack direction="row" [gap]="1" wrap>
                      @for (p of names(role); track p) {
                        <eras-badge>{{ p }}</eras-badge>
                      } @empty {
                        <span class="muted">Sin permisos</span>
                      }
                    </eras-stack>
                  </td>
                  <td class="actions">
                    <button erasButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Editar ' + role.name" (click)="startEdit(role)"><eras-icon name="edit" /></button>
                    <button erasButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Eliminar ' + role.name" [disabled]="busy() === role.name" (click)="remove(role)"><eras-icon name="x" /></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </eras-table>
      }
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private readonly api = inject(UsersAdminApi);
  private readonly modal = inject(ModalService);

  protected readonly fb = feedbackState();
  protected readonly roles = signal<RoleRecord[]>([]);
  private readonly permissions = signal<PermissionRecord[]>([]);
  protected readonly permissionNames = computed(() => this.permissions().map((p) => p.name).sort());
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly name = signal('');
  protected readonly selected = signal<string[]>([]);
  protected readonly names = rolePermissionNames;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [roles, permissions] = await Promise.all([
        firstValueFrom(this.api.listRoles()),
        // Needs read_permissions; without it the role list still works, only the picker is empty
        firstValueFrom(this.api.listPermissions()).catch(() => [] as PermissionRecord[]),
      ]);
      this.roles.set(roles);
      this.permissions.set(permissions);
    } catch (e) {
      this.fb.fail(e, 'No se pudieron cargar los roles');
    } finally {
      this.loading.set(false);
    }
  }

  protected startCreate(): void {
    this.draft.set({ mode: 'create' });
    this.name.set('');
    this.selected.set([]);
  }

  protected startEdit(role: RoleRecord): void {
    this.draft.set({ mode: 'edit', role });
    this.name.set(role.name);
    this.selected.set(rolePermissionNames(role));
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    const name = this.name().trim();
    if (!draft || !name) return;
    this.saving.set(true);
    this.fb.clear();
    try {
      if (draft.mode === 'create') {
        const created = await firstValueFrom(this.api.createRole(name, this.selected()));
        this.roles.update((list) => [...list, created]);
        this.fb.ok('Rol creado');
      } else {
        const { add, remove } = permissionDiff(draft.role, this.selected());
        const updated = await firstValueFrom(
          this.api.updateRole({
            name: draft.role.name,
            newName: name !== draft.role.name ? name : undefined,
            permissionsToAdd: add,
            permissionsToRemove: remove,
          }),
        );
        this.roles.update((list) => list.map((r) => (r.name === draft.role.name ? updated : r)));
        this.fb.ok('Rol actualizado');
      }
      this.draft.set(null);
    } catch (e) {
      this.fb.fail(e, 'No se pudo guardar el rol');
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(role: RoleRecord): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Eliminar rol',
      message: `¿Eliminar el rol "${role.name}"?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.busy.set(role.name);
    this.fb.clear();
    try {
      await firstValueFrom(this.api.deleteRole(role.name));
      this.roles.update((list) => list.filter((r) => r.name !== role.name));
      this.fb.ok('Rol eliminado');
    } catch (e) {
      this.fb.fail(e, 'No se pudo eliminar el rol');
    } finally {
      this.busy.set(null);
    }
  }
}
