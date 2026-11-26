import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { roman } from '../game-card/roman';
import { paletteOfImage } from './creature-palette';
import { CutoutPlace, placeOf, sidesAtEdge } from './cutout-place';
import { SummonVortex, summonVortex } from './summon-vortex';

/** How long the creature stays on show (ms) and how long the stage takes to fade away after. */
export const CREATURE_SUMMON_HOLD = 2600;
export const CREATURE_SUMMON_OUT = 450;
/** The whole moment, from the stage lighting up to it gone (the image already loaded). */
export const CREATURE_SUMMON_MS = CREATURE_SUMMON_HOLD + CREATURE_SUMMON_OUT;


/**
 * A full-art summon: the creature cut out of its illustration, big over its own stage (a soft vortex under a breathing
 * aura, shards of light circling it, motes rising), with its name and level below. Lit with the colors of the
 * picture. It plays as soon as it is drawn, in the browser's top layer, and says `done` once it has faded away; the
 * host removes it then. Tapping it ends it early.
 */
@Component({
  selector: 'eras-creature-summon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #stage
      popover="manual"
      type="button"
      class="stage"
      [class.on]="phase() === 'on'"
      [class.off]="phase() === 'off'"
      [style.--c1]="colors()[0]"
      [style.--c2]="colors()[1]"
      [style.--identity]="identity()"
      [style.--pace]="pace()"
      aria-live="assertive"
      [attr.aria-label]="name() + (level() ? ', nivel ' + level() : '') + '. Saltar la animación'"
      (click)="finish()"
    >
      <span class="fx" #fx aria-hidden="true"><canvas #canvas></canvas></span>
      <span class="aura" aria-hidden="true"></span>
      <span class="ground" aria-hidden="true"></span>
      <span class="shock" aria-hidden="true"></span>
      <span class="motes" #motes aria-hidden="true"></span>
      <span
        class="creature"
        [style.--fade-left]="edges().left ? fade : '0%'"
        [style.--fade-right]="edges().right ? fade : '0%'"
        [style.--fade-top]="edges().top ? fade : '0%'"
        [style.--fade-bottom]="edges().bottom ? fade : '0%'"
        ><img #picture [src]="creature()" alt="" (load)="loaded()" (error)="finish()"
      /></span>
      <!-- Its name across a band of light, as the turn's phases are shown; its level on a gold medal under it -->
      <span class="plate">
        <span class="band">
          <span class="name">{{ name() }}</span>
          <span class="sweep" aria-hidden="true"></span>
        </span>
        @if (level(); as lv) {
          <span class="level" aria-hidden="true">{{ romanOf(lv) }}</span>
        }
      </span>
      <span class="flash" aria-hidden="true"></span>
    </button>
  `,
  styleUrl: './creature-summon.component.scss',
})
export class CreatureSummonComponent {
  /** The creature cut out of its illustration (a PNG with transparency). */
  readonly creature = input.required<string>();
  readonly name = input.required<string>();
  /** Its level (shown in roman numerals); null without one. */
  readonly level = input<number | null>(null);
  /** The card's identity color (the band's light). */
  readonly identity = input('#64748b');
  /** How long it may wait for the picture (ms) before giving up (it then just says `done`); null: as long as it takes. */
  readonly patience = input<number | null>(null);
  /** Its speed: every duration times this (1 normal, under 1 faster), as the board's animations. */
  readonly pace = input(1);

  readonly done = output<void>();

  protected readonly romanOf = roman;
  protected readonly phase = signal<'wait' | 'on' | 'off'>('wait');
  protected readonly colors = signal<[string, string]>(['rgb(203 213 225)', 'rgb(148 163 184)']);
  /**
   * The sides where the figure was cut by its picture's edge: they fade out (the creature and its glow), so the card's
   * rectangle never shows. Read from the cut-out's PNG.
   */
  protected readonly edges = signal({ left: false, right: false, top: false, bottom: false });
  /** How much of the creature a cut side takes to fade out. */
  protected readonly fade = '22%';
  private readonly picture = viewChild.required<ElementRef<HTMLImageElement>>('picture');
  private place: CutoutPlace | null = null;

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly fx = viewChild.required<ElementRef<HTMLElement>>('fx');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly motes = viewChild.required<ElementRef<HTMLElement>>('motes');

  private vortex: SummonVortex | null = null;
  private frame = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ready = { image: false, palette: false, place: false };
  private ended = false;

  constructor() {
    afterNextRender(() => {
      const el = this.stage().nativeElement;
      if (!el.matches(':popover-open')) el.showPopover?.();
      const patience = this.patience();
      if (patience !== null) this.timers.push(setTimeout(() => this.phase() === 'wait' && this.end(), patience));
      void paletteOfImage(this.creature()).then((p) => {
        this.colors.set([p.main, p.second]);
        this.ready.palette = true;
        this.start();
      });
      void fetch(this.creature())
        .then((r) => r.arrayBuffer())
        .then((b) => (this.place = placeOf(new Uint8Array(b))))
        .catch(() => null)
        .finally(() => {
          this.ready.place = true;
          this.start();
        });
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected loaded(): void {
    this.ready.image = true;
    this.start();
  }

  /** Ends it now: the stage fades away (or goes at once if it had not begun). */
  protected finish(): void {
    if (this.ended) return;
    if (this.phase() !== 'on') return this.end();
    this.clearTimers();
    this.leave();
  }

  /** Once the creature and its colors are both there. */
  private start(): void {
    if (!this.ready.image || !this.ready.palette || !this.ready.place || this.phase() !== 'wait' || this.ended) return;
    const img = this.picture().nativeElement;
    if (this.place) this.edges.set(sidesAtEdge(this.place, img.naturalWidth, img.naturalHeight));
    this.phase.set('on');
    // The colors reach the shader once they are on the stage
    const [main, second] = this.colors();
    // The vortex opens once the creature is there and closes into its eye before it goes
    const k = this.pace();
    this.vortex = summonVortex(this.canvas().nativeElement, main, second, {
      hold: CREATURE_SUMMON_HOLD * k,
      openAt: 450 * k,
      openFor: 600 * k,
      closeFor: 450 * k,
    });
    const t0 = performance.now();
    const draw = () => {
      this.vortex?.draw(performance.now() - t0);
      this.frame = requestAnimationFrame(draw);
    };
    this.frame = requestAnimationFrame(draw);
    this.shards();
    this.risingMotes();
    this.timers.push(setTimeout(() => this.leave(), CREATURE_SUMMON_HOLD * k));
  }

  private leave(): void {
    this.phase.set('off');
    this.timers.push(setTimeout(() => this.end(), CREATURE_SUMMON_OUT * this.pace()));
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    this.stop();
    this.done.emit();
  }

  private stop(): void {
    this.clearTimers();
    cancelAnimationFrame(this.frame);
    this.vortex?.destroy();
    this.vortex = null;
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Shards of light circling the vortex, drawn slowly in towards its eye, turning in depth. */
  private shards(): void {
    const host = this.fx().nativeElement;
    for (let i = 0; i < 22; i++) {
      const near = Math.random();
      const a0 = Math.random() * Math.PI * 2;
      const r0 = 26 + Math.random() * 20;
      const turn = 0.9 + Math.random() * 0.6;
      const frames = Array.from({ length: 9 }, (_, k) => {
        const t = k / 8;
        const a = a0 + t * turn;
        const r = r0 * (1 - t * 0.35);
        return {
          left: `${50 + Math.cos(a) * r * 0.9}%`,
          top: `${55 + Math.sin(a) * r * 0.55}%`,
          transform: `translate(-50%, -50%) rotate3d(1, 1, 0, ${t * 260}deg) scale(${0.5 + t * 0.4})`,
          opacity: k === 0 || k === 8 ? 0 : 0.35 + near * 0.6,
        };
      });
      const shard = document.createElement('i');
      shard.className = 'shard';
      shard.style.setProperty('--w', `${1.2 + near * 2.6}vmin`);
      shard.style.filter = `blur(${(1 - near) * 2}px) drop-shadow(0 0 6px var(--c1))`;
      host.append(shard);
      const k = this.pace();
      shard.animate(frames, { duration: (CREATURE_SUMMON_HOLD - 900) * k, delay: (450 + Math.random() * 300) * k, easing: 'linear', fill: 'both' });
    }
  }

  /** Motes of light rising round the creature while it is on show. */
  private risingMotes(): void {
    const host = this.motes().nativeElement;
    for (let i = 0; i < 55; i++) {
      const mote = document.createElement('i');
      mote.className = 'mote';
      mote.style.left = `${25 + Math.random() * 50}%`;
      mote.style.top = `${40 + Math.random() * 50}%`;
      host.append(mote);
      mote.animate(
        [
          { opacity: 0, transform: 'translateY(0)' },
          { opacity: 1, offset: 0.2 },
          { opacity: 0, transform: `translateY(${-60 - Math.random() * 160}px)` },
        ],
        {
          duration: (1300 + Math.random() * 1000) * this.pace(),
          delay: (350 + Math.random() * CREATURE_SUMMON_HOLD * 0.7) * this.pace(),
          easing: 'ease-out',
          fill: 'backwards',
        },
      );
    }
  }
}
