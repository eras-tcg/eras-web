import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FrameHalves, FrameNotches, frameHalves } from './card-back-frame-shape';

let nextFrameId = 0;
/** The page (its path) whose first frame already traced itself: the next ones there show already built. */
let tracedOn: string | null = null;

/** True the first time a frame appears on the page at `path` (it traces itself), false after that. */
export function firstFrameOn(path: string): boolean {
  if (tracedOn === path) return false;
  tracedOn = path;
  return true;
}

/**
 * The card back's own frame behind a dialog: its surface cut with bevelled corners and a notch at the top and at the
 * bottom, a gold line along that edge with a small gem floating in each notch. The first frame of each page traces
 * its line from the top gem outwards to the bottom one; the next ones on that page appear already built (and none
 * traces at a game's table, where a dialog is just there). Put it first in a
 * positioned, isolated box (the dialog's panel): it fills it, under its content, and follows its size. `notches`:
 * `both` (centered dialogs), `top` (the mulligan) or `none` (a side panel); `openBottom`: it rises from the bottom
 * edge of the screen (a sheet), its sides running straight down with no bottom edge.
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
      @if (notches() !== 'none') {
        <span class="gem top"></span>
      }
      @if (notches() === 'both' && !openBottom()) {
        <span class="gem bottom"></span>
      }
    }
  `,
  styleUrl: './card-back-frame.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.no-top]': "notches() === 'none'",
    '[class.no-bottom]': "notches() !== 'both' || openBottom()",
    '[class.open-bottom]': 'openBottom()',
    '[class.built]': 'built',
  },
})
export class CardBackFrameComponent {
  /** Which edges have a notch with its gem. */
  readonly notches = input<FrameNotches>('both');
  /** Rises from the bottom edge: no bottom edge of its own. */
  readonly openBottom = input(false, { transform: booleanAttribute });

  /** Another frame already traced itself on this page: this one shows built. */
  protected readonly built = typeof location !== 'undefined' && !firstFrameOn(location.pathname);
  private readonly gradientId = `eras-card-back-frame-${nextFrameId++}`;
  protected readonly stroke = `url(#${this.gradientId})`;
  /** The frame follows the box's size; drawn once it is measured, so it traces itself from then on. */
  protected readonly frame = signal<{ width: number; height: number; halves: FrameHalves } | null>(null);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    let measure: (() => void) | undefined;
    // Other notches: the same size, drawn again
    effect(() => {
      this.notches();
      this.openBottom();
      untracked(() => measure?.());
    });
    afterNextRender(() => {
      measure = () => {
        const width = host.offsetWidth;
        const height = host.offsetHeight;
        if (width > 0 && height > 0) this.frame.set({ width, height, halves: frameHalves(width, height, this.notches(), this.openBottom()) });
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
