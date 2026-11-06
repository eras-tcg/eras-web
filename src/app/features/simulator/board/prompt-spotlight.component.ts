import { DOCUMENT } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, afterRenderEffect, computed, effect, inject } from '@angular/core';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { pileOf } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { ZoneName } from '@data/simulator/simulator.model';
import { poseFrames, poseOf, stageOf } from './card-pose';
import { pile, tableCard } from './board-dom';
import { tablePlane } from './table-plane';
import { LAYER } from './timing';

/** The piles a choice's card is looked for in, when it is not on the table. */
const ZONES: ZoneName[] = ['hand', 'tributeZone', 'discardPile', 'lifeStack', 'deck'];

/**
 * While one of my choices is open, the card whose effect it belongs to is drawn again above the choice's
 * backdrop, at the same place, so it is not darkened: it is the visual reference of what the choice is about.
 * A card that is not on the field lights up its pile (Tributos, Descarte…). The chain panel is drawn again too: it
 * is the reference of the effect. The overlays live in the browser's top layer (popovers), where no z-index
 * reaches, so the copies go inside the choice's overlay, between its backdrop and the choice itself.
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
      this.layer.remove();
    });
  }

  private createLayer(): HTMLElement {
    const layer = this.document.createElement('div');
    layer.className = 'eras-prompt-spotlight';
    Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: LAYER.spotlight, pointerEvents: 'none' });
    return layer;
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
    // Inside the last overlay (the choice), right before its pane: above its backdrop, below the choice
    const wrappers = this.overlays.getContainerElement().querySelectorAll(':scope > .cdk-global-overlay-wrapper');
    const pane = wrappers.item(wrappers.length - 1)?.querySelector(':scope > .cdk-overlay-pane');
    if (!ids.length || !pane?.parentElement) {
      this.layer.replaceChildren();
      this.drawnKey = '';
      this.showChain(null);
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
    for (const element of ids.map((id) => this.elementOf(id))) {
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const copy = element.cloneNode(true) as HTMLElement;
      copy.removeAttribute('id');
      copy.style.position = 'fixed';
      copy.style.margin = '0';
      copy.style.filter = 'drop-shadow(0 0 6px color-mix(in srgb, var(--color-sim-glow) 95%, transparent)) drop-shadow(0 0 14px color-mix(in srgb, var(--color-sim-glow) 70%, transparent))';
      // The size the card takes from where it is
      copy.style.setProperty('--game-card-width', getComputedStyle(element).getPropertyValue('--game-card-width'));
      copy.style.width = `${width}px`;
      copy.style.height = `${height}px`;
      // "Mesa en perspectiva": drawn as the table shows it, with its camera (leaning back, turned, the far side smaller)
      const plane = tablePlane(this.document);
      if (plane?.holds(element)) {
        this.layer.append(this.leaning(element, copy, width, height));
        continue;
      }
      // Centered where the card is (its own transform, like exhausted, is kept by its classes)
      copy.style.left = `${rect.left + rect.width / 2 - width / 2}px`;
      copy.style.top = `${rect.top + rect.height / 2 - height / 2}px`;
      this.layer.append(copy);
    }
    // A copy is the card as it already is: its entry animations (a chain mark landing) are not played again
    for (const animation of this.layer.getAnimations?.({ subtree: true }) ?? []) {
      if (Number.isFinite(animation.effect?.getComputedTiming().iterations ?? Infinity)) animation.finish();
    }
  }

  /**
   * A copy of a card on the leaning table, in its pose seen by the table's camera (as the cards flying between zones).
   * Its turn (exhausted, a hand's fan) is in the pose, so its own transform is replaced; a rival's card keeps its
   * faces turned by its class, so the pose does not turn it again.
   */
  private leaning(element: HTMLElement, copy: HTMLElement, width: number, height: number): HTMLElement {
    const stage = stageOf(this.document);
    const pose = poseOf(element);
    if (element.classList.contains('upside-down')) pose.turn -= 180;
    const frame = this.document.createElement('div');
    Object.assign(frame.style, {
      position: 'fixed',
      inset: '0',
      perspective: `${stage.distance}px`,
      perspectiveOrigin: `${stage.originX}px ${stage.originY}px`,
      pointerEvents: 'none',
    });
    Object.assign(copy.style, { position: 'absolute', left: '0px', top: '0px', width: `${width}px`, height: `${height}px`, transformOrigin: '50% 50%' });
    copy.style.transform = String(poseFrames(stage, pose, pose, { fromBack: false, toBack: false })[0]['transform']);
    frame.append(copy);
    return frame;
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

  /** The card on the field, or the pile it is in. */
  private elementOf(id: string): HTMLElement | null {
    // A card of the field, or of a hand (the card itself, not the whole hand)
    const card = tableCard(this.document, id);
    if (card) return card;
    const where = pileOf(this.game.state(), id, ZONES);
    return where ? pile(this.document, where.ownerId, where.zone) : null;
  }
}
