import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, viewChild } from '@angular/core';
import { PackTier } from '@data/editions/booster-rules';
import { BREAK_DETAIL } from './pack-break-detail';
import { IMPACT, PACK_W, PACK_H, Point, crackStages, shatter } from './pack-break-geometry';

/** The moment it shatters, as a fraction of the break: three blows before it, then a freeze (the same as `--boom` in CSS). */
export const BOOM_AT = 0.72;

interface Shard {
  /** Its outline around its own middle, in px. */
  points: Point[];
  /** Its middle in the pack, in px (to place the artwork on it). */
  home: Point;
  /** Where it is on the canvas and its speed, in px and px/s. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Its turn in the plane and around its own axis (radians), and their speeds. */
  rot: number;
  vrot: number;
  flip: number;
  vflip: number;
  life: number;
  /** Its foil edge's color. */
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  age: number;
  ttl: number;
  color: string;
  /** debris: a fleck of foil that glints as it turns; spark: a streak of light. */
  kind: 'debris' | 'spark';
}

/** A color as the CSS resolves it on `element` (a variable holding var() or color-mix(), which a canvas cannot read). */
function colorOf(element: HTMLElement, variable: string): string {
  element.style.color = `var(${variable})`;
  const color = getComputedStyle(element).color;
  element.style.removeProperty('color');
  // A mixed color comes back as color(srgb r g b [/ a]), 0..1: as rgb(), which every canvas reads
  const srgb = color.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/);
  if (!srgb) return color;
  const [r, g, b] = srgb.slice(1, 4).map((v) => Math.round(Number(v) * 255));
  return `rgba(${r}, ${g}, ${b}, ${srgb[4] ?? 1})`;
}

