import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { UsersAdminApi } from '@data/users/users.api';
import { PermissionRecord } from '@data/users/users.model';
import { TableComponent } from '@ui/data/table/table.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { feedbackState } from './admin-feedback';

/** Permission catalog. read_permissions lists it; manage_permissions creates, edits and deletes. */
@Component({
  selector: 'eras-permissions-page',
  imports: [ReactiveFormsModule, PageComponent, CardComponent, StackComponent, FormFieldComponent, TableComponent, AlertComponent, EmptyStateComponent, ButtonComponent, IconComponent, SpinnerComponent],
  template: `
    <eras-page title="Permisos" subtitle="Códigos que se asignan a los roles">
      <button page-actions erasButton variant="secondary" type="button" [disabled]="loading()" (click)="load()">Recargar</button>

      @if (fb.feedback(); as f) {
        <eras-alert [tone]="f.tone">{{ f.text }}</eras-alert>
      }

      @if (canManage()) {
        <eras-card>
          <form [formGroup]="form" (ngSubmit)="save()">
            <eras-stack [gap]="3">
              <strong>{{ editing() ? 'Editar permiso ' + editing()!.name : 'Nuevo permiso' }}</strong>
              <eras-stack direction="row" [gap]="3" wrap align="end">
                <eras-form-field label="Nombre" required>
                  <input formControlName="name" placeholder="manage_algo" />
                </eras-form-field>
                <eras-form-field label="Descripción">
                  <input formControlName="description" />
                </eras-form-field>
                <button erasButton type="submit" [loading]="saving()" [disabled]="saving() || form.invalid">
                  {{ editing() ? 'Guardar cambios' : 'Crear' }}
                </button>
                @if (editing()) {
                  <button erasButton variant="ghost" type="button" (click)="cancel()">Cancelar</button>
                }
              </eras-stack>
            </eras-stack>
          </form>
        </eras-card>
      }

      @if (loading() && permissions().length === 0) {
        <eras-empty-state title="Cargando…"><eras-spinner /></eras-empty-state>
      } @else if (permissions().length === 0) {
        <eras-empty-state title="No hay permisos" />
      } @else {
        <eras-table>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                @if (canManage()) {
                  <th class="actions">Acciones</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (p of permissions(); track p.id) {
                <tr>
                  <td><code>{{ p.name }}</code></td>
                  <td class="muted">{{ p.description || '—' }}</td>
                  @if (canManage()) {
                    <td class="actions">
                      <button erasButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Editar ' + p.name" (click)="edit(p)"><eras-icon name="edit" /></button>
                      <button erasButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Eliminar ' + p.name" [disabled]="busyId() === p.id" (click)="remove(p)"><eras-icon name="x" /></button>
                    </td>
                  }
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
export class PermissionsPage {
  private readonly api = inject(UsersAdminApi);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);

  protected readonly fb = feedbackState();
  protected readonly permissions = signal<PermissionRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly editing = signal<PermissionRecord | null>(null);
  protected readonly canManage = computed(() => this.auth.user() !== null && this.auth.can('manage_permissions'));

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    description: [''],
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.permissions.set(await firstValueFrom(this.api.listPermissions()));
    } catch (e) {
      this.fb.fail(e, 'No se pudieron cargar los permisos');
    } finally {
      this.loading.set(false);
    }
  }

  protected edit(p: PermissionRecord): void {
    this.editing.set(p);
    this.form.setValue({ name: p.name, description: p.description ?? '' });
  }

  protected cancel(): void {
    this.editing.set(null);
    this.form.reset();
  }

  protected async save(): Promise<void> {
    const name = this.form.controls.name.value.trim();
    const description = this.form.controls.description.value.trim() || null;
    if (!name) return;
    const editing = this.editing();
    this.saving.set(true);
    this.fb.clear();
    try {
      if (editing) {
        const saved = await firstValueFrom(this.api.updatePermission(editing.id, name, description));
        this.permissions.update((list) => list.map((p) => (p.id === editing.id ? saved : p)));
        this.fb.ok('Permiso actualizado');
      } else {
        const saved = await firstValueFrom(this.api.createPermission(name, description));
        this.permissions.update((list) => [...list, saved]);
        this.fb.ok('Permiso creado');
      }
      this.cancel();
    } catch (e) {
      this.fb.fail(e, 'No se pudo guardar el permiso');
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(p: PermissionRecord): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Eliminar permiso',
      message: `¿Eliminar "${p.name}"? Los roles que lo tengan lo perderán.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.busyId.set(p.id);
    this.fb.clear();
    try {
      await firstValueFrom(this.api.deletePermission(p.id));
      this.permissions.update((list) => list.filter((x) => x.id !== p.id));
      if (this.editing()?.id === p.id) this.cancel();
      this.fb.ok('Permiso eliminado');
    } catch (e) {
      this.fb.fail(e, 'No se pudo eliminar el permiso');
    } finally {
      this.busyId.set(null);
    }
  }
}
