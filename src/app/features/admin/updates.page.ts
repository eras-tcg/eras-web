import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardsStore } from '@data/cards/cards.store';
import { StagedChange, StagedChangesApi } from '@data/cards/staged.api';
import { TableComponent } from '@ui/data/table/table.component';
import { ColorPipComponent } from '@ui/domain/color-pip/color-pip.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { feedbackState } from './admin-feedback';

/** Card image changes synced from Drive, waiting to be applied or rejected (manage_cards). */
@Component({
  selector: 'eras-updates-page',
  imports: [DatePipe, PageComponent, TableComponent, ColorPipComponent, AlertComponent, EmptyStateComponent, BadgeComponent, ButtonComponent, SpinnerComponent],
  template: `
    <eras-page title="Gestionar cambios" subtitle="Imágenes de cartas detectadas en Drive pendientes de aplicar">
      <ng-container ngProjectAs="[page-actions]">
        <button erasButton variant="secondary" type="button" [disabled]="loading()" (click)="load()">Recargar</button>
        <button erasButton type="button" [loading]="applyingAll()" [disabled]="applyingAll() || changes().length === 0" (click)="applyAll()">
          Aplicar todos ({{ changes().length }})
        </button>
      </ng-container>

      @if (fb.feedback(); as f) {
        <eras-alert [tone]="f.tone">{{ f.text }}</eras-alert>
      }

      @if (loading() && changes().length === 0) {
        <eras-empty-state title="Cargando cambios…"><eras-spinner /></eras-empty-state>
      } @else if (changes().length === 0) {
        <eras-empty-state title="No hay cambios pendientes" />
      } @else {
        <eras-table>
          <table>
            <thead>
              <tr>
                <th>Acción</th>
                <th>Carta</th>
                <th>#</th>
                <th>Color</th>
                <th>Edición</th>
                <th>Detectado</th>
                <th class="actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (c of changes(); track c.id) {
                <tr>
                  <td>
                    <eras-badge [tone]="c.action === 'delete' ? 'danger' : 'success'">{{ c.action === 'delete' ? 'Eliminar' : 'Agregar / actualizar' }}</eras-badge>
                  </td>
                  <td>
                    <div>{{ c.name || '—' }}</div>
                    <div class="muted">{{ c.fileName }}</div>
                  </td>
                  <td>{{ c.number ?? '—' }}</td>
                  <td>
                    @if (c.colorIdentity) {
                      <eras-color-pip [color]="c.colorIdentity" /> {{ c.colorIdentity }}
                    } @else {
                      —
                    }
                  </td>
                  <td>{{ c.edition || '—' }}{{ c.subEdition ? '.' + c.subEdition : '' }}</td>
                  <td class="muted">{{ c.stagedAt ? (c.stagedAt | date: 'short') : '—' }}</td>
                  <td class="actions">
                    <button erasButton size="sm" type="button" [disabled]="busy() === c.id" (click)="apply(c)">Aplicar</button>
                    <button erasButton variant="ghost" size="sm" type="button" [disabled]="busy() === c.id" (click)="reject(c)">Rechazar</button>
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
export class UpdatesPage {
  private readonly api = inject(StagedChangesApi);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);

  protected readonly fb = feedbackState();
  protected readonly changes = signal<StagedChange[]>([]);
  protected readonly loading = signal(false);
  protected readonly applyingAll = signal(false);
  protected readonly busy = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.changes.set(await firstValueFrom(this.api.list()));
    } catch (e) {
      this.fb.fail(e, 'No se pudieron cargar los cambios');
    } finally {
      this.loading.set(false);
    }
  }

  protected async apply(c: StagedChange): Promise<void> {
    await this.run(c, () => this.api.apply(c.id), `Aplicado: ${c.name || c.fileName || c.id}`);
    void this.cards.load(true);
  }

  protected async reject(c: StagedChange): Promise<void> {
    await this.run(c, () => this.api.reject(c.id), `Rechazado: ${c.name || c.fileName || c.id}`);
  }

  protected async applyAll(): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Aplicar todos los cambios',
      message: `Se aplicarán ${this.changes().length} cambios al catálogo de cartas.`,
      confirmLabel: 'Aplicar todos',
    });
    if (!ok) return;
    this.applyingAll.set(true);
    this.fb.clear();
    try {
      const { applied } = await firstValueFrom(this.api.applyAll());
      this.fb.ok(`Se aplicaron ${applied} cambios`);
      void this.cards.load(true);
      await this.load();
    } catch (e) {
      this.fb.fail(e, 'No se pudieron aplicar los cambios');
    } finally {
      this.applyingAll.set(false);
    }
  }

  private async run(c: StagedChange, call: () => ReturnType<StagedChangesApi['apply']>, done: string): Promise<void> {
    this.busy.set(c.id);
    this.fb.clear();
    try {
      await firstValueFrom(call());
      this.changes.update((list) => list.filter((x) => x.id !== c.id));
      this.fb.ok(done);
    } catch (e) {
      this.fb.fail(e, 'No se pudo completar la acción');
    } finally {
      this.busy.set(null);
    }
  }
}
