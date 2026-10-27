import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
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

type Section = 'definitions' | 'cards' | 'resources' | 'board';

const ZONES: PlaymatZone[] = [
  { number: 1, name: 'Vidas', area: 'lives' },
  { number: 2, name: 'Línea frontal', area: 'front' },
  { number: 3, name: 'Retaguardia', area: 'back' },
  { number: 4, name: 'Mazo', area: 'deck' },
  { number: 5, name: 'Tributos', area: 'tributes' },
  { number: 6, name: 'Descarte', area: 'discard' },
  { number: 7, name: 'Gemas', area: 'gems' },
];

/** "Aprender a jugar": rules summary, card types, gem simulator and the play mat. */
@Component({
  selector: 'eras-ruling-page',
  imports: [PageComponent, TabsComponent, ProseComponent, CardComponent, GridComponent, StackComponent, FormFieldComponent, AlertComponent, ButtonComponent, GemTrackComponent, PlaymatComponent],
  templateUrl: './ruling.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulingPage {
  protected readonly sections = [
    { key: 'definitions', label: 'Definiciones' },
    { key: 'cards', label: 'Tipos de carta' },
    { key: 'resources', label: 'Recursos' },
    { key: 'board', label: 'Zonas de juego' },
  ];
  protected readonly section = signal<Section>('definitions');
  protected readonly zones = ZONES;

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
