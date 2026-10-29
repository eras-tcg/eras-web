import { DOCUMENT } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, afterRenderEffect, computed, effect, inject } from '@angular/core';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';

const ZONES: ZoneName[] = ['field', 'hand', 'tributeZone', 'discardPile', 'lifeStack', 'deck'];

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
    // The choice opens a moment after the update: draw again when an overlay opens or closes
    const observer = new MutationObserver((changes) => {
      // Not its own copies
      const outside = (c: MutationRecord) => !this.layer.contains(c.target) && [...c.addedNodes, ...c.removedNodes].some((n) => n !== this.layer);
      if (changes.some(outside)) draw();
    });
    observer.observe(this.overlays.getContainerElement(), { childList: true, subtree: true });
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      view?.removeEventListener('resize', draw);
      this.layer.remove();
    });
  }

  private createLayer(): HTMLElement {
    const layer = this.document.createElement('div');
    layer.className = 'eras-prompt-spotlight';
    Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '1000', pointerEvents: 'none' });
    return layer;
  }

  private draw(ids: string[]): void {
    this.layer.replaceChildren();
    // Inside the last overlay (the choice), right before its pane: above its backdrop, below the choice
    const wrappers = this.overlays.getContainerElement().querySelectorAll(':scope > .cdk-global-overlay-wrapper');
    const pane = wrappers.item(wrappers.length - 1)?.querySelector(':scope > .cdk-overlay-pane');
    if (!ids.length || !pane?.parentElement) {
      this.layer.remove();
      return;
    }
    if (this.layer.nextSibling !== pane) pane.parentElement.insertBefore(this.layer, pane);
    const chain = this.document.querySelector<HTMLElement>('.chain-panel');
    for (const element of [...ids.map((id) => this.elementOf(id)), chain]) {
      if (!element) continue;
      const card = element !== chain;
      const rect = element.getBoundingClientRect();
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const copy = element.cloneNode(true) as HTMLElement;
      copy.removeAttribute('id');
      copy.style.position = 'fixed';
      copy.style.margin = '0';
      if (!card) {
        copy.dataset['chainCopy'] = '';
        copy.style.transition = 'opacity 120ms ease';
        if (this.seeThrough()) copy.style.opacity = '0.12';
      }
      if (card) copy.style.filter = 'drop-shadow(0 0 6px color-mix(in srgb, var(--color-sim-glow) 95%, transparent)) drop-shadow(0 0 14px color-mix(in srgb, var(--color-sim-glow) 70%, transparent))';
      // The size the card takes from where it is
      copy.style.setProperty('--game-card-width', getComputedStyle(element).getPropertyValue('--game-card-width'));
      copy.style.width = `${width}px`;
      copy.style.height = `${height}px`;
      // Centered where the card is (its own transform, like exhausted, is kept by its classes)
      copy.style.left = `${rect.left + rect.width / 2 - width / 2}px`;
      copy.style.top = `${rect.top + rect.height / 2 - height / 2}px`;
      this.layer.append(copy);
    }
  }

  /** The card on the field, or the pile it is in. */
  private elementOf(id: string): HTMLElement | null {
    const card = this.document.querySelector<HTMLElement>(`[data-instance-id="${id}"] eras-game-card`);
    if (card) return card;
    for (const p of Object.values(this.game.state()?.players ?? {})) {
      for (const zone of ZONES) {
        if (!(p[zone] as CardSlot[]).some((c) => c.instanceId === id)) continue;
        return this.document.querySelector<HTMLElement>(`[data-pile="${p.userId}:${zone}"]`);
      }
    }
    return null;
  }
}
