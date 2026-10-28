import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, booleanAttribute, effect, inject, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../primitives/button/button.component';
import { IconComponent } from '../../primitives/icon/icon.component';

/**
 * A choice that rises from the bottom of the screen (open it with ModalService.sheet). The arrow lowers it to
 * look at what is behind; while lowered nothing can be done, neither in the sheet nor behind it.
 *
 * <eras-sheet title="Elige el objetivo" (closed)="ref.close()">
 *   ...body...
 *   <ng-container sheet-footer> ...buttons... </ng-container>
 * </eras-sheet>
 */
@Component({
  selector: 'eras-sheet',
  imports: [ButtonComponent, IconComponent],
  template: `
    <header class="header">
      <button
        type="button"
        class="toggle"
        [attr.aria-label]="collapsed() ? 'Volver a la elección' : 'Bajar para ver la mesa'"
        [attr.aria-expanded]="!collapsed()"
        (click)="collapsed.set(!collapsed())"
      >
        <eras-icon [name]="collapsed() ? 'chevron-up' : 'chevron-down'" />
      </button>
      <div class="heading">
        <h2 class="title">{{ title() }}</h2>
        @if (subtitle() && !collapsed()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
      </div>
      @if (closable() && !collapsed()) {
        <button erasButton variant="ghost" size="sm" type="button" aria-label="Cerrar" (click)="closed.emit()">
          <eras-icon name="x" />
        </button>
      }
    </header>
    <div class="content" [inert]="collapsed()">
      <div class="body"><ng-content /></div>
      <footer class="footer"><ng-content select="[sheet-footer]" /></footer>
    </div>
  `,
  styleUrl: './sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"size-" + size()', '[class.collapsed]': 'collapsed()' },
})
export class SheetComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Width: md, lg or xl, as the modal. */
  readonly size = input<'md' | 'lg' | 'xl'>('lg');
  /** False for choices that must be answered (open it with disableClose too). */
  readonly closable = input(true, { transform: booleanAttribute });
  readonly closed = output<void>();
  /** Lowered to look at the board. */
  protected readonly collapsed = signal(false);

  private readonly ref = inject(DialogRef, { optional: true });

  constructor() {
    // Lowered, the backdrop turns clear: the board can be seen but not used
    effect(() => this.ref?.overlayRef.backdropElement?.classList.toggle('collapsed', this.collapsed()));
  }
}
