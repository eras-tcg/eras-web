import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GemState, INITIAL_GEMS, excess, gemTrack, nextTurn, remaining, spend, spendLimit } from '@data/rules/gems';
import { GemTrackComponent } from '@ui/domain/gem-track/gem-track.component';
import { PlaymatComponent, PlaymatZone } from '@ui/domain/playmat/playmat.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ProseComponent } from '@ui/layout/prose/prose.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { TabsComponent } from '@ui/surfaces/tabs/tabs.component';

type Section = 'basics' | 'setup' | 'board' | 'turn' | 'resources' | 'combat' | 'cards' | 'keywords';

const ZONES: PlaymatZone[] = [
  { number: 1, name: 'Vidas', area: 'lives' },
  { number: 2, name: 'Línea frontal', area: 'front' },
  { number: 3, name: 'Retaguardia', area: 'back' },
  { number: 4, name: 'Mazo', area: 'deck' },
  { number: 5, name: 'Tributos', area: 'tributes' },
  { number: 6, name: 'Descarte', area: 'discard' },
  { number: 7, name: 'Gemas', area: 'gems' },
];

/** "Cómo jugar": a friendly guide to a first game (not the full rules), the gem simulator, the play mat and the keywords. */
@Component({
  selector: 'eras-ruling-page',
  imports: [PageComponent, TabsComponent, ProseComponent, CardComponent, GridComponent, StackComponent, FormFieldComponent, AlertComponent, ButtonComponent, GemTrackComponent, PlaymatComponent],
  templateUrl: './ruling.page.html',
  styles: `
    .keywords { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-2) var(--space-4); }
    .keywords dt { font-weight: var(--font-weight-bold); }
    .keywords dd { margin: 0; }
    @media (max-width: 40rem) { .keywords { grid-template-columns: 1fr; } .keywords dd { margin-block-end: var(--space-2); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulingPage {
  protected readonly sections = [
    { key: 'basics', label: 'En un minuto' },
    { key: 'setup', label: 'Tu mazo' },
    { key: 'board', label: 'La mesa' },
    { key: 'turn', label: 'Tu turno' },
    { key: 'resources', label: 'Gemas' },
    { key: 'combat', label: 'Atacar' },
    { key: 'cards', label: 'Cartas y efectos' },
    { key: 'keywords', label: 'Habilidades' },
  ];
  protected readonly section = signal<Section>('basics');
  protected readonly zones = ZONES;
  private readonly cards = inject(CardsStore);
  protected readonly cardsLoading = this.cards.loading;

  /** Keyword abilities from the reference data (one per name: "Provocar" and "Provocar {nivel}" both listed). */
  protected readonly keywords = computed(() =>
    Object.entries(this.cards.ref()?.keywordEffects ?? {})
      .map(([name, k]) => ({ name, text: (k?.displayText ?? k?.description ?? '').replace(/^<[^>]*>\s*/, '') }))
      .filter((k) => k.text)
      .map((k) => ({ ...k, text: k.text.charAt(0).toUpperCase() + k.text.slice(1) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  );

  constructor() {
    void this.cards.load();
  }

  // ── Gem simulator ─────────────────────────────────────────────────────
  protected readonly gems = signal<GemState>(INITIAL_GEMS);
  protected readonly amount = signal(0);
  protected readonly spendError = signal<string | null>(null);
  protected readonly turnMessage = signal<string | null>(null);
  protected readonly track = computed(() => gemTrack(this.gems()));
  protected readonly limit = computed(() => spendLimit(this.gems()));
  protected readonly left = computed(() => remaining(this.gems()));
  protected readonly cannotAttack = computed(() => excess(this.gems()) > 0);

  protected doSpend(): void {
    const { state, error } = spend(this.gems(), this.amount());
    this.spendError.set(error);
    this.turnMessage.set(null);
    this.gems.set(state);
    if (!error) this.amount.set(0);
  }

  protected doNextTurn(): void {
    const { state, message } = nextTurn(this.gems());
    this.gems.set(state);
    this.turnMessage.set(message);
    this.spendError.set(null);
  }

  protected reset(): void {
    this.gems.set(INITIAL_GEMS);
    this.turnMessage.set(null);
    this.spendError.set(null);
  }
}
