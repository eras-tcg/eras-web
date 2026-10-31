import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { CardSlot, PendingEffect } from '@data/simulator/simulator.model';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/** The chain links whose effect comes from one of these cards, lowest first. */
export function chainLinksOf(chain: readonly PendingEffect[] | null | undefined, cards: readonly CardSlot[]): PendingEffect[] {
  if (!chain?.length || !cards.length) return [];
  const ids = new Set(cards.map((c) => c.instanceId));
  return chain.filter((e) => ids.has(e.sourceInstanceId)).sort((a, b) => a.link - b.link);
}

/**
 * The chain links a card (or a pile) has activated, as cyan numbered marks. On a card they line up down its left
 * edge; on a pile (Tributos, Descarte…) one sits at its center and several make a ring around it.
 */
@Component({
  selector: 'eras-chain-marks',
  imports: [IconComponent],
  template: `
    @for (m of marks(); track m.id) {
      <span
        class="mark"
        [class.resolving]="m.resolving"
        [class.rival]="!m.mine"
        [style.--x]="m.x"
        [style.--y]="m.y"
        [attr.aria-label]="'Cadena ' + m.link + (m.resolving ? ', resolviendo' : '')"
        [title]="'Cadena ' + m.link + ' · ' + m.label"
      >
        <eras-icon name="link" />{{ m.link }}
      </span>
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
    .mark {
      position: absolute;
      display: inline-flex;
      align-items: center;
      gap: 0.1em;
      padding: 0.1em 0.4em 0.1em 0.3em;
      border: 1.5px solid #ecfeff;
      border-radius: var(--radius-pill);
      background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--mark-cyan) 70%, #fff), var(--mark-cyan) 60%, #0c4a6e);
      box-shadow: 0 0 0 1px rgb(0 0 0 / 35%), 0 0 10px 2px color-mix(in srgb, var(--mark-cyan) 70%, transparent);
      color: #04202e;
      font: 700 0.8rem/1 var(--font-family-display);
      white-space: nowrap;
      animation: mark-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.4) backwards;
    }
    .mark.rival { --mark-cyan: #f472b6; }
    .mark eras-icon { inline-size: 0.85em; block-size: 0.85em; }
    /* The link resolving now pulses */
    .mark.resolving { animation: mark-in 0.4s ease backwards, pulse 0.9s ease-in-out infinite alternate; }
    /* On a card: down its left edge, under the printed cost */
    :host(:not(.ring)) .mark { inset-block-start: calc(26% + var(--y) * 1.45rem); inset-inline-start: -0.35rem; }
    /* On a pile: at the center, or on a ring around it */
    :host(.ring) .mark {
      inset-block-start: calc(50% + var(--y) * 32%);
      inset-inline-start: calc(50% + var(--x) * 32%);
      font-size: 1rem;
      transform: translate(-50%, -50%);
    }
    @keyframes mark-in { from { opacity: 0; scale: 1.8; } }
    @keyframes pulse { to { box-shadow: 0 0 0 1px rgb(0 0 0 / 35%), 0 0 18px 6px var(--mark-cyan); } }
    @media (prefers-reduced-motion: reduce) {
      .mark, .mark.resolving { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.ring]': 'ring()' },
})
export class ChainMarksComponent {
  readonly links = input<readonly PendingEffect[]>([]);
  /** Laid out on a ring centered on the box (a pile); otherwise down the card's left edge. */
  readonly ring = input(false, { transform: booleanAttribute });
  /** The player looking: their links are cyan, the rival's pink. */
  readonly me = input<string | null | undefined>(null);

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
        resolving: !!e.resolutionId,
        mine: e.controllerId === this.me(),
        x: onRing ? Math.cos(angle).toFixed(3) : 0,
        y: this.ring() ? (onRing ? Math.sin(angle).toFixed(3) : 0) : i,
      };
    });
  });
}
