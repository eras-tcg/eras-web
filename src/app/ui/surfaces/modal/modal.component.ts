import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { SweepIconComponent } from '../../primitives/sweep-icon/sweep-icon.component';
import { CardBackFrameComponent } from '../card-back-frame/card-back-frame.component';

/**
 * Visual frame of a dialog (header, body, footer), in the card back's own frame: bevelled corners, a notch at the
 * top and at the bottom with a small gold gem, and a gold line that traces itself from the top gem outwards as the
 * dialog opens. Opening/closing and focus handling come from ModalService (Angular CDK Dialog).
 *
 * <eras-modal title="Simular apertura" (closed)="ref.close()">
 *   ...body...
 *   <ng-container modal-footer> ...buttons... </ng-container>
 * </eras-modal>
 */
@Component({
  selector: 'eras-modal',
  imports: [SweepIconComponent, CardBackFrameComponent],
  template: `
    <eras-card-back-frame />
    <header class="header">
      <div class="heading">
        <h2 class="title">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
      </div>
      @if (closable()) {
        <button erasSweep="x" class="close" type="button" aria-label="Cerrar" (click)="closed.emit()"></button>
      }
    </header>
    <div class="body"><ng-content /></div>
    <footer class="footer"><ng-content select="[modal-footer]" /></footer>
  `,
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `title` is an input: without this, a static title="…" also stays on the host as the browser's tooltip
  host: { '[attr.title]': 'null', '[class]': '"size-" + size()' },
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Width: md (forms, confirmations), lg and xl (big forms, tables), full (as wide as the screen allows). */
  readonly size = input<'md' | 'lg' | 'xl' | 'full'>('md');
  /** False for choices that must be answered (open the dialog with disableClose too). */
  readonly closable = input(true, { transform: booleanAttribute });
  readonly closed = output<void>();
}
