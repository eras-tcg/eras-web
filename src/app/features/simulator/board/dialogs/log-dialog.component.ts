import { DatePipe } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore, LogLine } from '@data/simulator/game.store';
import { CardWithSourceComponent } from '@ui/domain/card-with-source/card-with-source.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { persistedFlag } from '@core/storage/persisted-flag';

/** The icon of each kind of action, with its name (the icon's tooltip). */
const KINDS: Record<string, { icon: string; name: string }> = {
  EFFECT_ACTIVATED: { icon: 'zap', name: 'Activación' },
  EFFECT_RESOLVED: { icon: 'check-circle', name: 'Resolución' },
  EFFECT_DECLINED: { icon: 'x', name: 'No activa' },
  TARGET: { icon: 'target', name: 'Objetivo' },
  DRAW: { icon: 'draw', name: 'Robo' },
  ADD_TO_HAND: { icon: 'draw', name: 'A la mano' },
  TRIBUTE: { icon: 'archive', name: 'Tributo' },
  DESTROY: { icon: 'skull', name: 'Destrucción' },
  SACRIFICE: { icon: 'skull', name: 'Sacrificio' },
  SEND: { icon: 'swap', name: 'Envío' },
  NORMAL_SUMMON: { icon: 'sparkles', name: 'Invocación' },
  EFFECT_SUMMON: { icon: 'sparkles', name: 'Invocación por efecto' },
  SPECIAL_SUMMON: { icon: 'sparkles', name: 'Invocación especial' },
  PLAY: { icon: 'play', name: 'Juega' },
  ATTACK_DECLARED: { icon: 'sword', name: 'Ataque' },
  BLOCK: { icon: 'shield', name: 'Bloqueo' },
  CLASH: { icon: 'sword', name: 'Enfrentamiento' },
  LIFE_DAMAGE: { icon: 'heart', name: 'Daño directo' },
  STRENGTH_REDUCED: { icon: 'trending-down', name: 'Reducción de fuerza' },
  GAIN: { icon: 'plus', name: 'Gana' },
  GAIN_GEMS: { icon: 'gem', name: 'Gemas' },
  UNTAP: { icon: 'refresh', name: 'Reactiva' },
  TAP: { icon: 'refresh', name: 'Agota' },
  MOVE: { icon: 'chevron-up', name: 'Movimiento' },
  LOOK_TOP: { icon: 'eye', name: 'Mira' },
  COMBAT_STEP: { icon: 'clock', name: 'Paso del combate' },
  ATTACK_ENDED: { icon: 'clock', name: 'Fin del combate' },
  TURN_START: { icon: 'clock', name: 'Inicio del turno' },
  TURN_END: { icon: 'clock', name: 'Final del turno' },
  GAME_LOST: { icon: 'flag', name: 'Fin de la partida' },
  MANUAL: { icon: 'hand', name: 'Acción manual' },
};

interface Group {
  id: string;
  sourceName: string | null;
  imageUrl: string | null;
  /** An inherited effect's Recurso, small at the card's corner (as in the chaining choice). */
  inheritedName: string | null;
  inheritedImage: string | null;
  lines: (LogLine & { icon: string | null; kindName: string | null })[];
}

/**
 * Full action history of the room (kept by the server, newest first). Each group is the card behind its actions
 * (shown once for the actions in a row of the same card); the short view keeps the activations, resolutions and
 * the actions by hand or by the rules, without each step of the effects.
 */
@Component({
  selector: 'eras-log-dialog',
  imports: [ModalComponent, EmptyStateComponent, CardWithSourceComponent, IconComponent, DatePipe],
  template: `
    <eras-modal title="Historial de la partida" [subtitle]="count() + ' acciones'" (closed)="ref.close()">
      <label class="short">
        <input type="checkbox" [checked]="short()" (change)="toggleShort()" />
        Simplificado
      </label>
      @if (groups().length === 0) {
        <eras-empty-state title="Todavía no hay acciones" />
      } @else {
        <ol class="log">
          @for (g of groups(); track g.id) {
            <li class="group" [class.no-card]="!g.imageUrl">
              @if (g.imageUrl) {
                <div class="card">
                  <eras-card-with-source [imageUrl]="g.imageUrl" [sourceName]="g.inheritedName" [sourceImage]="g.inheritedImage" />
                </div>
              }
              <ol class="lines">
                @for (line of g.lines; track line.id) {
                  <li class="line" [class.detail]="line.detail">
                    <span class="text">{{ line.text }}</span>
                    @if (line.icon) {
                      <span class="icon" [title]="line.kindName"><eras-icon [name]="$any(line.icon)" /></span>
                    }
                    <time>{{ line.ts | date: 'HH:mm:ss' }}</time>
                  </li>
                }
              </ol>
            </li>
          }
        </ol>
      }
    </eras-modal>
  `,
  styles: `
    .short { display: flex; align-items: center; gap: var(--space-2); margin-block-end: var(--space-3); font-size: var(--font-size-sm); cursor: pointer; }
    .log { display: grid; gap: var(--space-2); max-block-size: 62vh; overflow: auto; margin: 0; padding: 0 var(--space-1) 0 0; list-style: none; }
    .group {
      display: grid;
      grid-template-columns: 3.4rem minmax(0, 1fr);
      gap: var(--space-3);
      align-items: start;
      padding: var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    .group.no-card { grid-template-columns: minmax(0, 1fr); }
    .card { --game-card-width: 3.4rem; position: sticky; inset-block-start: 0; }
    .lines { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
    .line {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'text icon' 'text time';
      column-gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--color-surface-muted);
      font-size: var(--font-size-sm);
    }
    .line.detail { background: none; color: var(--color-text-muted); }
    .text { grid-area: text; align-self: center; }
    .icon { grid-area: icon; justify-self: end; color: var(--color-primary); }
    .icon eras-icon { display: block; inline-size: 1rem; block-size: 1rem; }
    time { grid-area: time; justify-self: end; align-self: end; color: var(--color-text-muted); font-size: var(--font-size-xs); font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogDialogComponent {
  protected readonly ref = inject(DialogRef);
  private readonly game = inject(GameStore);
  protected readonly short = persistedFlag('eras-sim-history-short');

  private readonly lines = computed(() => {
    const all = [...this.game.log()].reverse();
    return this.short() ? all.filter((l) => !l.detail) : all;
  });
  protected readonly count = computed(() => this.lines().length);

  /** Actions in a row of the same card share its group (the card is shown once); so do those without a card. */
  protected readonly groups = computed<Group[]>(() => {
    const groups: Group[] = [];
    for (const line of this.lines()) {
      const kind = line.kind ? KINDS[line.kind] : null;
      const item = { ...line, icon: kind?.icon ?? null, kindName: kind?.name ?? null };
      const last = groups[groups.length - 1];
      // Also the actions in a row without a card (a note of the rules, a draw by hand…) share one box
      // An inherited effect is its own group: the same card, with its Recurso at the corner
      const key = (line.sourceId ?? 'none') + '|' + (line.inheritedFromName ?? '') + '|';
      if (last && last.id.startsWith(key)) {
        last.lines.push(item);
      } else {
        groups.push({
          id: key + line.id,
          sourceName: line.sourceName ?? null,
          imageUrl: line.imageUrl ?? null,
          inheritedName: line.inheritedFromName ?? null,
          inheritedImage: line.inheritedFromImage ?? null,
          lines: [item],
        });
      }
    }
    return groups;
  });

  protected toggleShort(): void {
    this.short.update((on) => !on);
  }
}

