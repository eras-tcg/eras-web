import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, booleanAttribute, effect, inject, input, output, signal, DestroyRef, ElementRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ButtonComponent } from '../../primitives/button/button.component';
import { SheetState } from './sheet-state';
import { IconComponent } from '../../primitives/icon/icon.component';

/**
 * A choice that rises from the bottom of the screen (open it with ModalService.sheet). The arrow lowers it to
 * look at what is behind: the page can then be browsed (SheetState.lowered) but its actions are blocked.
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
  host: { '[class]': '"size-" + size()', '[class.collapsed]': 'collapsed()', '[class.see-through]': 'state.seeThrough()' },
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
  protected readonly state = inject(SheetState);

  constructor() {
    // Lowered, the backdrop lets the page through: it can be looked at, and the page blocks its own actions
    effect(() => {
      const backdrop = this.ref?.overlayRef.backdropElement;
      backdrop?.classList.toggle('collapsed', this.collapsed());
      if (backdrop) backdrop.style.pointerEvents = this.collapsed() ? 'none' : '';
      // The lowered sheet only takes clicks on its header (the arrow): the rest of the page can be used to look
      const pane = this.ref?.overlayRef.overlayElement;
      if (pane) pane.style.pointerEvents = this.collapsed() ? 'none' : '';
      this.state.lowered.set(this.collapsed());
    });
    // Seen through: its backdrop does not darken the page either
    effect(() => {
      const backdrop = this.ref?.overlayRef.backdropElement;
      if (backdrop) backdrop.style.opacity = this.state.seeThrough() ? '0' : '';
    });
    this.state.open.update((n) => n + 1);
    // How much of the screen it takes from the bottom (--sheet-height): what floats above it keeps clear of it
    const root = inject(DOCUMENT).documentElement;
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const measure = () => {
      const top = host.getBoundingClientRect().top;
      root.style.setProperty('--sheet-height', `${Math.max(0, window.innerHeight - top)}px`);
    };
    const resize = new ResizeObserver(measure);
    resize.observe(host);
    host.addEventListener('transitionend', measure);
    inject(DestroyRef).onDestroy(() => {
      resize.disconnect();
      if (this.state.open() <= 1) root.style.removeProperty('--sheet-height');
      this.state.open.update((n) => Math.max(0, n - 1));
      this.state.lowered.set(false);
      this.state.seeThrough.set(false);
    });
  }
}
