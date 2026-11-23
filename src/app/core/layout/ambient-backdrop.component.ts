import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MOTE_GONE, Mote, ORBIT_SQUASH, moteCount, moteOpacity, spawnMote, stepMote } from './ambient-dust';

/** Where the vortex's eye sits on the screen (fractions of its width and height): right, left, or the middle. */
const EYE = { end: { x: 0.8, y: 0.55 }, start: { x: 0.22, y: 0.6 }, centre: { x: 0.5, y: 0.5 } } as const;
export type AmbientEye = keyof typeof EYE;

/**
 * Behind every screen: the card back's vortex, huge and faint, turning very slowly, and gem dust (gold pentagons,
 * blue motes) falling in a spiral into its eye. `eye` puts that eye on the right (`end`, behind a page's content) or
 * on the left (`start`: the hub screens, whose artwork fills the right and fades into it). While a game is on (the
 * table sets `body.eras-in-game`) it turns behind the table, its eye in the middle, only in the arcane style
 * (`body.eras-arcane`, the default; the clean one has its own background), and without a background of its own, so
 * the glow of who acts (on the body) still shows. Hidden and stopped with `active` false. Still when the device asks
 * for reduced motion; paused while the page is hidden.
 */
@Component({
  selector: 'eras-ambient-backdrop',
  template: `
    <div class="vortex"></div>
    <canvas #dust></canvas>
    <div class="vignette"></div>
  `,
  styles: `
    // Behind the page's content (which has no background of its own), over the body's color
    :host {
      --eye-x: 80%;
      --eye-y: 55%;

      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      background: radial-gradient(80% 70% at var(--eye-x) var(--eye-y), var(--color-ambient-glow), var(--color-bg) 70%);
    }
    :host(.eye-start) {
      --eye-x: 22%;
      --eye-y: 60%;
    }
    :host(.eye-centre) {
      --eye-x: 50%;
      --eye-y: 50%;
    }
    :host(.at-table) {
      background: none;
    }
    :host(.off) {
      display: none;
    }
    .vortex {
      position: absolute;
      inset-block-start: var(--eye-y);
      inset-inline-start: var(--eye-x);
      inline-size: 130vmax;
      aspect-ratio: 1;
      translate: -50% -50%;
      background: url('/images/vortex.webp') center / contain no-repeat;
      opacity: var(--color-ambient-vortex-opacity);
      animation: ambient-turn 300s linear infinite;
    }
    canvas {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 100% at 30% 40%, transparent 50%, color-mix(in srgb, var(--color-bg) 70%, transparent));
    }
    @keyframes ambient-turn {
      to {
        rotate: -360deg;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .vortex {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.off]': '!shown()',
    '[class.at-table]': 'inGame()',
    '[class.eye-start]': "eyeAt() === 'start'",
    '[class.eye-centre]': "eyeAt() === 'centre'",
  },
})
export class AmbientBackdropComponent {
  /** False where the screen covers it or has its own world (the game's table): hidden and stopped. */
  readonly active = input(true, { transform: booleanAttribute });
  /** Where its eye sits: on the right (`end`) or on the left (`start`). */
  readonly eye = input<AmbientEye>('end');

  /** A game's table is up, and in the arcane style (both marked on the body by the table). */
  protected readonly inGame = signal(false);
  private readonly arcane = signal(false);
  protected readonly shown = computed(() => this.active() && (!this.inGame() || this.arcane()));
  /** At the table the eye sits in the middle, under the field. */
  protected readonly eyeAt = computed<AmbientEye>(() => (this.inGame() ? 'centre' : this.eye()));

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('dust');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    let start: (() => void) | undefined;
    let stop: (() => void) | undefined;
    let place: (() => void) | undefined;

    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const styles = getComputedStyle(host);
      const dustColor = styles.getPropertyValue('--color-ambient-dust').trim() || 'gold';
      const moteColor = styles.getPropertyValue('--color-ambient-mote').trim() || 'skyblue';

      let width = 0;
      let height = 0;
      let cx = 0;
      let cy = 0;
      let maxRadius = 0;
      let motes: Mote[] = [];
      let frame = 0;
      let last = 0;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        const eye = EYE[this.eyeAt()];
        cx = width * eye.x;
        cy = height * eye.y;
        maxRadius = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        motes = Array.from({ length: moteCount(width, height) }, () => spawnMote(maxRadius, true));
        if (still) draw();
      };

      const pentagon = (x: number, y: number, size: number, rotation: number) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const t = rotation + (i * 2 * Math.PI) / 5;
          ctx.lineTo(x + Math.sin(t) * size, y - Math.cos(t) * size);
        }
        ctx.closePath();
      };

      const draw = () => {
        ctx.clearRect(0, 0, width, height);
        for (const mote of motes) {
          if (mote.radius < MOTE_GONE) continue;
          const x = cx + Math.cos(mote.angle) * mote.radius;
          const y = cy + Math.sin(mote.angle) * mote.radius * ORBIT_SQUASH;
          ctx.globalAlpha = moteOpacity(mote);
          if (mote.gem) {
            pentagon(x, y, mote.size, mote.spin);
            ctx.fillStyle = dustColor;
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(x, y, mote.size, 0, Math.PI * 2);
            ctx.fillStyle = moteColor;
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      };

      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        for (let i = 0; i < motes.length; i++) {
          if (!stepMote(motes[i], dt)) motes[i] = spawnMote(maxRadius, false);
        }
        draw();
        frame = requestAnimationFrame(tick);
      };

      start = () => {
        if (still || frame || document.hidden) return;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      };
      stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
      };
      const visibility = () => (document.hidden || !this.shown() ? stop?.() : start?.());

      place = resize;
      resize();
      if (this.shown()) start();
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', visibility);
      const body = document.body;
      const readBody = () => {
        this.inGame.set(body.classList.contains('eras-in-game'));
        this.arcane.set(body.classList.contains('eras-arcane'));
      };
      const watchGame = new MutationObserver(readBody);
      watchGame.observe(body, { attributes: true, attributeFilter: ['class'] });
      readBody();
      destroyRef.onDestroy(() => {
        watchGame.disconnect();
        stop?.();
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', visibility);
      });
    });

    // Stopped where it does not show
    effect(() => (this.shown() ? start?.() : stop?.()));
    // The eye moves (hub ↔ page): the dust starts over around it
    effect(() => {
      this.eyeAt();
      place?.();
    });
  }
}
