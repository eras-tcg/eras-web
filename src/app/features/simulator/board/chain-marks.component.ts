import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { CardSlot, PendingEffect } from '@data/simulator/simulator.model';

/** The chain links whose effect comes from one of these cards, lowest first. */
export function chainLinksOf(chain: readonly PendingEffect[] | null | undefined, cards: readonly CardSlot[]): PendingEffect[] {
  if (!chain?.length || !cards.length) return [];
  const ids = new Set(cards.map((c) => c.instanceId));
  return chain.filter((e) => ids.has(e.sourceInstanceId)).sort((a, b) => a.link - b.link);
}

/**
 * The chain links a card (or a pile: Tributos, Descarte…) has activated, as numbered gems (cyan yours, pink the
 * rival's): one at its center, several on the corners of a regular polygon centered on it. A card is also framed in
 * that color. The chain reads on the table; its explicit list opens from the chain's button.
 */
@Component({
  selector: 'eras-chain-marks',
  template: `
    @if (!ring() && top(); as t) {
      <!-- On a card: framed in the color of whoever chained it -->
      <span class="frame" [class.rival]="!t.mine" [class.resolving]="resolving()"></span>
    }
    @for (m of marks(); track m.id) {
      <span
        class="mark"
        [class.resolving]="m.resolving"
        [class.rival]="!m.mine"
        [style.--x]="m.x"
        [style.--y]="m.y"
        [style.--r]="radius()"
        [style.--g]="gem()"
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
    /* On a card or a pile: at its center; several on the corners of a regular polygon around it (2 one above the
       other, 3 a triangle, 4 a square…), the first at the top, clockwise; the polygon grows with them so they do not
       touch (--r, in rem) and the gems get smaller from 4 on (--g, in rem), so it stays over the card */
    .mark {
      inset-block-start: calc(50% + var(--y) * var(--r) * 1rem);
      inset-inline-start: calc(50% + var(--x) * var(--r) * 1rem);
      inline-size: calc(var(--g) * 1rem);
      block-size: calc(var(--g) * 1rem);
      font-size: calc(var(--g) * 0.56rem);
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
  /** On a pile (not a card): no frame around it. */
  readonly ring = input(false, { transform: booleanAttribute });
  /** On the rival's card, turned round: the marks go up its other edge. */
  readonly upsideDown = input(false, { transform: booleanAttribute });
  /** The player looking: their links are cyan, the rival's pink. */
  readonly me = input<string | null | undefined>(null);

  /** The card's highest link (the next of its own to resolve). */
  protected readonly top = computed(() => this.marks().at(-1) ?? null);
  /** One of its links is resolving now. */
  protected readonly resolving = computed(() => this.marks().some((m) => m.resolving));

  /** The gems' size (rem): smaller the more there are (4 on), so the polygon stays over the card or pile. */
  protected readonly gem = computed(() => {
    const n = this.links().length;
    return n <= 3 ? 1.7 : n <= 5 ? 1.4 : 1.2;
  });

  /** The polygon's radius (rem): its side, 2·r·sin(π/n), a gem and a little more, so the gems just do not touch. */
  protected readonly radius = computed(() => {
    const n = this.links().length;
    return n > 1 ? ((this.gem() + 0.2) / 2 / Math.sin(Math.PI / n)).toFixed(3) : 0;
  });

  protected readonly marks = computed(() => {
    const links = this.links();
    const n = links.length;
    return links.map((e, i) => {
      // One alone at the center; several on a regular polygon, the first at the top, clockwise
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1);
      return {
        id: e.id,
        link: e.link,
        label: `${e.sourceName} · ${e.label}`,
        resolving: !!e.resolutionId,
        mine: e.controllerId === this.me(),
        x: n > 1 ? Math.cos(angle).toFixed(3) : 0,
        y: n > 1 ? Math.sin(angle).toFixed(3) : 0,
      };
    });
  });
}
