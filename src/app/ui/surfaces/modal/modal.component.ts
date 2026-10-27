import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../primitives/button/button.component';
import { IconComponent } from '../../primitives/icon/icon.component';

/**
 * Visual frame of a dialog (header, body, footer). Opening/closing and focus
 * handling come from ModalService (Angular CDK Dialog).
 *
 * <eras-modal title="Simular apertura" (closed)="ref.close()">
 *   ...body...
 *   <ng-container modal-footer> ...buttons... </ng-container>
 * </eras-modal>
 */
@Component({
  selector: 'eras-modal',
  imports: [ButtonComponent, IconComponent],
  template: `
    <header class="header">
      <div>
        <h2 class="title">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
      </div>
      <button erasButton variant="ghost" size="sm" type="button" aria-label="Cerrar" (click)="closed.emit()">
        <eras-icon name="x" />
      </button>
    </header>
    <div class="body"><ng-content /></div>
    <footer class="footer"><ng-content select="[modal-footer]" /></footer>
  `,
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly closed = output<void>();
}
