import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, effect, inject, signal, untracked, viewChildren } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, GameState, PendingEffect } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { BoardAnimations } from './board-animations';

/** A card drawn in the reveal: its art (or name), its link number and whose it is. */
interface LinkCard {
  imageUrl: string | null;
  name: string;
  link: number;
  mine: boolean;
}

/** A card placed on the stage: its center (in stage units), its tilt, and how far it comes from. */
interface Placed extends LinkCard {
  x: number;
  y: number;
  tilt: number;
  /** Where it was in the reveal before this link joined, from where it is now (0 for the new one). */
  fromX: number;
  fromY: number;
  fromTilt: number;
  isNew: boolean;
}

/** A chain from one card's center to the next one's. */
interface ChainBar {
  x: number;
  y: number;
  length: number;
  angle: number;
  isNew: boolean;
}

/**
 * A new link of the chain, with the two before it: one on each side, each lower than the one before, chained in
 * diagonal. The older ones move to make room, and the oldest of four leaves at the top.
 */
interface Link {
  kind: 'link';
  /** Joining the chain, or resolving: the same stage, the link resolving lights up and breaks away. */
  mode: 'join' | 'resolve';
  id: number;
  card: LinkCard;
  cards: Placed[];
  chains: ChainBar[];
  leaving: Placed | null;
  label: string;
  mine: boolean;
}

/** The chain is built: it starts resolving, from its last link. */
interface Resolution {
  kind: 'resolution';
  id: number;
  links: number;
}

type Shown = Link | Resolution;

const SHOW_MS = 2100;
const RESOLUTION_MS = 1500;

/** The stage, in units of --u (the styles use the same numbers): its size, the step down, how far each side is. */
const STAGE_W = 30;
const STAGE_H = 32;
const STEP = 8;
const SIDE = 6.5;

/**
 * Where each of these links sits (up to three, oldest first): one alone at the center; else the odd links on the
 * right and the even ones on the left, each a step lower than the one before, the group centered.
 */
function layout(links: number[]): Map<number, { x: number; y: number; tilt: number }> {
  const n = links.length;
  return new Map(
    links.map((link, i) => {
      const side = n === 1 ? 0 : link % 2 ? 1 : -1;
      return [link, { x: STAGE_W / 2 + side * SIDE, y: STAGE_H / 2 + (i - (n - 1) / 2) * STEP, tilt: side * 7 }];
    }),
  );
}

/**
 * Each effect that joins the chain, shown big for a moment with the two links before it: one on each side, chained
 * in diagonal, the new one landing with its number glowing in cyan while the older ones move up. When the chain is
 * built and starts resolving, "Resolución" says so. The game waits for them (the next choice opens after), so a
 * chain builds at a pace that can be followed. Then each link that resolves is shown the same way, from the last
 * one down: it lights up and breaks away from the chain. One after another; a click skips the current one.
 * A chain of one link alone shows nothing: it just resolves (its link is shown once a second one chains to it).
 */