/** The url inside a CSS `url(...)` value. */
function urlOf(css: string | null): string | null {
  const match = css?.match(/url\(\s*['"]?(.*?)['"]?\s*\)/);
  return match ? match[1] : null;
}

/**
 * A pack breaking open, in `duration` ms. Three blows, each a jolt and a new stage of cracks (drawn anew for every
 * pack) with light leaking through them; then it swells, glowing from inside, freezes an instant and shatters: a
 * flash, a shock wave and a jolt of the whole break, irregular shards with a foil edge that tumble and fall, flecks
 * of foil that glint as they drift down, and streaks of light. The same timing for every pack, but how much it shows
 * goes with its type (`tier`, BREAK_DETAIL): a plain pack breaks simply (a few straight cracks, no rays, no wave, few
 * pieces), a GOD one beyond the SEC one (more of everything, a second wave). The blows and the light are CSS; the
 * burst is drawn on a canvas.
 */
@Component({
  selector: 'eras-pack-break',
  templateUrl: './pack-break.component.html',
  styleUrl: './pack-break.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--art]': 'art()',
    '[style.--break]': 'duration() + "ms"',
    '[class]': '"tier-" + tier()',
    'aria-hidden': 'true',
    // The shatter starts with the canvas' marker animation (its delay is --boom), so it never runs ahead of the blows
    '(animationstart)': 'onAnimationStart($event)',
  },
})
export class PackBreakComponent {
  readonly art = input<string | null>(null);
  readonly duration = input(3200);
  /** The pack's type: how much the break shows. */
  readonly tier = input<PackTier>('none');

  private readonly detail = computed(() => BREAK_DETAIL[this.tier()]);
  /** The cracks of each blow, in pack units. */
  protected readonly cracks = computed(() => crackStages(Math.random, this.detail().cracks, this.detail().branches));
  protected readonly viewBox = `0 0 ${PACK_W} ${PACK_H}`;
  /** Where the blows land, in % of the pack (for the light and the wave). */
  protected readonly impact = { x: (IMPACT.x / PACK_W) * 100, y: (IMPACT.y / PACK_H) * 100 };

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('burst');
  private frame = 0;
  private bursting = false;
  /** The artwork, loaded ahead for the shards. */
  private readonly image = new Image();

  constructor() {
    afterNextRender(() => {
      const url = urlOf(this.art());
      if (url) this.image.src = url;
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  protected onAnimationStart(event: AnimationEvent): void {
    if (event.target !== this.canvas().nativeElement || !event.animationName.endsWith('boom-mark') || this.bursting) return;
    this.bursting = true;
    this.burst(this.image);
  }

  /** The shatter, drawn on the canvas until every piece is gone. */
  private burst(image: HTMLImageElement): void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    ctx.scale(dpr, dpr);

    const pack = this.host.nativeElement.getBoundingClientRect();
    const packW = pack.width;
    const packH = pack.height;
    const unit = packW / PACK_W;
    // The pack's top-left corner on the canvas
    const ox = pack.left - box.left;
    const oy = pack.top - box.top;
    const impact = { x: ox + IMPACT.x * unit, y: oy + IMPACT.y * unit };
    // The pack's colors, as the CSS resolves them (--edge, --light: by its type)
    const accent = colorOf(canvas, '--edge');
    const glow = colorOf(canvas, '--light');
    const light = colorOf(canvas, '--color-hub-text');
    // A GOD pack's pieces shine in every color
    const palette = this.tier() === 'god' ? ['--color-rarity-sec', '--color-rarity-sr', '--color-hub-glow', '--color-rarity-r', '--color-rarity-uc'].map((v) => colorOf(canvas, v)) : [accent];
    const pick = () => palette[Math.floor(Math.random() * palette.length)];

    const detail = this.detail();
    const shards: Shard[] = shatter(Math.random, detail.shards).map((s) => {
      const home = { x: s.center.x * unit, y: s.center.y * unit };
      const x = ox + home.x;
      const y = oy + home.y;
      const away = Math.atan2(y - impact.y, x - impact.x) + (Math.random() - 0.5) * 0.5;
      const speed = (1.1 + Math.random() * 1.6) * packW;
      return {
        points: s.points.map((p) => ({ x: (p.x - s.center.x) * unit, y: (p.y - s.center.y) * unit })),
        home,
        x,
        y,
        vx: Math.cos(away) * speed,
        vy: Math.sin(away) * speed - packW * 0.9,
        rot: 0,
        vrot: (Math.random() - 0.5) * 9,
        flip: 0,
        vflip: (2 + Math.random() * 5) * (Math.random() < 0.5 ? -1 : 1),
        life: 1,
        color: pick(),
      };
    });
    const debris = Array.from({ length: detail.debris }, (): Particle => {
      const a = Math.random() * Math.PI * 2;
      const speed = (0.4 + Math.random() * 2.2) * packW;
      return { x: impact.x, y: impact.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - packW * 0.6, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 16, size: 1.5 + Math.random() * 3.5, age: 0, ttl: 1.1 + Math.random() * 0.9, kind: 'debris', color: pick() };
    });
    const sparks = Array.from({ length: detail.sparks }, (_, i): Particle => {
      const a = (i / detail.sparks) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = (2.5 + Math.random() * 3) * packW;
      return { x: impact.x, y: impact.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, rot: 0, vrot: 0, size: 1 + Math.random() * 1.8, age: 0, ttl: 0.45 + Math.random() * 0.35, kind: 'spark', color: pick() };
    });
    const particles = [...debris, ...sparks];

    // The artwork over the whole pack (as background-size: cover), in pack px
    const cover = () => {
      const scale = Math.max(packW / image.naturalWidth, packH / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      return { w, h, x: (packW - w) / 2, y: (packH - h) / 2 };
    };
    const gravity = packW * 4.2;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, box.width, box.height);
      let alive = false;

      for (const s of shards) {
        if (s.life <= 0) continue;
        alive = true;
        const drag = Math.exp(-1.6 * dt);
        s.vx *= drag;
        s.vy = s.vy * drag + gravity * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.vrot * dt;
        s.flip += s.vflip * dt;
        s.life -= dt / 1.25;
        const turn = Math.cos(s.flip);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 1.6));
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        // Turning around its own axis: it narrows, edge-on, and shows its back
        ctx.scale(Math.max(0.08, Math.abs(turn)), 1);
        ctx.beginPath();
        s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.save();
        ctx.clip();
        if (turn > 0 && image.complete && image.naturalWidth) {
          const c = cover();
          ctx.drawImage(image, c.x - s.home.x, c.y - s.home.y, c.w, c.h);
        } else {
          ctx.fillStyle = turn > 0 ? '#2a2f3a' : '#15181f';
          ctx.fill();
        }
        // Darker as it turns away from the light
        ctx.fillStyle = `rgba(0, 0, 0, ${(1 - Math.abs(turn)) * 0.55})`;
        ctx.fill();
        ctx.restore();
        // Its foil edge, brighter when seen edge-on
        ctx.lineWidth = 1.2 + (1 - Math.abs(turn)) * 2.4;
        ctx.strokeStyle = s.color;
        ctx.shadowColor = glow;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
      }

      for (const p of particles) {
        if (p.age >= p.ttl) continue;
        alive = true;
        p.age += dt;
        const fade = 1 - p.age / p.ttl;
        ctx.save();
        if (p.kind === 'spark') {
          const drag = Math.exp(-4.5 * dt);
          p.vx *= drag;
          p.vy *= drag;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          ctx.globalAlpha = fade;
          ctx.strokeStyle = light;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
        } else {
          const drag = Math.exp(-2.2 * dt);
          p.vx *= drag;
          p.vy = p.vy * drag + gravity * 0.35 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vrot * dt;
          // A fleck of foil glints each time it faces the light
          const glint = Math.pow(Math.abs(Math.sin(p.rot)), 6);
          ctx.globalAlpha = fade * (0.45 + glint * 0.55);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = glint > 0.6 ? light : p.color;
          ctx.shadowColor = glow;
          ctx.shadowBlur = glint * 12;
          ctx.beginPath();
          ctx.moveTo(-p.size, -p.size * 0.6);
          ctx.lineTo(p.size, -p.size * 0.2);
          ctx.lineTo(-p.size * 0.2, p.size);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (alive) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
}
