import { DOCUMENT } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, afterRenderEffect, computed, effect, inject } from '@angular/core';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { pileOf } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { ZoneName } from '@data/simulator/simulator.model';
import { pile, tableCard } from './board-dom';
import { LAYER } from './timing';

/** The class of a card lit by the open choice (its glow, global styles). */
const SPOTLIT = 'eras-spotlit';
/** Room around a lit card in the backdrop's hole (its glow shows there). */
const HOLE_PAD = 10;

function clearMask(el: HTMLElement): void {
  for (const p of ['mask-image', 'mask-size', 'mask-position', 'mask-repeat', 'mask-composite']) {
    el.style.removeProperty(p);
    el.style.removeProperty(`-webkit-${p}`);
  }
}

/** The piles a choice's card is looked for in, when it is not on the table. */
const ZONES: ZoneName[] = ['hand', 'tributeZone', 'discardPile', 'lifeStack', 'deck'];

/**
 * While one of my choices is open, the card whose effect it belongs to stays lit where it is: the choice's backdrop
 * leaves a hole over it and it glows, so it is the visual reference of what the choice is about while the table keeps
 * its own heights (your hand stays over it). A card that is not on the field lights up its pile (Tributos, Descarte…).
 * The chain panel is drawn again above the backdrop (inside the choice's own overlay, in the browser's top layer, where
 * no z-index reaches): it is the reference of the effect. A modal opened over the choice covers both.
 */
