import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { FrameHalves, frameHalves } from './card-back-frame-shape';

let nextFrameId = 0;

/**
 * The card back's own frame behind a dialog: its surface cut with bevelled corners and a notch at the top and at the
 * bottom, a gold line along that edge with a small gem floating in each notch. As it appears the line traces itself
 * from the top gem outwards to the bottom one (not at a game's table, where a dialog is just there). Put it first in a
 * positioned, isolated box (the dialog's panel): it fills it, under its content, and follows its size.
 * <div class="panel"><eras-card-back-frame /> …content… </div>
 */
@Component({
  selector: 'eras-card-back-frame',
  template: `
    <div class="surface"></div>
    @if (frame(); as f) {
      <svg class="frame" [attr.viewBox]="'0 0 ' + f.width + ' ' + f.height">
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
      <span class="gem top"></span>
      <span class="gem bottom"></span>
    }
  `,
  styleUrl: './card-back-frame.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class CardBackFrameComponent {
  private readonly gradientId = `eras-card-back-frame-${nextFrameId++}`;
  protected readonly stroke = `url(#${this.gradientId})`;
  /** The frame follows the box's size; drawn once it is measured, so it traces itself from then on. */
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