@Component({
  selector: 'eras-chain-link-reveal',
  imports: [GameCardComponent],
  template: `
    @for (s of shown(); track s.id) {
      @if (s.kind === 'resolution') {
        <button #reveal popover="manual" type="button" class="reveal resolution" aria-live="assertive" aria-label="Saltar la animación" (click)="skip()">
          <span class="band">
            <strong>Resolución</strong>
            <span>{{ s.links === 1 ? 'Se resuelve el efecto' : 'Se resuelve de la cadena ' + s.links + ' a la 1' }}</span>
          </span>
        </button>
      } @else {
        <button #reveal popover="manual" type="button" class="reveal" [class.rival]="!s.mine" [class.resolve]="s.mode === 'resolve'" aria-live="assertive" aria-label="Saltar la animación" (click)="skip()">
          <span class="stage">
            @for (c of s.chains; track $index) {
              <span
                class="chain"
                [class.new]="c.isNew"
                aria-hidden="true"
                [style.--x]="c.x"
                [style.--y]="c.y"
                [style.--len]="c.length"
                [style.--angle]="c.angle + 'deg'"
              ></span>
            }
            @if (s.leaving; as l) {
              <span class="card leaving" [class.rival]="!l.mine" aria-hidden="true" [style.--x]="l.x" [style.--y]="l.y" [style.--tilt]="l.tilt + 'deg'">
                <eras-game-card [imageUrl]="l.imageUrl" [name]="l.name" />
                <span class="number">{{ l.link }}</span>
              </span>
            }
            @for (c of s.cards; track c.link) {
              <span
                class="card"
                [class.new]="c.isNew"
                [class.resolving]="s.mode === 'resolve' && c.link === s.card.link"
                [class.rival]="!c.mine"
                [style.--x]="c.x"
                [style.--y]="c.y"
                [style.--tilt]="c.tilt + 'deg'"
                [style.--from-x]="c.fromX"
                [style.--from-y]="c.fromY"
                [style.--from-tilt]="c.fromTilt + 'deg'"
              >
                <eras-game-card [imageUrl]="c.imageUrl" [name]="c.name" />
                <span class="number">{{ c.link }}</span>
              </span>
            }
          </span>
          <span class="caption">
            <strong>{{ s.mode === 'resolve' ? 'Se resuelve · ' : '' }}Cadena {{ s.card.link }}</strong>
            <span>{{ s.card.name }} · {{ s.label }}</span>
          </span>
        </button>
      }
    }
  `,
  styles: `
    /* A popover: in the browser's top layer, above the chain panel and any choice open */
    .reveal {
      --link-cyan: #38bdf8;
      position: fixed;
      inset: 0;
      inline-size: auto;
      block-size: auto;
      max-inline-size: none;
      max-block-size: none;
      margin: 0;
      overflow: visible;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: var(--space-3);
      padding: 0;
      border: 0;
      background: radial-gradient(ellipse at center, rgb(8 20 32 / 70%), rgb(0 0 0 / 35%) 70%, transparent);
      color: #f4f4f6;
      font: inherit;
      cursor: pointer;
      animation: fade 2.1s ease forwards; /* SHOW_MS */
    }
    .reveal.rival { --link-cyan: #f472b6; }
    .reveal:focus-visible { outline: none; }
    /* The stage, sized in --u so the three cards fit the screen */
    .stage {
      --u: min(1rem, 2.4vh, 3vw);
      position: relative;
      display: block;
      inline-size: calc(var(--u) * 30); /* STAGE_W */
      block-size: calc(var(--u) * 32); /* STAGE_H */
    }
    .card {
      --game-card-width: calc(var(--u) * 10);
      position: absolute;
      inset-block-start: calc(var(--u) * var(--y));
      inset-inline-start: calc(var(--u) * var(--x));
      z-index: 2;
      display: block;
      translate: -50% -50%;
      rotate: var(--tilt);
      filter: brightness(0.8);
      animation: shift 0.45s cubic-bezier(0.3, 0.8, 0.3, 1) backwards;
    }
    .card.rival { --link-cyan: #f472b6; }
    .card eras-game-card { box-shadow: 0 0 0 2px color-mix(in srgb, var(--link-cyan) 70%, transparent), 0 0 18px 3px color-mix(in srgb, var(--link-cyan) 40%, transparent); }
    /* The new link lands from above and larger, with a flash, after the others made room */
    .card.new { z-index: 3; filter: none; animation: land 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.25s backwards; }
    .card.new eras-game-card { box-shadow: 0 0 0 2px var(--link-cyan), 0 0 26px 6px color-mix(in srgb, var(--link-cyan) 55%, transparent); animation: flash 0.8s ease 0.7s backwards; }
    /* The oldest of four goes up and away */
    .card.leaving { z-index: 1; animation: leave 0.45s ease forwards; }
    /* A chain from one card's center to the next: steel links in diagonal, behind the cards */
    .chain {
      position: absolute;
      inset-block-start: calc(var(--u) * var(--y));
      inset-inline-start: calc(var(--u) * var(--x));
      z-index: 1;
      inline-size: calc(var(--u) * var(--len));
      block-size: calc(var(--u) * 1.1);
      background: radial-gradient(ellipse calc(var(--u) * 0.6) calc(var(--u) * 0.42) at center, transparent 55%, #e2e8f0 58%, #64748b 78%, transparent 82%) 0 0 / calc(var(--u) * 1.2) 100% repeat-x;
      filter: drop-shadow(0 0 4px color-mix(in srgb, var(--link-cyan) 70%, transparent));
      transform: translateY(-50%) rotate(var(--angle));
      transform-origin: left center;
      animation: appear 0.3s ease 0.4s backwards;
    }
    /* The new chain runs out from the card before to the new one */
    .chain.new { animation: chain-out 0.4s ease 0.6s backwards; }
    .number {
      position: absolute;
      inset-block-end: -0.55em;
      inset-inline-end: -0.3em;
      color: #ecfeff;
      font: 700 calc(var(--u) * 3.6)/1 var(--font-family-display);
      text-shadow: 0 0 6px var(--link-cyan), 0 0 18px var(--link-cyan), 0 0 36px var(--link-cyan);
      -webkit-text-stroke: 2px var(--link-cyan);
    }
    .card:not(.new) .number { font-size: calc(var(--u) * 2.8); }
    .card.new .number { animation: number-in 0.5s ease 0.6s backwards; }
    .caption { display: grid; justify-items: center; gap: var(--space-1); text-shadow: 0 2px 8px rgb(0 0 0 / 80%); animation: caption-in 0.4s ease 0.6s backwards; }
    .caption strong { color: var(--link-cyan); font: 700 var(--font-size-xl, 1.5rem)/1.1 var(--font-family-display); letter-spacing: 0.04em; }
    .caption span { font-size: var(--font-size-sm); }
    /* Resolving: the cards stay put; the link resolving glows, then breaks away and its chain snaps */
    .resolve .card, .resolve .card.new, .resolve .card eras-game-card, .resolve .chain, .resolve .number { animation: none; }
    .resolve .card.resolving { z-index: 3; filter: none; animation: resolve-out 1.3s ease 0.55s forwards; }
    .resolve .card.resolving eras-game-card { box-shadow: 0 0 0 3px #fff, 0 0 40px 12px var(--link-cyan); animation: glow 0.55s ease-in-out alternate 2; }
    .resolve .chain.new { animation: snap 0.45s ease 0.8s forwards; }
    @keyframes resolve-out {
      25% { scale: 1.08; filter: brightness(1.5); }
      100% { opacity: 0; scale: 1.3; filter: brightness(2.2) blur(6px); }
    }
    @keyframes glow { to { box-shadow: 0 0 0 4px #fff, 0 0 60px 22px var(--link-cyan); } }
    @keyframes snap { to { opacity: 0; transform: translateY(-50%) rotate(var(--angle)) scaleX(0.15); } }
    /* Resolución: a band across the screen that sweeps in, holds and goes */
    .resolution { background: rgb(0 0 0 / 35%); animation-duration: 1.5s; /* RESOLUTION_MS */ }
    .band {
      display: grid;
      justify-items: center;
      gap: var(--space-1);
      inline-size: 100vw;
      padding: var(--space-4) 0;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--link-cyan) 30%, #08141f) 20%, color-mix(in srgb, var(--link-cyan) 30%, #08141f) 80%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--link-cyan) 50%, transparent);
      animation: sweep 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) backwards;
    }
    .band strong {
      color: #ecfeff;
      font: 700 clamp(2rem, 6vw, 3.5rem)/1 var(--font-family-display);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-shadow: 0 0 8px var(--link-cyan), 0 0 24px var(--link-cyan);
    }
    .band span { font-size: var(--font-size-sm); text-shadow: 0 2px 6px rgb(0 0 0 / 80%); }
    @keyframes sweep { from { opacity: 0; transform: scaleY(0.2); letter-spacing: 0.6em; } }
    @keyframes fade { 0% { opacity: 0; } 8% { opacity: 1; } 84% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes land { from { opacity: 0; translate: -50% -110%; scale: 1.35; } }
    @keyframes shift { from { translate: calc(-50% + var(--u) * var(--from-x)) calc(-50% + var(--u) * var(--from-y)); rotate: var(--from-tilt); } }
    @keyframes leave { to { opacity: 0; translate: -50% calc(-50% - var(--u) * 8); } }
    @keyframes appear { from { opacity: 0; } }
    @keyframes chain-out { from { transform: translateY(-50%) rotate(var(--angle)) scaleX(0); } }
    @keyframes flash { from { box-shadow: 0 0 0 4px #fff, 0 0 60px 24px var(--link-cyan); } }
    @keyframes number-in { from { opacity: 0; transform: scale(2.2); } }
    @keyframes caption-in { from { opacity: 0; transform: translateY(0.75rem); } }
    @media (prefers-reduced-motion: reduce) {
      .reveal, .card, .card eras-game-card, .chain, .number, .caption, .band { animation: none; }
      .card.leaving { display: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChainLinkRevealComponent {
  private readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);
  private readonly animations = inject(BoardAnimations);
  private readonly reveals = viewChildren<ElementRef<HTMLElement>>('reveal');
  protected readonly current = signal<Shown | null>(null);
  protected readonly shown = computed(() => {
    const current = this.current();
    return current ? [current] : [];
  });
  private ids = 0;
  private readonly queue: Shown[] = [];
  /** The links already seen (null until the first state: a chain there on joining is not shown). */
  private seen: Set<string> | null = null;
  /** The chain whose resolution was announced (by its first link), so it is said once. */
  private resolvingChain: string | null = null;
  /** The chain last time: a link that left it without being seen resolving is shown resolving from it. */
  private previousChain: PendingEffect[] = [];
  /** The links already shown resolving. */
  private resolved = new Set<string>();
  /** The highest link the current chain reached: a chain that never went past link 1 is not shown. */
  private chainTop = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Releases the choices once everything queued has been shown. */
  private release: (() => void) | null = null;

  constructor() {
    effect(() => {
      const state = this.game.state();
      untracked(() => this.collect(state));
    });
    // Each one shown is raised to the top layer (shown last, it goes above what is there)
    afterRenderEffect(() => {
      for (const r of this.reveals()) {
        const el = r.nativeElement;
        if (!el.matches(':popover-open')) el.showPopover?.();
      }
    });
  }

  /** A click skips the one being shown. */
  protected skip(): void {
    if (this.timer) clearTimeout(this.timer);
    this.next();
  }

  private collect(state: GameState | null): void {
    const chain = state?.chain ?? [];
    const playing = state?.status === 'IN_PROGRESS';
    const first = chain.find((e) => e.link === 1)?.id ?? null;
    const resolving = chain.some((e) => e.resolutionId);
    const previous = this.previousChain;
    this.previousChain = chain;
    if (this.seen === null || !playing) {
      this.seen = new Set(chain.map((e) => e.id));
      this.resolvingChain = resolving ? first : null;
      this.resolved = new Set(chain.filter((e) => e.resolutionId).map((e) => e.id));
      return;
    }
    const added = chain.filter((e) => !this.seen!.has(e.id));
    // An empty chain is over: its ids can be forgotten
    this.seen = new Set(chain.map((e) => e.id));
    // Links resolving now, and links gone from the chain without being seen resolving (resolved within one update)
    const gone = previous.filter((e) => !chain.some((c) => c.id === e.id) && !this.resolved.has(e.id));
    const resolvingNow = chain.filter((e) => e.resolutionId && !this.resolved.has(e.id));
    this.chainTop = Math.max(this.chainTop, ...chain.map((e) => e.link), ...previous.map((e) => e.link));
    const shownChain = this.chainTop >= 2;
    const resolvedLinks = [...gone, ...resolvingNow].sort((a, b) => b.link - a.link);
    resolvedLinks.forEach((e) => this.resolved.add(e.id));
    // Link 1 alone joins and resolves without a word
    const joined = added.filter((e) => e.link >= 2);
    const shownResolved = shownChain ? resolvedLinks : [];
    if (!chain.length) {
      this.resolved.clear();
      this.chainTop = 0;
    }
    // The chain starts resolving (a link resolves for the first time): said once per chain
    const firstOfAny = first ?? previous.find((e) => e.link === 1)?.id ?? null;
    const startsResolving = shownResolved.length > 0 && firstOfAny !== null && this.resolvingChain !== firstOfAny;
    if (startsResolving) this.resolvingChain = firstOfAny;
    if (!chain.length && !resolvedLinks.length) this.resolvingChain = null;
    if ((!joined.length && !shownResolved.length) || !state || this.animations.off()) return;
    const me = this.game.myState()?.userId;
    // A link's card, from the chain as it is or as it was (a link already resolved has left it)
    const known = [...chain, ...previous];
    const card = (link: number) => {
      const e = known.find((c) => c.link === link);
      return e ? this.linkCard(state, e, me) : null;
    };
    for (const e of [...joined].sort((a, b) => a.link - b.link)) {
      this.queue.push({ kind: 'link', mode: 'join', id: ++this.ids, label: e.label, mine: e.controllerId === me, ...this.stage(e.link, card) });
    }
    if (startsResolving) this.queue.push({ kind: 'resolution', id: ++this.ids, links: Math.max(...shownResolved.map((e) => e.link), chain.length) });
    for (const e of shownResolved) {
      this.queue.push({ kind: 'link', mode: 'resolve', id: ++this.ids, label: e.label, mine: e.controllerId === me, ...this.stage(e.link, card, true) });
    }
    // The choices wait until all of them have been shown
    this.release ??= this.animations.begin();
    if (!this.current()) this.next();
  }

  /**
   * The stage when link `link` joins (or resolves): it and the two before it, where they were before, and the one
   * that leaves.
   */
  private stage(link: number, card: (link: number) => LinkCard | null, resolving = false): Pick<Link, 'card' | 'cards' | 'chains' | 'leaving'> {
    const range = (to: number) => [to - 2, to - 1, to].filter((l) => l >= 1 && card(l));
    const now = layout(range(link));
    // Resolving, nothing moves: the stage is as it stands
    const before = resolving ? now : layout(range(link - 1));
    const cards: Placed[] = range(link).map((l) => {
      const at = now.get(l)!;
      const was = before.get(l) ?? at;
      return { ...card(l)!, ...at, fromX: was.x - at.x, fromY: was.y - at.y, fromTilt: was.tilt, isNew: l === link };
    });
    const chains: ChainBar[] = cards.slice(1).map((c, i) => {
      const from = cards[i];
      const dx = c.x - from.x;
      const dy = c.y - from.y;
      return { x: from.x, y: from.y, length: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI, isNew: c.isNew };
    });
    const gone = link - 3;
    const leavingAt = resolving ? undefined : before.get(gone);
    const leavingCard = gone >= 1 ? card(gone) : null;
    const leaving: Placed | null =
      leavingAt && leavingCard ? { ...leavingCard, ...leavingAt, fromX: 0, fromY: 0, fromTilt: leavingAt.tilt, isNew: false } : null;
    return { card: cards[cards.length - 1], cards, chains, leaving };
  }

  private linkCard(state: GameState, e: PendingEffect, me: string | undefined): LinkCard {
    const slot = this.find(state, e.sourceInstanceId);
    const imageUrl = slot?.imageUrl ?? this.cards.cards().find((c) => c.name === e.sourceName)?.image_url ?? null;
    return { imageUrl, name: e.sourceName, link: e.link, mine: e.controllerId === me };
  }

  /** A card anywhere on the table, attached ones too. */
  private find(state: GameState, id: string): CardSlot | null {
    for (const p of Object.values(state.players ?? {})) {
      for (const c of [...p.field, ...p.hand, ...p.tributeZone, ...p.discardPile, ...p.lifeStack, ...p.deck]) {
        if (c.instanceId === id) return c;
        const attached = [...c.materials, ...c.resources].find((a) => a.instanceId === id);
        if (attached) return attached;
      }
    }
    return null;
  }

  private next(): void {
    const item = this.queue.shift() ?? null;
    this.current.set(item);
    if (item) {
      this.timer = setTimeout(() => this.next(), item.kind === 'resolution' ? RESOLUTION_MS : SHOW_MS);
      return;
    }
    this.timer = null;
    this.release?.();
    this.release = null;
  }
}
