import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ACTIVITY_GROUPS, actionLabel, dayRange, dayValue, describeActivity } from '@data/activity/activity-rules';
import { ActivityApi } from '@data/activity/activity.api';
import { ActivityAction, ActivityEntry } from '@data/activity/activity.model';
import { TableComponent } from '@ui/data/table/table.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { feedbackState } from './admin-feedback';

const PAGE_SIZE = 50;

/** Quick periods: today and the days before it. */
const PERIODS: (ToggleOption & { days: number })[] = [
  { value: '0', label: 'Hoy', days: 0 },
  { value: '6', label: '7 días', days: 6 },
  { value: '29', label: '30 días', days: 29 },
];

/** What the players do on the site (manage_users): logins, purchases, decks and games, filtered by action, player and dates. */
@Component({
  selector: 'eras-activity-log-page',
  imports: [
    DatePipe,
    PageComponent,
    GridComponent,
    StackComponent,
    CardComponent,
    FormFieldComponent,
    ToggleGroupComponent,
    TableComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    SpinnerComponent,
  ],
  template: `
    <eras-page title="Registro de actividad" subtitle="Ingresos, compras, mazos y partidas de los jugadores" width="wide">
      <ng-container ngProjectAs="[page-actions]">
        <button erasButton variant="secondary" type="button" [disabled]="loading()" (click)="search()">Recargar</button>
      </ng-container>

      @if (fb.feedback(); as f) {
        <eras-alert [tone]="f.tone">{{ f.text }}</eras-alert>
      }

      <eras-card>
        <form (submit)="$event.preventDefault(); search()">
          <eras-stack [gap]="4">
            <eras-grid minColumn="11rem" [gap]="3">
              <eras-form-field label="Usuario">
                <input type="search" placeholder="Parte del nombre" [value]="user()" (input)="user.set($any($event.target).value)" />
              </eras-form-field>
              <eras-form-field label="Desde">
                <input type="date" [value]="from()" (change)="from.set($any($event.target).value); search()" />
              </eras-form-field>
              <eras-form-field label="Hasta">
                <input type="date" [value]="to()" (change)="to.set($any($event.target).value); search()" />
              </eras-form-field>
              <eras-toggle-group label="Periodo" [options]="periods" [selected]="period()" (toggled)="choosePeriod($event)" />
            </eras-grid>

            <div class="actions-filter">
              <div class="actions-head">
                <span class="title">Acciones</span>
                <span class="hint">{{ actions().length === 0 ? 'Todas' : actions().length === 1 ? '1 elegida' : actions().length + ' elegidas' }}</span>
              </div>
              <div class="action-groups">
                @for (group of groups; track group.name) {
                  <eras-toggle-group [label]="group.name" [options]="group.options" [selected]="actions()" (toggled)="toggleAction($any($event))" />
                }
              </div>
            </div>

            <div class="buttons">
              <button erasButton variant="ghost" type="button" (click)="clear()">Limpiar filtros</button>
              <button erasButton type="submit" [loading]="loading()" [disabled]="loading()">Filtrar</button>
            </div>
          </eras-stack>
        </form>
      </eras-card>

      @if (loading() && items().length === 0) {
        <eras-empty-state title="Cargando…"><eras-spinner /></eras-empty-state>
      } @else if (items().length === 0) {
        <eras-empty-state title="Sin actividad para esos filtros" />
      } @else {
        <p class="muted">{{ summary() }}</p>
        <eras-table>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              @for (e of items(); track e.id) {
                <tr>
                  <td class="nowrap">{{ e.at | date: 'dd-MM-yyyy HH:mm' }}</td>
                  <td>
                    @if (e.username) {
                      <button type="button" class="user" title="Ver solo este usuario" (click)="onlyUser(e.username)">{{ e.username }}</button>
                    } @else {
                      <span class="muted">Cuenta borrada</span>
                    }
                  </td>
                  <td>{{ label(e.action) }}</td>
                  <td>{{ describe(e) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </eras-table>
        @if (items().length < total()) {
          <div class="more">
            <button erasButton variant="secondary" type="button" [loading]="loading()" [disabled]="loading()" (click)="more()">Cargar más</button>
          </div>
        }
      }
    </eras-page>
  `,
  styles: `
    .actions-filter {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding-block-start: var(--space-4);
      border-block-start: var(--border-width) solid var(--color-border);
    }
    .actions-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .action-groups {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3) var(--space-4);
    }
    .action-groups > * {
      flex: 1 1 auto;
    }
    .title {
      font-weight: var(--font-weight-bold);
    }
    .hint,
    .muted {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .buttons {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-2);
    }
    .more {
      display: flex;
      justify-content: center;
    }
    .nowrap {
      white-space: nowrap;
    }
    .user {
      padding: 0;
      border: 0;
      background: none;
      color: var(--color-link);
      font: inherit;
      cursor: pointer;
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityLogPage {
  private readonly api = inject(ActivityApi);

  protected readonly fb = feedbackState();
  protected readonly groups = ACTIVITY_GROUPS;
  protected readonly periods: ToggleOption[] = PERIODS;

  protected readonly actions = signal<ActivityAction[]>([]);
  protected readonly user = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');

  protected readonly items = signal<ActivityEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  private page = 0;

  /** The quick period the dates match, if any. */
  protected readonly period = computed(() => {
    const today = dayValue(new Date());
    const match = PERIODS.find((p) => this.to() === today && this.from() === dayValue(daysAgo(p.days)));
    return match ? [match.value] : [];
  });

  protected readonly summary = computed(() =>
    this.total() === 1 ? '1 evento' : `${this.items().length} de ${this.total()} eventos`,
  );

  protected readonly label = actionLabel;
  protected readonly describe = describeActivity;

  constructor() {
    this.choosePeriod('6');
  }

  protected choosePeriod(value: string): void {
    const days = PERIODS.find((p) => p.value === value)?.days ?? 6;
    this.from.set(dayValue(daysAgo(days)));
    this.to.set(dayValue(new Date()));
    void this.search();
  }

  protected toggleAction(action: ActivityAction): void {
    this.actions.update((list) => (list.includes(action) ? list.filter((a) => a !== action) : [...list, action]));
    void this.search();
  }

  protected onlyUser(username: string): void {
    this.user.set(username);
    void this.search();
  }

  protected clear(): void {
    this.actions.set([]);
    this.user.set('');
    this.from.set('');
    this.to.set('');
    void this.search();
  }

  protected search(): Promise<void> {
    this.page = 0;
    return this.load(false);
  }

  protected more(): Promise<void> {
    this.page++;
    return this.load(true);
  }

  private async load(append: boolean): Promise<void> {
    this.loading.set(true);
    this.fb.clear();
    try {
      const range = dayRange(this.from(), this.to());
      const result = await firstValueFrom(
        this.api.search({ actions: this.actions(), user: this.user(), ...range, page: this.page, size: PAGE_SIZE }),
      );
      this.items.set(append ? [...this.items(), ...result.items] : result.items);
      this.total.set(result.total);
    } catch (e) {
      this.fb.fail(e, 'No se pudo cargar el registro de actividad');
    } finally {
      this.loading.set(false);
    }
  }
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
