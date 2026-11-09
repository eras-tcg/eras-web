import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { CardSlot, PendingEffect } from '@data/simulator/simulator.model';

/** The chain links whose effect comes from one of these cards, lowest first. */
export function chainLinksOf(chain: readonly PendingEffect[] | null | undefined, cards: readonly CardSlot[]): PendingEffect[] {
  if (!chain?.length || !cards.length) return [];
  const ids = new Set(cards.map((c) => c.instanceId));
  return chain.filter((e) => ids.has(e.sourceInstanceId)).sort((a, b) => a.link - b.link);
}

/**
 * The chain links a card (or a pile) has activated, as numbered gems (cyan yours, pink the rival's). On a card they
 * sit at its center (several in a row), the card is framed in that color and its highest link's kind sits at its foot: the
 * chain reads on the table (its explicit list opens from the chain's button). On a pile (Tributos, Descarte…) one
 * sits at its center and several make a ring around it.
 */
@Component({
  selector: 'eras-chain-marks',
  template: `
    @if (!ring() && top(); as t) {
      <!-- On a card: framed in the color of whoever chained it, and what its highest link is, at its foot -->
      <span class="frame" [class.rival]="!t.mine" [class.resolving]="resolving()"></span>
      <span class="tag" [class.rival]="!t.mine" [class.resolving]="t.resolving">{{ t.short }}</span>
    }
    @for (m of marks(); track m.id) {
      <span
        class="mark"
        [class.resolving]="m.resolving"
        [class.rival]="!m.mine"
        [style.--x]="m.x"
        [style.--y]="m.y"
        [attr.aria-label]="'Cadena ' + m.link + (m.resolving ? ', resolviendo' : '')"
        [title]="'Cadena ' + m.link + ' · ' + m.label"
      >{{ m.link }}</span>
    }
  `,
  styles: `
    :host {
      --mark-cyan: #38bdf8;
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
    }
    :host(:empty) { display: none; }
    .rival { --mark-cyan: #f472b6; }
    /* The link's number: a cut gem in the chainer's color, ringed in white */
    .mark {
      position: absolute;
      display: grid;
      place-items: center;
      inline-size: 1.35rem;
      block-size: 1.35rem;
      border: 2px solid #f0fdff;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--mark-cyan) 55%, #fff), var(--mark-cyan) 55%, color-mix(in srgb, var(--mark-cyan) 45%, #000));
      box-shadow: 0 1px 3px rgb(0 0 0 / 55%), 0 0 10px 2px color-mix(in srgb, var(--mark-cyan) 70%, transparent);
      color: #fff;
      font: 700 0.8rem/1 var(--font-family-display);
      text-shadow: 0 1px 2px rgb(0 0 0 / 60%);
      animation: mark-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4) backwards;
    }
    /* The link resolving now pulses */
    .mark.resolving { animation: mark-in 0.4s ease backwards, pulse 0.9s ease-in-out infinite alternate; }
    /* On a card: at its center, several side by side */
    :host(:not(.ring)) .mark {
      inset-block-start: 50%;
      inset-inline-start: calc(50% + var(--x) * 1.55rem);
      inline-size: 1.7rem;
      block-size: 1.7rem;
      font-size: 0.95rem;
      transform: translate(-50%, -50%);
    }
    /* On a pile: at the center, or on a ring around it */
    :host(.ring) .mark {
      inset-block-start: calc(50% + var(--y) * 32%);
      inset-inline-start: calc(50% + var(--x) * 32%);
      inline-size: 1.6rem;
      block-size: 1.6rem;
      font-size: 0.95rem;
      transform: translate(-50%, -50%);
    }
    /* The card in the chain: its outline lit in the chainer's color */
    .frame {
      position: absolute;
      inset: -2px;
      border: 2px solid var(--mark-cyan);
      border-radius: var(--radius-sm);
      box-shadow: 0 0 12px 2px color-mix(in srgb, var(--mark-cyan) 65%, transparent), inset 0 0 10px color-mix(in srgb, var(--mark-cyan) 40%, transparent);
      animation: frame-in 0.35s ease backwards;
    }
    .frame.resolving { animation: frame-in 0.35s ease backwards, frame-pulse 0.9s ease-in-out infinite alternate; }
    /* Its highest link's kind (En Invocación, Activada…) at the card's foot */
    .tag {
      position: absolute;
      inset-block-end: -0.45rem;
      inset-inline-start: 50%;
      max-inline-size: calc(100% + 1rem);
      overflow: hidden;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--mark-cyan) 85%, #000);
      box-shadow: 0 1px 3px rgb(0 0 0 / 50%);
      color: #fff;
      font-size: 0.6rem;
      font-weight: 700;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
      transform: translateX(-50%);
    }
    :host(.upside-down) .tag { inset-block: -0.45rem auto; }
    @keyframes mark-in { from { opacity: 0; scale: 1.8; } }
    @keyframes frame-in { from { opacity: 0; } }
    @keyframes pulse { to { box-shadow: 0 1px 3px rgb(0 0 0 / 55%), 0 0 18px 6px var(--mark-cyan); } }
    @keyframes frame-pulse { to { box-shadow: 0 0 22px 6px var(--mark-cyan), inset 0 0 14px var(--mark-cyan); } }
    @media (prefers-reduced-motion: reduce) {
      .mark, .mark.resolving, .frame, .frame.resolving { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.ring]': 'ring()', '[class.upside-down]': 'upsideDown()' },
})
export class ChainMarksComponent {
  readonly links = input<readonly PendingEffect[]>([]);
  /** Laid out on a ring centered on the box (a pile); otherwise down the card's left edge. */
  readonly ring = input(false, { transform: booleanAttribute });
  /** On the rival's card, turned round: the marks go up its other edge. */
  readonly upsideDown = input(false, { transform: booleanAttribute });
  /** The player looking: their links are cyan, the rival's pink. */
  readonly me = input<string | null | undefined>(null);

  /** The card's highest link (the next of its own to resolve). */
  protected readonly top = computed(() => this.marks().at(-1) ?? null);
  /** One of its links is resolving now. */
  protected readonly resolving = computed(() => this.marks().some((m) => m.resolving));

  protected readonly marks = computed(() => {
    const links = this.links();
    const n = links.length;
    return links.map((e, i) => {
      // One alone sits at the center; several go around, the first at the top, clockwise
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1);
      const onRing = this.ring() && n > 1;
      return {
        id: e.id,
        link: e.link,
        label: `${e.sourceName} · ${e.label}`,
        short: e.label,
        resolving: !!e.resolutionId,
        mine: e.controllerId === this.me(),
        // On a pile: on the ring; on a card: in a row centered on it
        x: this.ring() ? (onRing ? Math.cos(angle).toFixed(3) : 0) : (i - (n - 1) / 2).toFixed(2),
        y: this.ring() && onRing ? Math.sin(angle).toFixed(3) : 0,
      };
    });
  });
}
