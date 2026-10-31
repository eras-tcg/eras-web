import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterRenderEffect, inject } from '@angular/core';
import { displayStrength } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { GameEvent, GameState } from '@data/simulator/simulator.model';
import { BoardAnimations } from './board-animations';
import { CHARGE_MS } from './damage-reveal.component';

const SVG = 'http://www.w3.org/2000/svg';

/** A field card as drawn: its center, its own size (not the box of an exhausted, turned card) and whether it is turned. */
interface Drawn {
  x: number;
  y: number;
  width: number;
  height: number;
  tapped: boolean;
  imageUrl: string | null;
}
const ARROW_MS = 950;
const ATTACK_MS = CHARGE_MS;
const FLOAT_MS = 1100;

/**
 * Small effects over the table, drawn from what changes in each update:
 * - an attack: once blocks are decided, the attacker charges at what it hits (the blocker, the creature it attacks,
 *   or the rival's lives) and comes back, before its damage or clash is shown;
 * - an effect's target: a beam from the effect's card to each card (or pile) it chose;
 * - a creature's strength going up or down: "+2" / "−1" rising from it;
 * - gems gained or spent: the marker lights up and "+N" / "−N" rises from it;
 * - a deck shuffled: the deck shakes;
 * - a card revealed from the hand: it turns over, big, for a moment (the rival sees what it is).
 * Nothing when the animations are off.
 */
