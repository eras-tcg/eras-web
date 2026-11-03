import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { GemGame, PRACTICE_START, canAttack, counterTrack, endTurn, gemsOf, pay, payLimit } from '@data/rules/gems';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/**
 * Practice with the shared Contador: pay gems for whoever plays, end turns and watch the Marcadores grow, a debt
 * pass to the other player and attacks become forbidden while in debt.
 */
@Component({
  selector: 'eras-gem-practice',
  imports: [ButtonComponent, IconComponent],
  template: `
    <section class="practice" aria-label="Práctica del Contador de gemas">
      <header class="head">
        <strong>Practica con el Contador</strong>
        <span class="turn" [class.rival]="game().turn === 'rival'">{{ game().turn === 'you' ? 'Tu turno' : 'Turno del rival' }}</span>
      </header>

      <div class="markers">
        <div class="marker" [class.active]="game().turn === 'you'">
          <span class="label">Tu Marcador</span><strong>{{ game().markers.you }}</strong>
          <span class="gems">{{ gems('you') }} {{ gems('you') === 1 || gems('you') === -1 ? 'gema' : 'gemas' }}</span>
        </div>
        <div class="marker rival" [class.active]="game().turn === 'rival'">
          <span class="label">Marcador del rival</span><strong>{{ game().markers.rival }}</strong>
          <span class="gems">{{ gems('rival') }} {{ gems('rival') === 1 || gems('rival') === -1 ? 'gema' : 'gemas' }}</span>
        </div>
      </div>

      <ol class="track" aria-label="Contador de gemas compartido">
        @for (slot of track(); track $index) {
          <li [class]="slot.state" [class.current]="slot.current" [class.limit]="slot.limit" [attr.aria-current]="slot.current || null">{{ slot.value }}</li>
        }
      </ol>
      <p class="sides"><span>← tus gemas</span><span>gemas del rival →</span></p>

      <div class="pay">
        <span>Pagar:</span>
        @for (n of amounts; track n) {
          <button erasButton variant="secondary" size="sm" type="button" [disabled]="n > limit()" (click)="doPay(n)">{{ n }}</button>
        }
        <span class="hint">máx. {{ limit() }}</span>
      </div>

      <p class="status" [class.bad]="!attackOk()">
        <eras-icon [name]="attackOk() ? 'check-circle' : 'alert'" />
        {{ attackOk() ? 'Puede declarar ataques.' : 'Está en deuda: no puede declarar ataques este turno (salvo Furia).' }}
      </p>
      @if (message(); as text) {
        <p class="message">{{ text }}</p>
      }

      <div class="actions">
        <button erasButton type="button" (click)="doEndTurn()">Terminar turno <eras-icon name="chevron-right" /></button>
        <button erasButton variant="ghost" type="button" (click)="reset()"><eras-icon name="refresh" /> Reiniciar</button>
      </div>
    </section>
  `,
  styles: `
    .practice {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
    }
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .turn { padding: 0 var(--space-2); border-radius: var(--radius-pill); background: var(--color-success); color: #fff; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); }
    .turn.rival { background: var(--color-danger); }
    .markers { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .marker {
      display: grid;
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      opacity: 0.7;
    }
    .marker.active { border-color: var(--color-success); opacity: 1; }
    .marker.rival.active { border-color: var(--color-danger); }
    .marker strong { font-size: var(--font-size-xl); line-height: 1.1; }
    .label, .gems, .sides, .hint { color: var(--color-text-muted); font-size: var(--font-size-xs); }
    .track { display: grid; grid-template-columns: repeat(21, minmax(0, 1fr)); gap: 2px; margin: 0; padding: 0; list-style: none; }
    .track li {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      border: var(--border-width) solid var(--color-border);
      border-radius: 50%;
      color: var(--color-text-muted);
      font-size: clamp(0.55rem, 1.6vw, var(--font-size-xs));
      font-variant-numeric: tabular-nums;
    }
    .track li.zero { border-width: 2px; color: var(--color-text); font-weight: var(--font-weight-bold); }
    .track li.you { border-color: transparent; background: var(--color-success); color: #fff; }
    .track li.rival { border-color: transparent; background: var(--color-danger); color: #fff; }
    .track li.limit { border: 2px dashed var(--color-warning, var(--color-danger)); }
    .track li.current { outline: 2px solid var(--color-text); outline-offset: 1px; font-weight: var(--font-weight-bold); }
    .sides { display: flex; justify-content: space-between; margin: calc(-1 * var(--space-2)) 0 0; }
    .pay, .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .status, .message { display: flex; align-items: center; gap: var(--space-2); margin: 0; }
    .status { color: var(--color-success); font-weight: var(--font-weight-medium); }
    .status.bad { color: var(--color-danger); }
    .status eras-icon { flex-shrink: 0; inline-size: 1.1rem; block-size: 1.1rem; }
    .message { padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--color-surface-muted); font-size: var(--font-size-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemPracticeComponent {
  protected readonly amounts = [1, 2, 3, 4, 5];
  protected readonly game = signal<GemGame>(PRACTICE_START);
  protected readonly message = signal<string | null>('Es tu tercer turno: tu Marcador está en 3 y acabas de ganar 3 gemas.');
  protected readonly track = computed(() => counterTrack(this.game()));
  protected readonly limit = computed(() => payLimit(this.game()));
  protected readonly attackOk = computed(() => canAttack(this.game()));

  protected gems(player: 'you' | 'rival'): number {
    return gemsOf(this.game(), player);
  }

  protected doPay(n: number): void {
    const { game, error } = pay(this.game(), n);
    this.game.set(game);
    const who = game.turn === 'you' ? 'Pagaste' : 'El rival pagó';
    this.message.set(error ?? `${who} ${n} ${n === 1 ? 'gema' : 'gemas'}.`);
  }

  protected doEndTurn(): void {
    const { game, message } = endTurn(this.game());
    this.game.set(game);
    this.message.set(message);
  }

  protected reset(): void {
    this.game.set(PRACTICE_START);
    this.message.set('Es tu tercer turno: tu Marcador está en 3 y acabas de ganar 3 gemas.');
  }
}
