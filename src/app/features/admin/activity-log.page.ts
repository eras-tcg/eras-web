import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ACTIVITY_ACTIONS, actionLabel, actionsOf, dayRange, dayValue, describeActivity } from '@data/activity/activity-rules';
import { ActivityApi } from '@data/activity/activity.api';
import { ActivityEntry } from '@data/activity/activity.model';
import { TableComponent } from '@ui/data/table/table.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { MultiselectComponent } from '@ui/forms/multiselect/multiselect.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { feedbackState } from './admin-feedback';

const PAGE_SIZE = 50;

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
    MultiselectComponent,
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
          <eras-stack [gap]="3">
            <eras-grid minColumn="12rem" [gap]="2">
              <eras-multiselect label="Acciones" [options]="actionOptions" [value]="actions()" (valueChange)="actions.set($event)" />
              <eras-form-field label="Usuario" hint="Parte del nombre">
                <input type="search" [value]="user()" (input)="user.set($any($event.target).value)" />
              </eras-form-field>
              <eras-form-field label="Desde">
                <input type="date" [value]="from()" (input)="from.set($any($event.target).value)" />
              </eras-form-field>
              <eras-form-field label="Hasta">
                <input type="date" [value]="to()" (input)="to.set($any($event.target).value)" />
              </eras-form-field>
            </eras-grid>
            <div class="row">
              <button erasButton type="submit" [loading]="loading()" [disabled]="loading()">Filtrar</button>
              <button erasButton variant="ghost" type="button" (click)="lastDays(0)">Hoy</button>
              <button erasButton variant="ghost" type="button" (click)="lastDays(6)">7 días</button>
              <button erasButton variant="ghost" type="button" (click)="lastDays(29)">30 días</button>
              <button erasButton variant="ghost" type="button" (click)="clear()">Limpiar</button>
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
          <div class="row">
            <button erasButton variant="secondary" type="button" [loading]="loading()" [disabled]="loading()" (click)="more()">Cargar más</button>
          </div>
        }
      }
    </eras-page>
  `,
  styles: `
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .muted {
      color: var(--color-text-muted);
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
  protected readonly actionOptions = ACTIVITY_ACTIONS.map((a) => a.label);

  protected readonly actions = signal<string[]>([]);
  protected readonly user = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');

  protected readonly items = signal<ActivityEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  private page = 0;

  protected readonly summary = computed(() =>
    this.total() === 1 ? '1 evento' : `${this.items().length} de ${this.total()} eventos`,
  );

  protected readonly label = actionLabel;
  protected readonly describe = describeActivity;

  constructor() {
    this.lastDays(6);
  }

  /** The last `days` days and today. */
  protected lastDays(days: number): void {
    const start = new Date();
    start.setDate(start.getDate() - days);
    this.from.set(dayValue(start));
    this.to.set(dayValue(new Date()));
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
        this.api.search({ actions: actionsOf(this.actions()), user: this.user(), ...range, page: this.page, size: PAGE_SIZE }),
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