@Component({
  selector: 'eras-board-fx',
  template: `
    @for (card of game.revealed(); track card.id) {
      <figure class="revealed" role="status" aria-live="polite">
        <span class="flip">
          <span class="back" aria-hidden="true"></span>
          @if (card.imageUrl) {
            <img [src]="card.imageUrl" [alt]="card.name ?? 'Carta revelada'" />
          }
        </span>
        <figcaption>Revela {{ card.name ?? 'una carta' }}</figcaption>
      </figure>
    }
  `,
  styles: `
    /* A card revealed from the hand: it turns over at the middle of the screen, then goes */
    .revealed {
      position: fixed;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      z-index: 1040;
      display: grid;
      justify-items: center;
      gap: var(--space-2);
      margin: 0;
      pointer-events: none;
      transform: translate(-50%, -50%);
      animation: revealed 3s ease forwards;
    }
    .flip {
      position: relative;
      display: block;
      inline-size: min(14rem, 40vw);
      aspect-ratio: 63 / 88;
      transform-style: preserve-3d;
      animation: turn 0.7s cubic-bezier(0.3, 0.8, 0.3, 1) 0.15s backwards;
    }
    .flip img, .back {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      border-radius: var(--radius-md);
      object-fit: cover;
      backface-visibility: hidden;
      box-shadow: 0 0 0 2px #fde68a, 0 0 36px 8px rgb(253 230 138 / 45%);
    }
    .back { background: var(--color-card-back); transform: rotateY(180deg); }
    figcaption {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 70%);
      color: #fff;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
    }
    @keyframes turn { from { transform: rotateY(180deg) scale(0.6); } }
    @keyframes revealed { 0% { opacity: 0; } 8% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .revealed, .flip { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardFxComponent {
  protected readonly game = inject(GameStore);
  private readonly document = inject(DOCUMENT);
  private readonly animations = inject(BoardAnimations);
  /** The last timeline event already seen (null until the first state: joining shows nothing). */
  private lastSeq: number | null = null;
  private strengths = new Map<string, number>();
  private gems = new Map<string, number>();
  /** Where each field card was drawn last time: the attacker may have left the field by the time its blow shows. */
  private rects = new Map<string, Drawn>();
  private lastState: GameState | null = null;
  private readonly layer = this.createLayer();

  constructor() {
    afterRenderEffect({
      read: () => {
        const state = this.game.state();
        if (!state || state === this.lastState) return;
        const first = this.lastState === null;
        this.lastState = state;
        const events = this.newEvents(state);
        if (first || this.animations.off() || this.reduced()) {
          this.remember(state);
          return;
        }
        // The attacker charges first, at once: its damage or clash is shown right after
        const rects = this.rects;
        for (const e of events) {
          if (e.type === 'CLASH') this.charge(e.cardInstanceId, (e.data?.['blockerId'] as string | undefined) ?? null, e.playerId, state, rects);
          else if (e.type === 'LIFE_DAMAGE' && !e.effectId && e.data?.['attackerId']) {
            this.charge(e.data['attackerId'] as string, null, Object.keys(state.players ?? {}).find((id) => id !== e.data?.['defenderId']) ?? null, state, rects);
          }
        }
        // What this update did waits for anything that started with it (a chain link shown, a resolution)
        const strengths = this.strengths;
        const gems = this.gems;
        this.animations.whenIdle(() => {
          for (const e of events) {
            if (e.type === 'TARGET') this.targetBeams(state, e);
          }
          this.strengthFloats(state, strengths);
          this.gemFloats(state, gems);
          if (state.event === 'SHUFFLE_DECK' && state.actorId) this.shake(`[data-pile="${state.actorId}:deck"]`);
        });
        this.remember(state);
      },
    });
    inject(DestroyRef).onDestroy(() => this.layer.remove());
  }

  private reduced(): boolean {
    return !!this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private createLayer(): SVGSVGElement {
    const svg = this.document.createElementNS(SVG, 'svg');
    Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '1045', pointerEvents: 'none', overflow: 'visible' });
    this.document.body.append(svg);
    return svg;
  }

  private newEvents(state: GameState): GameEvent[] {
    const timeline = state.timeline ?? [];
    const max = timeline.reduce((m, e) => Math.max(m, e.seq), 0);
    // A new game starts a new timeline
    if (this.lastSeq === null || max < this.lastSeq) {
      this.lastSeq = max;
      return [];
    }
    const fresh = timeline.filter((e) => e.seq > this.lastSeq!);
    this.lastSeq = max;
    return fresh;
  }

  private remember(state: GameState): void {
    const players = Object.values(state.players ?? {});
    this.strengths = new Map(players.flatMap((p) => p.field.filter((c) => c.cardType === 'creature').map((c) => [c.instanceId, displayStrength(c) ?? 0] as const)));
    this.gems = new Map(players.map((p) => [p.userId, p.resourceCount ?? 0] as const));
    this.rects = new Map();
    for (const c of players.flatMap((p) => p.field)) {
      const card = this.document.querySelector<HTMLElement>(`[data-instance-id="${c.instanceId}"] eras-game-card`);
      if (!card) continue;
      const r = card.getBoundingClientRect();
      this.rects.set(c.instanceId, { x: r.left + r.width / 2, y: r.top + r.height / 2, width: card.offsetWidth, height: card.offsetHeight, tapped: c.tapped, imageUrl: c.imageUrl });
    }
  }

  /** The center of a card on the table (field or hand) or of a pile, on the screen. */
  private centerOf(selector: string): { x: number; y: number } | null {
    const el = this.document.querySelector<HTMLElement>(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  private cardCenter(state: GameState, id: string | null | undefined): { x: number; y: number } | null {
    if (!id) return null;
    const card = this.centerOf(`[data-instance-id="${id}"] eras-game-card`) ?? this.centerOf(`[data-hand-id="${id}"] eras-game-card`);
    if (card) return card;
    for (const p of Object.values(state.players ?? {})) {
      for (const zone of ['tributeZone', 'discardPile', 'lifeStack', 'deck', 'hand'] as const) {
        if (p[zone].some((c) => c.instanceId === id)) return this.centerOf(`[data-pile="${p.userId}:${zone}"]`);
      }
    }
    return null;
  }

  /**
   * The attacker charges: a copy of it leaves its place (where it was drawn last, as it may be gone already), strikes
   * what it hits (`targetId`, or the lives of `attackerOwner`'s rival) and comes back; the real card waits hidden. The
   * target shakes with a red flash at the blow.
   */
  private charge(
    attackerId: string | null,
    targetId: string | null,
    attackerOwner: string | null,
    state: GameState,
    rects: Map<string, Drawn>,
  ): void {
    const seen = attackerId ? rects.get(attackerId) : undefined;
    if (!seen) return;
    const defender = Object.keys(state.players ?? {}).find((id) => id !== attackerOwner);
    const target = targetId
      ? this.document.querySelector<HTMLElement>(`[data-instance-id="${targetId}"] eras-game-card`)
      : defender
        ? this.document.querySelector<HTMLElement>(`[data-pile="${defender}:lifeStack"]`)
        : null;
    const box = target?.getBoundingClientRect();
    const to = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : targetId ? rects.get(targetId) : undefined;
    if (!to) return;
    // It stops a little short of the target's center, as it hits
    const dx = (to.x - seen.x) * 0.82;
    const dy = (to.y - seen.y) * 0.82;
    // An exhausted card charges turned, as it is on the table
    const turn = seen.tapped ? ' rotate(90deg)' : '';
    const copy = this.document.createElement('div');
    Object.assign(copy.style, {
      position: 'fixed',
      left: `${seen.x - seen.width / 2}px`,
      top: `${seen.y - seen.height / 2}px`,
      width: `${seen.width}px`,
      height: `${seen.height}px`,
      zIndex: '1044',
      pointerEvents: 'none',
      borderRadius: '6px',
      background: seen.imageUrl ? `center / cover url("${seen.imageUrl}")` : 'var(--color-card-back)',
      boxShadow: '0 8px 24px rgb(0 0 0 / 45%)',
    });
    this.document.body.append(copy);
    const real = attackerId ? this.document.querySelector<HTMLElement>(`[data-instance-id="${attackerId}"]`) : null;
    if (real) real.style.visibility = 'hidden';
    this.animations.hold(ATTACK_MS);
    const animation = copy.animate(
      [
        { transform: `translate(0, 0) scale(1)${turn}`, filter: 'none' },
        { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px) scale(1.05)${turn}`, filter: 'drop-shadow(0 0 10px #ef4444)', offset: 0.18 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.18)${turn}`, filter: 'drop-shadow(0 0 18px #ef4444)', offset: 0.42 },
        { transform: `translate(${dx * 0.92}px, ${dy * 0.92}px) scale(1.12)${turn}`, filter: 'drop-shadow(0 0 14px #ef4444)', offset: 0.55 },
        { transform: `translate(0, 0) scale(1)${turn}`, filter: 'none' },
      ],
      { duration: ATTACK_MS, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
    );
    const done = () => {
      copy.remove();
      if (real) real.style.visibility = '';
    };
    animation.onfinish = done;
    animation.oncancel = done;
    // The blow lands on the target
    target?.animate(
      [
        { transform: 'translateX(0)', filter: 'none' },
        { transform: 'translateX(-7px)', filter: 'brightness(1.6) drop-shadow(0 0 16px #ef4444)' },
        { transform: 'translateX(6px)', filter: 'brightness(1.4) drop-shadow(0 0 12px #ef4444)' },
        { transform: 'translateX(-3px)', filter: 'drop-shadow(0 0 6px #ef4444)' },
        { transform: 'translateX(0)', filter: 'none' },
      ],
      { duration: 380, delay: ATTACK_MS * 0.42, easing: 'ease-out' },
    );
  }

  /** An effect's card points at each card it chose. */
  private targetBeams(state: GameState, e: GameEvent): void {
    const link = e.effectId ? state.chain?.find((c) => c.id === e.effectId) : null;
    const from = this.cardCenter(state, link?.sourceInstanceId);
    if (!from) return;
    const ids = (e.data?.['targetIds'] as string[] | undefined) ?? (e.cardInstanceId ? [e.cardInstanceId] : []);
    const color = e.playerId === this.game.myState()?.userId ? '#38bdf8' : '#f472b6';
    for (const id of ids) {
      const to = this.cardCenter(state, id);
      if (to && (Math.abs(to.x - from.x) > 4 || Math.abs(to.y - from.y) > 4)) this.arrow(from, to, color, 4);
    }
  }

  /** A curved arrow that draws itself from `from` to `to`, holds and fades. */
  private arrow(from: { x: number; y: number }, to: { x: number; y: number }, color: string, width: number): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    // Bent to one side, as thrown
    const cx = (from.x + to.x) / 2 - dy * 0.18;
    const cy = (from.y + to.y) / 2 + dx * 0.18;
    const group = this.document.createElementNS(SVG, 'g');
    group.style.filter = `drop-shadow(0 0 6px ${color})`;
    const path = this.document.createElementNS(SVG, 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`);
    Object.assign(path.style, { fill: 'none', stroke: color, strokeWidth: `${width}`, strokeLinecap: 'round' });
    const pathLength = path.getTotalLength?.() || length;
    path.style.strokeDasharray = `${pathLength}`;
    // The head, along the curve's last stretch
    const angle = Math.atan2(to.y - cy, to.x - cx);
    const size = width * 3.2;
    const head = this.document.createElementNS(SVG, 'polygon');
    const p = (a: number, r: number) => `${to.x + Math.cos(a) * r},${to.y + Math.sin(a) * r}`;
    head.setAttribute('points', `${to.x},${to.y} ${p(angle + Math.PI - 0.45, size)} ${p(angle + Math.PI + 0.45, size)}`);
    head.style.fill = color;
    group.append(path, head);
    this.layer.append(group);
    this.animations.hold(ARROW_MS);
    path.animate([{ strokeDashoffset: pathLength }, { strokeDashoffset: 0 }], { duration: ARROW_MS * 0.4, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'both' });
    head.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1, offset: 0.45 }, { opacity: 1 }], { duration: ARROW_MS * 0.6, fill: 'both' });
    const fade = group.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: ARROW_MS, fill: 'both' });
    fade.onfinish = () => group.remove();
    fade.oncancel = () => group.remove();
  }

  private strengthFloats(state: GameState, strengths: Map<string, number>): void {
    for (const p of Object.values(state.players ?? {})) {
      for (const c of p.field) {
        const before = strengths.get(c.instanceId);
        if (before === undefined || c.cardType !== 'creature') continue;
        const now = displayStrength(c) ?? 0;
        if (now === before) continue;
        const at = this.centerOf(`[data-instance-id="${c.instanceId}"] eras-game-card`);
        if (at) this.float(at.x, at.y - 20, `${now > before ? '+' : '−'}${Math.abs(now - before)}`, now > before ? '#22c55e' : '#ef4444');
      }
    }
  }

  private gemFloats(state: GameState, gems: Map<string, number>): void {
    for (const p of Object.values(state.players ?? {})) {
      const before = gems.get(p.userId);
      const now = p.resourceCount ?? 0;
      if (before === undefined || now === before) continue;
      const pips = this.document.querySelector<HTMLElement>(`[data-gems="${p.userId}"]`);
      if (!pips) continue;
      const r = pips.getBoundingClientRect();
      const gained = now > before;
      this.float(r.left + r.width / 2, r.top, `${gained ? '+' : '−'}${Math.abs(now - before)} ◆`, gained ? '#38bdf8' : '#94a3b8');
      pips.animate(
        gained
          ? [{ filter: 'drop-shadow(0 0 0 transparent)' }, { filter: 'drop-shadow(0 0 10px #38bdf8) brightness(1.5)' }, { filter: 'drop-shadow(0 0 0 transparent)' }]
          : [{ filter: 'none' }, { filter: 'grayscale(1) brightness(0.6)' }, { filter: 'none' }],
        { duration: 800, easing: 'ease-in-out' },
      );
    }
  }

  /** Text that rises from a point and fades. */
  private float(x: number, y: number, text: string, color: string): void {
    const el = this.document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      zIndex: '1046',
      color,
      font: '700 1.6rem/1 var(--font-family-display)',
      textShadow: '0 0 2px #000, 0 2px 8px rgb(0 0 0 / 80%)',
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%)',
      whiteSpace: 'nowrap',
    });
    this.document.body.append(el);
    const animation = el.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.6)' },
        { opacity: 1, transform: 'translate(-50%, -90%) scale(1.15)', offset: 0.2 },
        { opacity: 1, transform: 'translate(-50%, -140%) scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'translate(-50%, -190%) scale(1)' },
      ],
      { duration: FLOAT_MS, easing: 'ease-out' },
    );
    animation.onfinish = () => el.remove();
    animation.oncancel = () => el.remove();
  }

  /** A pile shakes (a deck shuffled). */
  private shake(selector: string): void {
    const el = this.document.querySelector<HTMLElement>(selector);
    el?.animate(
      [0, -6, 6, -5, 5, -3, 3, 0].map((x, i) => ({ transform: `translateX(${x}px) rotate(${i % 2 ? 2 : -2}deg)` })),
      { duration: 600, easing: 'ease-in-out' },
    );
  }
}