@Component({
  selector: 'eras-prompt-spotlight',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptSpotlightComponent {
  private readonly game = inject(GameStore);
  private readonly document = inject(DOCUMENT);
  private readonly overlays = inject(OverlayContainer);
  private readonly layer = this.createLayer();
  private readonly seeThrough = inject(SheetState).seeThrough;

  /** The cards the open choice is about: the effect's card, else the cards whose effects are offered. */
  private readonly ids = computed<string[]>(() => {
    const prompt = this.game.myPrompt();
    if (!prompt) return [];
    const effect = prompt.effectId ? this.game.state()?.chain?.find((e) => e.id === prompt.effectId) : null;
    if (effect) return [effect.sourceInstanceId];
    if (prompt.effects?.length) return [...new Set(prompt.effects.map((e) => e.sourceId))];
    return prompt.subjectId ? [prompt.subjectId] : [];
  });

  constructor() {
    // Drawn again on every update (cards move) and when the window changes size
    const draw = () => {
      this.game.state();
      this.draw(this.ids());
    };
    afterRenderEffect({ write: draw });
    // "Ver la mesa": the chain's copy turns transparent with the chain itself
    effect(() => {
      const through = this.seeThrough();
      this.layer.querySelectorAll<HTMLElement>('[data-chain-copy]').forEach((c) => (c.style.opacity = through ? '0.12' : ''));
    });
    const view = this.document.defaultView;
    view?.addEventListener('resize', draw);
    // The chain panel changes size (a link more, the sheet opening shrinks its box) or scrolls: its copy follows
    const resize = new ResizeObserver(draw);
    const watchChain = () => {
      // Again on every update: the panel comes and goes with the chain
      this.game.state();
      resize.disconnect();
      const chain = this.document.querySelector('.chain-panel');
      if (chain) resize.observe(chain);
      if (chain?.parentElement) resize.observe(chain.parentElement);
    };
    afterRenderEffect({ read: watchChain });
    this.document.addEventListener('scroll', draw, { capture: true, passive: true });
    // The choice opens a moment after the update: draw again when an overlay opens or closes
    const observer = new MutationObserver((changes) => {
      // Not its own copies
      const outside = (c: MutationRecord) => !this.layer.contains(c.target) && [...c.addedNodes, ...c.removedNodes].some((n) => n !== this.layer);
      if (changes.some(outside)) draw();
    });
    observer.observe(this.overlays.getContainerElement(), { childList: true, subtree: true });
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      resize.disconnect();
      view?.removeEventListener('resize', draw);
      this.document.removeEventListener('scroll', draw, { capture: true });
      this.showChain(null);
      this.light([], null);
      this.layer.remove();
    });
  }

  private createLayer(): HTMLElement {
    const layer = this.document.createElement('div');
    layer.className = 'eras-prompt-spotlight';
    Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: LAYER.spotlight, pointerEvents: 'none' });
    return layer;
  }

  /** The cards lit last time, and the backdrop holed for them. */
  private lit: HTMLElement[] = [];
  private holed: HTMLElement | null = null;

  /**
   * Lights these cards where they are: a glow on each, and a hole in the choice's backdrop over each (a mask: the
   * backdrop still takes the clicks there), so nothing covers them but what the table itself draws over them.
   */
  private light(cards: HTMLElement[], backdrop: HTMLElement | null): void {
    for (const c of this.lit) if (!cards.includes(c)) c.classList.remove(SPOTLIT);
    for (const c of cards) c.classList.add(SPOTLIT);
    this.lit = cards;
    if (this.holed && this.holed !== backdrop) clearMask(this.holed);
    this.holed = backdrop;
    if (!backdrop) return;
    if (!cards.length) return clearMask(backdrop);
    const holes = cards.map((c) => c.getBoundingClientRect()).map((r) => ({
      x: r.left - HOLE_PAD,
      y: r.top - HOLE_PAD,
      w: r.width + 2 * HOLE_PAD,
      h: r.height + 2 * HOLE_PAD,
    }));
    const fill = 'linear-gradient(#000, #000)';
    const images = [fill, ...holes.map(() => fill)].join(', ');
    const sizes = ['100% 100%', ...holes.map((h) => `${h.w}px ${h.h}px`)].join(', ');
    const positions = ['0 0', ...holes.map((h) => `${h.x}px ${h.y}px`)].join(', ');
    Object.assign(backdrop.style, {
      maskImage: images,
      maskSize: sizes,
      maskPosition: positions,
      maskRepeat: 'no-repeat',
      maskComposite: 'exclude',
    });
    backdrop.style.setProperty('-webkit-mask-image', images);
    backdrop.style.setProperty('-webkit-mask-size', sizes);
    backdrop.style.setProperty('-webkit-mask-position', positions);
    backdrop.style.setProperty('-webkit-mask-repeat', 'no-repeat');
    backdrop.style.setProperty('-webkit-mask-composite', 'xor');
  }

  /** The chain panel itself is hidden while its copy stands in for it, so the two are never seen out of step. */
  private hiddenChain: HTMLElement | null = null;
  private showChain(chain: HTMLElement | null): void {
    if (this.hiddenChain && this.hiddenChain !== chain) this.hiddenChain.style.visibility = '';
    this.hiddenChain = chain;
    if (chain) chain.style.visibility = 'hidden';
  }

  /** What the copies were drawn from last time: the same state, cards and places draw nothing new. */
  private drawnState: unknown = null;
  private drawnKey = '';

  private draw(ids: string[]): void {
    // Inside the choice's overlay (not a modal opened over it), right before its pane: above its backdrop, below the choice
    const pane = this.choicePane();
    if (!ids.length || !pane?.parentElement) {
      this.layer.replaceChildren();
      this.drawnKey = '';
      this.showChain(null);
      this.light([], null);
      this.layer.remove();
      return;
    }
    // A choice changing inside (a card picked) does not redraw the copies: drawn again, their marks would flash in again
    const state = this.game.state();
    const chainPanel = this.document.querySelector<HTMLElement>('.chain-panel');
    const place = (e: Element | null | undefined) => {
      const r = e?.getBoundingClientRect();
      return r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : '-';
    };
    const key = [ids.join(','), ...ids.map((id) => place(this.elementOf(id))), place(chainPanel), place(chainPanel?.parentElement)].join('|');
    if (state === this.drawnState && key === this.drawnKey && this.layer.nextSibling === pane) return;
    this.drawnState = state;
    this.drawnKey = key;
    this.layer.replaceChildren();
    if (this.layer.nextSibling !== pane) pane.parentElement.insertBefore(this.layer, pane);
    const chain = this.document.querySelector<HTMLElement>('.chain-panel');
    this.showChain(null);
    if (chain) this.layer.append(this.chainCopy(chain));
    this.showChain(chain);
    // The cards themselves, where they are (no copy): the choice's backdrop leaves a hole over each one, so the table keeps
    // its own heights (your hand over it) and the card is not darkened; a glow marks it
    const backdrop = pane.parentElement.querySelector<HTMLElement>(':scope > .cdk-overlay-backdrop');
    this.light(ids.map((id) => this.elementOf(id)).filter((e): e is HTMLElement => !!e), backdrop);
    // A copy is the card as it already is: its entry animations (a chain mark landing) are not played again
    for (const animation of this.layer.getAnimations?.({ subtree: true }) ?? []) {
      if (Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity)) animation.finish();
    }
  }

  /**
   * The chain panel's copy, cut to the part of it in view: its box (the notices column) scrolls and shrinks while a
   * sheet is open, so the copy sits in a frame of that box's size and position.
   */
  private chainCopy(chain: HTMLElement): HTMLElement {
    const box = (chain.parentElement ?? chain).getBoundingClientRect();
    const rect = chain.getBoundingClientRect();
    const frame = this.document.createElement('div');
    frame.dataset['chainCopy'] = '';
    Object.assign(frame.style, {
      position: 'fixed',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      overflow: 'hidden',
      transition: 'opacity 120ms ease',
      opacity: this.seeThrough() ? '0.12' : '',
    });
    const copy = chain.cloneNode(true) as HTMLElement;
    copy.removeAttribute('id');
    Object.assign(copy.style, {
      position: 'absolute',
      margin: '0',
      visibility: 'visible',
      left: `${rect.left - box.left}px`,
      top: `${rect.top - box.top}px`,
      width: `${chain.offsetWidth}px`,
    });
    frame.append(copy);
    return frame;
  }

  /** The pane of the open choice's sheet (the engine's choice), else of the last sheet open; null when none. */
  private choicePane(): Element | null {
    const container = this.overlays.getContainerElement();
    const choice = container.querySelector('eras-effect-prompt-dialog')?.closest('.cdk-overlay-pane');
    if (choice) return choice;
    const sheets = [...container.querySelectorAll(':scope > .cdk-global-overlay-wrapper')].filter((w) => w.querySelector(':scope > .eras-sheet-backdrop'));
    return sheets.at(-1)?.querySelector(':scope > .cdk-overlay-pane') ?? null;
  }

  /** The card on the field, or the pile it is in. */
  private elementOf(id: string): HTMLElement | null {
    // A revealed life waiting on its lives (Reforzar, play it): there, though the state keeps it in the hand
    const parked = this.document.querySelector<HTMLElement>(`[data-parked-life="${CSS.escape(id)}"]`);
    if (parked) return parked;
    // A card of the field, or of a hand (the card itself, not the whole hand)
    const card = tableCard(this.document, id);
    if (card) return card;
    const where = pileOf(this.game.state(), id, ZONES);
    return where ? pile(this.document, where.ownerId, where.zone) : null;
  }
}
