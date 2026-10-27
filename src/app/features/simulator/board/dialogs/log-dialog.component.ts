import { DatePipe } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** Full action history of the room (kept by the server, newest first). */
@Component({
  selector: 'eras-log-dialog',
  imports: [ModalComponent, EmptyStateComponent, DatePipe],
  template: `
    <eras-modal title="Historial de la partida" [subtitle]="lines().length + ' acciones'" (closed)="ref.close()">
      @if (lines().length === 0) {
        <eras-empty-state title="Todavía no hay acciones" />
      } @else {
        <ol class="log">
          @for (line of lines(); track line.id) {
            <li><time>{{ line.ts | date: 'HH:mm:ss' }}</time> {{ line.text }}</li>
          }
        </ol>
      }
    </eras-modal>
  `,
  styles: `
    .log { display: flex; flex-direction: column; gap: var(--space-1); max-block-size: 60vh; overflow: auto; margin: 0; padding: 0; list-style: none; font-size: var(--font-size-sm); }
    time { color: var(--color-text-muted); font-variant-numeric: tabular-nums; margin-inline-end: var(--space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogDialogComponent {
  protected readonly ref = inject(DialogRef);
  private readonly game = inject(GameStore);
  protected readonly lines = computed(() => [...this.game.log()].reverse());
}
