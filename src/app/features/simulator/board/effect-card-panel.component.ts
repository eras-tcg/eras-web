import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, computed, inject, input } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot } from '@data/simulator/simulator.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { openCardDetailDialog } from '../../cards/card-detail-dialog/card-detail-dialog.component';
import { openCardDetail } from './card-peek.component';
import { holdToPeek } from './hold-peek';
import { CardFactsComponent } from '@ui/domain/card-facts/card-facts.component';
import { EffectLineComponent } from '@ui/domain/effect-line/effect-line.component';
import { effectLines, matchingLine } from './card-effect-lines';
import { slotFacts } from './slot-facts';

/**
 * Beside a choice, the card it is about: big, with its effects written out (`eras-effect-line`), and the effect that
 * asks lit up in the activating color (`--color-sim-effect-active`). The choice below then only says what to do and shows the cards to pick. Held pressed anywhere on the panel, the
 * card opens in detail, as any card listed in a choice.
 */
@Component({
  selector: 'eras-effect-card-panel',
  imports: [EffectLineComponent, CardFactsComponent],
  template: `
    @if (imageUrl()) {
      <img class="art" [src]="imageUrl()" [alt]="name()" draggable="false" />
    }
    @if (facts().length) {
      <eras-card-facts compact [facts]="facts()" />
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
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      inline-size: var(--effect-panel-width, 18rem);
      max-block-size: 100%;
      padding: var(--space-3);
      overflow-y: auto;
      overscroll-behavior: none;
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--color-surface) 94%, transparent);
      box-shadow: var(--shadow-lg);
      color: var(--color-text);
      scrollbar-width: thin;
    }
    .art {
      display: block;
      cursor: zoom-in;
      -webkit-touch-callout: none;
      inline-size: 100%;
      aspect-ratio: 63 / 88;
      border-radius: var(--radius-md);
      object-fit: cover;
      box-shadow: 0 8px 22px rgb(0 0 0 / 45%);
    }
    .effects { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
    .effect {
      margin: 0;
      padding: var(--space-2);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      font-size: var(--font-size-sm);
      transition: background var(--duration-fast, 120ms) ease, box-shadow var(--duration-fast, 120ms) ease;
    }
    /* The effect that asks: in the color the game marks what is activating */
    .effect.active {
      background: color-mix(in srgb, var(--color-sim-effect-active) 18%, var(--color-surface));
      box-shadow: inset 3px 0 0 var(--color-sim-effect-active), 0 0 14px color-mix(in srgb, var(--color-sim-effect-active) 35%, transparent);
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

  /** Its numbers as in the card info (the strength as it is now on the table). */
  protected readonly facts = computed(() => {
    const s = this.slot();
    const onField = !!s && Object.values(this.game.state()?.players ?? {}).some((p) => p.field.some((c) => c.instanceId === s.instanceId));
    return slotFacts(s, { onField });
  });

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
