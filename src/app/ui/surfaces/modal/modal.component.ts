import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SweepIconComponent } from '../../primitives/sweep-icon/sweep-icon.component';
import { FrameHalves, frameHalves } from './modal-frame';

let nextFrameId = 0;

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
  imports: [SweepIconComponent],
  template: `
    <div class="panel" aria-hidden="true"></div>
    @if (frame(); as f) {
      <svg class="frame" aria-hidden="true" [attr.viewBox]="'0 0 ' + f.width + ' ' + f.height">
        <defs>
          <linearGradient [attr.id]="gradientId" gradientUnits="userSpaceOnUse" x1="0" y1="0" [attr.x2]="f.width" [attr.y2]="f.height">
            <stop class="stop-gold" offset="0" />
            <stop class="stop-pale" offset="0.45" />
            <stop class="stop-deep" offset="0.55" />
            <stop class="stop-gold" offset="1" />
          </linearGradient>
        </defs>
        <path pathLength="1" [attr.d]="f.halves.right" [attr.stroke]="stroke" />
        <path pathLength="1" [attr.d]="f.halves.left" [attr.stroke]="stroke" />
      </svg>
      <span class="gem top" aria-hidden="true"></span>
      <span class="gem bottom" aria-hidden="true"></span>
    }
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

  private readonly gradientId = `eras-modal-frame-${nextFrameId++}`;
  protected readonly stroke = `url(#${this.gradientId})`;
  /** The frame follows the dialog's size; drawn once it is measured, so it traces itself from then on. */
  protected readonly frame = signal<{ width: number; height: number; halves: FrameHalves } | null>(null);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => {
        const width = host.offsetWidth;
        const height = host.offsetHeight;
        if (width > 0 && height > 0) this.frame.set({ width, height, halves: frameHalves(width, height) });
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
