import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, input } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { CardSlot } from '@data/simulator/simulator.model';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { effectLines, matchingLine } from './card-effect-lines';

/**
 * Beside a choice, the card it is about: big, with its effects written out, and the effect that asks lit up in
 * cyan. The choice below then only says what to do and shows the cards to pick.
 */
@Component({
  selector: 'eras-effect-card-panel',
  imports: [IconComponent],
  template: `
    @if (imageUrl()) {
      <img class="art" [src]="imageUrl()" [alt]="name()" draggable="false" />
    }
    @if (facts().length) {
      <div class="facts">
        @for (f of facts(); track f.label) {
          <span class="fact"><small>{{ f.label }}</small><strong>{{ f.value }}</strong></span>
        }
      </div>
    }
    @if (lines().length) {
      <ul class="effects" aria-label="Efectos de la carta">
        @for (line of lines(); track $index) {
          <li class="effect" [class.active]="$index === active()" [attr.aria-current]="$index === active() ? 'true' : null">
            @if (line.moment || line.tags.length) {
              <span class="chips">
                @if ($index === active()) {
                  <span class="chip now"><eras-icon name="zap" /> Se activa</span>
                }
                @if (line.moment) {
                  <span class="chip moment">{{ line.moment }}</span>
                }
                @for (t of line.tags; track $index) {
                  <span class="chip">{{ t }}</span>
                }
              </span>
            }
            <span class="text">{{ line.text }}</span>
          </li>
        }
      </ul>
    } @else if (fallbackText()) {
      <!-- No card data (yet): the effect's own text -->
      <p class="effect active"><span class="text">{{ fallbackText() }}</span></p>
    }
  `,
  styles: `
    :host {
      --panel-cyan: #38bdf8;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      inline-size: var(--effect-panel-width, 18rem);
      max-block-size: 100%;
      padding: var(--space-3);
      overflow-y: auto;
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--color-surface) 94%, transparent);
      box-shadow: var(--shadow-lg);
      color: var(--color-text);
      scrollbar-width: thin;
    }
    .art {
      display: block;
      inline-size: 100%;
      aspect-ratio: 63 / 88;
      border-radius: var(--radius-md);
      object-fit: cover;
      box-shadow: 0 8px 22px rgb(0 0 0 / 45%);
    }
    .facts { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .fact {
      display: inline-flex;
      align-items: baseline;
      gap: var(--space-1);
      padding: 0.125rem var(--space-2);
      border-radius: var(--radius-pill);
      background: var(--color-surface-muted);
      font-size: var(--font-size-xs);
    }
    .fact small { color: var(--color-text-muted); }
    .effects { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
    .effect {
      display: grid;
      gap: var(--space-1);
      margin: 0;
      padding: var(--space-2);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      font-size: var(--font-size-sm);
      line-height: 1.45;
      transition: background var(--duration-fast, 120ms) ease, box-shadow var(--duration-fast, 120ms) ease;
    }
    /* The effect that asks: cyan, as the game marks what is activating */
    .effect.active {
      background: color-mix(in srgb, var(--panel-cyan) 18%, var(--color-surface));
      box-shadow: inset 3px 0 0 var(--panel-cyan), 0 0 14px color-mix(in srgb, var(--panel-cyan) 35%, transparent);
    }
    .chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0 var(--space-2);
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
    }
    .chip.moment { color: var(--color-text); }
    .chip.now { background: var(--panel-cyan); color: #04202e; }
    .chip eras-icon { inline-size: 0.8rem; block-size: 0.8rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectCardPanelComponent {
  private readonly cards = inject(CardsStore);
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

  /** The card on the table, when it is there (its live numbers); else it is found in the catalog by its name. */
  readonly slot = input<CardSlot | null>(null);
  readonly name = input<string>('');
  readonly image = input<string | null | undefined>(null);
  /** The text of the effect that asks, lit up among the card's effects. */
  readonly activeText = input<string | null | undefined>(null);

  private readonly catalog = computed(() => {
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

  protected readonly facts = computed(() => {
    const s = this.slot();
    const facts: { label: string; value: string }[] = [];
    if (!s) return facts;
    if (s.level != null) facts.push({ label: 'Nivel', value: String(s.level) });
    if (s.cost != null) facts.push({ label: 'Coste', value: String(s.cost) });
    if (s.strength != null) facts.push({ label: 'Fuerza', value: String(s.strength) });
    return facts;
  });

  constructor() {
    // The lit effect in view, on a card with many effects
    afterRenderEffect(() => {
      if (this.active() < 0) return;
      this.host.querySelector('.effect.active')?.scrollIntoView({ block: 'nearest' });
    });
  }
}
