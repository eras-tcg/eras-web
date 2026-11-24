import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, computed, inject, input } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZONES, ZoneName } from '@data/simulator/simulator.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { openCardDetailDialog } from '../../cards/card-detail-dialog/card-detail-dialog.component';
import { openCardDetail } from './card-peek.component';
import { holdToPeek } from './hold-peek';
import { EffectLineComponent } from '@ui/domain/effect-line/effect-line.component';
import { effectLines, matchingLine } from './card-effect-lines';
import { CardSheetComponent } from './card-sheet.component';
import { CardBackFrameComponent } from '@ui/surfaces/card-back-frame/card-back-frame.component';
import { CardFaceComponent } from '@ui/domain/card-face/card-face.component';

/**
 * Beside the board, a card: on the table, as it is now (CardSheet: with its Materiales and Recursos, then every effect
 * it has, its Recursos' too); else big from the catalog with its effects written out. The effect that asks is lit up
 * in the activating color (`--color-sim-effect-active`), wherever it comes from. Beside a choice (the choice then only
 * says what to do and shows the cards to pick), or for a card clicked on the table. Held pressed, the card opens in
 * detail, as any card listed in a choice.
 */
@Component({
  selector: 'eras-effect-card-panel',
  imports: [EffectLineComponent, CardSheetComponent, CardFaceComponent, CardBackFrameComponent],
  template: `
    <eras-card-back-frame notches="none" />
    <div class="scroll">
    @if (onTable(); as t) {
      <eras-card-sheet column [slot]="t.slot" [zone]="t.zone" [opponent]="t.opponent" [activeText]="activeText()" />
    } @else {
    @if (imageUrl()) {
      <eras-card-face class="art" [src]="imageUrl()" [alt]="name()" eager />
    }
    @if (lines().length) {
      <ul class="effects" aria-label="Efectos de la carta">
        @for (line of lines(); track $index) {
          <li class="effect" [class.active]="$index === active()" [attr.aria-current]="$index === active() ? 'true' : null">
            <eras-effect-line [moment]="line.moment" [tags]="line.tags" [text]="line.text" [activeLabel]="$index === active() ? 'Se activa' : null" />
          </li>
        }
      </ul>
    } @else if (fallbackText(); as text) {
      <!-- No card data (yet): the effect's own text -->
      <div class="effect active"><eras-effect-line [text]="text" /></div>
    }
    }
    </div>
  `,
  styles: `
    @use 'mixins/cut-corners';

    /* In the card back's frame, its bevelled corners only (a side panel: no notch); the content scrolls inside it */
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      inline-size: var(--effect-panel-width, 18rem);
      max-block-size: 100%;
      filter: drop-shadow(0 8px 24px rgb(0 0 0 / 45%));
      isolation: isolate;
      color: var(--color-text);
    }
    /* Clear of the bevelled corners (the scrollbar too: the system's, never past the frame), and what scrolls fades out
       before the edges instead of being cut by them; at rest both fades lie on the padding */
    .scroll {
      --panel-fade: var(--space-5);

      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-block-size: 0;
      margin: var(--space-3) var(--space-1) var(--space-3) 0;
      padding: var(--space-2) var(--space-2) var(--panel-fade) var(--space-3);
      overflow: hidden auto;
      overscroll-behavior: none;
      mask-image: linear-gradient(
        to bottom,
        transparent,
        #000 var(--space-2),
        #000 calc(100% - var(--panel-fade)),
        transparent
      );
    }
    /* As wide as the scroll's content: the panel less its padding, its margin and the scrollbar (10px, the system's) */
    eras-card-sheet {
      --card-sheet-width: calc(var(--effect-panel-width, 18rem) - var(--space-3) - var(--space-2) - var(--space-1) - 10px);
    }
    .art {
      display: block;
      cursor: zoom-in;
      -webkit-touch-callout: none;
      inline-size: 100%;
      box-shadow: 0 8px 22px rgb(0 0 0 / 45%);
    }
    .effects { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
    /* Each effect in the game's cut, as the buttons; the one that asks lit in the activating color, its light from the
       left, breathing slowly */
    .effect {
      @include cut-corners.cut-corners(0.6rem, var(--color-surface-muted), var(--color-border));

      margin: 0;
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-sm);
    }
    .effect.active {
      @include cut-corners.cut-corners(
        0.6rem,
        linear-gradient(
          90deg,
          color-mix(in srgb, var(--color-sim-effect-active) 34%, var(--color-surface)),
          color-mix(in srgb, var(--color-sim-effect-active) 10%, var(--color-surface)) 70%
        ),
        var(--color-sim-effect-active),
        1.5px
      );

      animation: effect-active-breathe 2.4s ease-in-out infinite;
    }
    @keyframes effect-active-breathe {
      50% {
        filter: brightness(1.18);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .effect.active {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectCardPanelComponent {
  private readonly cards = inject(CardsStore);
  private readonly game = inject(GameStore);
  private readonly modal = inject(ModalService);
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

  /** The card on the table, when it is there (its live numbers); else it is found in the catalog by its name. */
  readonly slot = input<CardSlot | null>(null);
  readonly name = input<string>('');
  readonly image = input<string | null | undefined>(null);
  /** The text of the effect that asks, lit up among the card's effects. */
  readonly activeText = input<string | null | undefined>(null);

  /** The card where it is on the table now (live), with its zone and whose it is; null when it is not there. */
  protected readonly onTable = computed<{ slot: CardSlot; zone: ZoneName; opponent: boolean } | null>(() => {
    const id = this.slot()?.instanceId;
    if (!id) return null;
    for (const opponent of [false, true]) {
      const player = opponent ? this.game.opponentState() : this.game.myState();
      for (const zone of ZONES) {
        if (zone === 'deck') continue;
        const slot = player?.[zone].find((c) => c.instanceId === id);
        if (slot) return { slot, zone, opponent };
      }
    }
    return null;
  });

  protected readonly catalog = computed(() => {
    const id = this.slot()?.cardId;
    const all = this.cards.cards();
    return (id ? all.find((c) => c.id === id) : null) ?? all.find((c) => c.name === this.name()) ?? null;
  });
  protected readonly imageUrl = computed(() => this.image() || this.slot()?.imageUrl || this.catalog()?.image_url || null);
  protected readonly lines = computed(() => {
    const meta = this.catalog()?.meta;
    return effectLines(meta?.effects, meta?.keywordEffects, this.cards.ref());
  });
  protected readonly active = computed(() => matchingLine(this.lines(), this.activeText()));
  /** When the card's effects are not known, the effect's text alone. */
  protected readonly fallbackText = computed(() => this.activeText() ?? null);

  /** The card in detail: as it is on the table, else from the catalog. */
  protected openDetail(): void {
    const slot = this.slot();
    if (slot) {
      openCardDetail(this.game, this.cards, this.modal, slot);
      return;
    }
    const catalog = this.catalog();
    if (catalog) openCardDetailDialog(this.modal, [catalog]);
  }

  constructor() {
    // Held pressed anywhere on it (its picture, numbers or effects): the card in detail
    inject(DestroyRef).onDestroy(holdToPeek(this.host, () => !!this.slot() || !!this.catalog(), () => this.openDetail()));
    // The lit effect in view, on a card with many effects
    afterRenderEffect(() => {
      if (this.active() < 0) return;
      this.host.querySelector('.effect.active')?.scrollIntoView({ block: 'nearest' });
    });
  }
}
