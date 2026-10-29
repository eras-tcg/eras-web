import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardsStore } from '@data/cards/cards.store';
import { StagedChange, StagedChangesApi } from '@data/cards/staged.api';
import { StagedApplyStore } from '@data/cards/staged-apply.store';
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
        <button erasButton type="button" [loading]="applying.running()" [disabled]="applying.running() || changes().length === 0" (click)="applyAll()">
          Aplicar todos ({{ changes().length }})
        </button>
      </ng-container>

      @if (applying.progress(); as p) {
        @if (p.running || p.finishedAt) {
          <section class="progress" aria-live="polite">
            <div class="progress-head">
              <strong>{{ p.running ? 'Aplicando cambios…' : 'Cambios aplicados' }}</strong>
              <span class="muted">{{ p.done + p.failed }} de {{ p.total }}{{ p.failed ? ' · ' + p.failed + ' con error' : '' }}</span>
            </div>
            <div class="bar" role="progressbar" [attr.aria-valuenow]="applying.percent()" aria-valuemin="0" aria-valuemax="100">
              <span [style.inline-size.%]="applying.percent()"></span>
            </div>
            @if (p.running) {
              <span class="muted">{{ p.current ? p.current + ' · ' : '' }}Sigue en el servidor aunque salgas de esta página.</span>
            }
            @for (e of p.errors; track $index) {
              <span class="error">{{ e }}</span>
            }
          </section>
        }
      }

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
  styles: `
    .progress { display: grid; gap: var(--space-1); padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .progress-head { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: baseline; justify-content: space-between; }
    .bar { block-size: 0.5rem; overflow: hidden; border-radius: 999px; background: var(--color-surface-muted); }
    .bar span { display: block; block-size: 100%; background: var(--color-primary); transition: inline-size var(--duration-base) ease; }
    .muted { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); }
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
  protected readonly applying = inject(StagedApplyStore);
  protected readonly busy = signal<string | null>(null);

  constructor() {
    void this.load();
    // A run started earlier (here or before leaving the page) is shown again; its end reloads the list
    void this.applying.refresh();
    const stop = this.applying.onFinished(() => void this.load());
    inject(DestroyRef).onDestroy(stop);
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
    this.fb.clear();
    try {
      await this.applying.start();
    } catch (e) {
      this.fb.fail(e, 'No se pudieron aplicar los cambios');
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
