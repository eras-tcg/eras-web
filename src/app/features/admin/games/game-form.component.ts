import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Deck } from '@data/decks/deck.model';
import { Game, Life, PlayerEntry, Side } from '@data/games/games.model';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

const SIDES: Side[] = ['player1', 'player2'];

/** Fields of one game: both players (name, deck, remaining lives), winner, who started, duration and a comment. */
@Component({
  selector: 'eras-game-form',
  imports: [FormFieldComponent, GridComponent, StackComponent, CardComponent, ButtonComponent, ChipComponent, IconComponent],
  template: `
    <eras-stack [gap]="4">
      <eras-grid minColumn="18rem" [gap]="3">
        @for (side of sides; track side; let i = $index) {
          <eras-card padding="sm">
            <eras-stack [gap]="3">
              <strong>Jugador {{ i + 1 }}</strong>
              <eras-form-field label="Nombre">
                <input [value]="value()[side].playerName" (input)="setPlayer(side, { playerName: $any($event.target).value })" />
              </eras-form-field>
              <eras-form-field label="Mazo">
                <select (change)="setPlayer(side, { deckId: $any($event.target).value })">
                  <option value="" [selected]="!value()[side].deckId">Sin mazo</option>
                  @for (d of sortedDecks(); track d.id) {
                    <option [value]="d.id" [selected]="d.id === value()[side].deckId">{{ d.deckName }}</option>
                  }
                </select>
              </eras-form-field>
              <eras-stack [gap]="1">
                <span class="eras-form-field__text">Vidas al final ({{ value()[side].lives.length }})</span>
                <eras-stack direction="row" [gap]="1" wrap align="center">
                  @for (life of value()[side].lives; track $index; let li = $index) {
                    <button erasChip [selected]="life === 'up'" [attr.aria-label]="'Vida ' + (li + 1) + (life === 'up' ? ' boca arriba' : ' boca abajo') + ', clic para voltear'" (click)="flipLife(side, li)">
                      {{ life === 'up' ? '▲' : '▼' }}
                    </button>
                  }
                  <button erasButton variant="ghost" size="sm" type="button" (click)="addLife(side, 'up')">+ ▲</button>
                  <button erasButton variant="ghost" size="sm" type="button" (click)="addLife(side, 'down')">+ ▼</button>
                  @if (value()[side].lives.length) {
                    <button erasButton variant="ghost" size="sm" type="button" aria-label="Quitar la última vida" (click)="removeLife(side)"><eras-icon name="x" /></button>
                  }
                </eras-stack>
              </eras-stack>
            </eras-stack>
          </eras-card>
        }
      </eras-grid>

      <eras-grid minColumn="12rem" [gap]="3">
        <eras-stack [gap]="1">
          <span class="eras-form-field__text">Ganador</span>
          <eras-stack direction="row" [gap]="1">
            @for (side of sides; track side) {
              <button erasChip [selected]="value().winner === side" (click)="set('winner', side)">{{ label(side) }}</button>
            }
          </eras-stack>
        </eras-stack>
        <eras-stack [gap]="1">
          <span class="eras-form-field__text">Empezó</span>
          <eras-stack direction="row" [gap]="1">
            @for (side of sides; track side) {
              <button erasChip [selected]="value().firstPlayer === side" (click)="set('firstPlayer', side)">{{ label(side) }}</button>
            }
          </eras-stack>
        </eras-stack>
        <eras-stack direction="row" [gap]="2" align="end">
          <eras-form-field label="Minutos">
            <input type="number" min="0" [value]="minutes()" (input)="setDuration($any($event.target).valueAsNumber, seconds())" />
          </eras-form-field>
          <eras-form-field label="Segundos">
            <input type="number" min="0" max="59" [value]="seconds()" (input)="setDuration(minutes(), $any($event.target).valueAsNumber)" />
          </eras-form-field>
        </eras-stack>
      </eras-grid>

      <eras-form-field label="Comentario">
        <textarea rows="2" [value]="value().comment ?? ''" (input)="set('comment', $any($event.target).value)"></textarea>
      </eras-form-field>
    </eras-stack>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameFormComponent {
  readonly value = input.required<Game>();
  readonly decks = input<readonly Deck[]>([]);
  readonly valueChange = output<Game>();

  protected readonly sides = SIDES;
  protected readonly sortedDecks = computed(() => [...this.decks()].sort((a, b) => a.deckName.localeCompare(b.deckName, 'es')));
  protected readonly minutes = computed(() => Math.floor((this.value().duration ?? 0) / 60));
  protected readonly seconds = computed(() => (this.value().duration ?? 0) % 60);

  protected label(side: Side): string {
    return this.value()[side].playerName || (side === 'player1' ? 'Jugador 1' : 'Jugador 2');
  }

  protected set<K extends keyof Game>(key: K, v: Game[K]): void {
    this.valueChange.emit({ ...this.value(), [key]: v });
  }

  protected setPlayer(side: Side, patch: Partial<PlayerEntry>): void {
    this.set(side, { ...this.value()[side], ...patch });
  }

  protected addLife(side: Side, life: Life): void {
    this.setPlayer(side, { lives: [...this.value()[side].lives, life] });
  }

  protected flipLife(side: Side, index: number): void {
    this.setPlayer(side, { lives: this.value()[side].lives.map((l, i) => (i === index ? (l === 'up' ? 'down' : 'up') : l)) });
  }

  protected removeLife(side: Side): void {
    this.setPlayer(side, { lives: this.value()[side].lives.slice(0, -1) });
  }

  protected setDuration(minutes: number, seconds: number): void {
    const total = Math.max(0, Math.trunc(minutes || 0)) * 60 + Math.min(59, Math.max(0, Math.trunc(seconds || 0)));
    this.set('duration', total || null);
  }
}
