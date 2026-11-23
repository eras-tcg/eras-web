import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { ButtonComponent } from '../../primitives/button/button.component';
import { IconComponent } from '../../primitives/icon/icon.component';

/**
 * The frame of a dialog that shows one thing of a list in detail (a card, a card back): one size whatever it shows, the
 * largest the screen allows up to a limit, a panel with a close button and the content, and big round arrows on its
 * sides (← and → too) to move through the list. The content fills the panel (eras-card-detail `fill`).
 */
@Component({
  selector: 'eras-detail-frame',
  imports: [ButtonComponent, IconComponent],
  template: `
    @if (navigable()) {
      <button erasButton variant="secondary" type="button" class="nav prev" [attr.aria-label]="previousLabel()" [disabled]="!hasPrevious()" (click)="previous.emit()">
        <eras-icon name="chevron-left" />
      </button>
    } @else {
      <span></span>
    }

    <div class="panel" role="document">
      <button erasButton variant="ghost" size="sm" type="button" class="close" aria-label="Cerrar" (click)="closed.emit()">
        <eras-icon name="x" />
      </button>
      <ng-content />
    </div>

    @if (navigable()) {
      <button erasButton variant="secondary" type="button" class="nav next" [attr.aria-label]="nextLabel()" [disabled]="!hasNext()" (click)="next.emit()">
        <eras-icon name="chevron-right" />
      </button>
    }
  `,
  styleUrl: './detail-frame.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
})
export class DetailFrameComponent {
  /** More than one thing to show: the arrows. */
  readonly navigable = input(false, { transform: booleanAttribute });
  readonly hasPrevious = input(false);
  readonly hasNext = input(false);
  readonly previousLabel = input('Anterior');
  readonly nextLabel = input('Siguiente');

  readonly previous = output<void>();
  readonly next = output<void>();
  readonly closed = output<void>();

  protected onKey(event: KeyboardEvent): void {
    if (!this.navigable()) return;
    // Leave arrows alone while typing in a field
    if (event.target instanceof Element && event.target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowLeft' && this.hasPrevious()) this.previous.emit();
    if (event.key === 'ArrowRight' && this.hasNext()) this.next.emit();
  }
}
