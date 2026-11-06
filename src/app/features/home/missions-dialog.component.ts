import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { MissionsBoardComponent } from './missions-board.component';

/**
 * The missions over any screen that is not a hub menu (the quick button «Misiones»), so the player does not lose
 * where they were. It closes by itself when a step's «Ir» (or the structure deck opening) goes to another screen.
 */
@Component({
  selector: 'eras-missions-dialog',
  imports: [ModalComponent, MissionsBoardComponent],
  template: `
    <eras-modal title="Misiones" size="lg" (closed)="ref.close()">
      <eras-missions-board />
    </eras-modal>
  `,
  styles: `
    eras-modal {
      block-size: min(44rem, calc(100vh - 2 * var(--space-6)));
    }
    eras-missions-board {
      flex: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionsDialogComponent {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);

  constructor() {
    const sub = inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.ref.close();
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }
}
