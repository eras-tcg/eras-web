import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { CardPeekComponent } from './card-peek.component';

/** Phase-gated panels over the board: starter choice (older rooms) and mulligan. The pre-room has its own view; the post-game is the end screen (eras-match-banner). */
@Component({
  selector: 'eras-status-panels',
  imports: [CardComponent, StackComponent, GameCardComponent, AlertComponent, ButtonComponent, CardPeekComponent],
  template: `
    @switch (game.status()) {
      @case ('SELECTING_STARTER') {
        <eras-card>
          <eras-stack [gap]="3">
            <strong>Elige tu criatura iniciadora</strong>
            @if (starterChosen()) {
              <span>Esperando al rival…</span>
            } @else {
              <div class="cards">
                @for (c of starters(); track c.instanceId) {
                  <div class="slot">
                    <button type="button" class="pick" [attr.aria-label]="'Elegir ' + c.cardName" (click)="game.selectStarter(c.instanceId)">
                      <eras-game-card [imageUrl]="c.imageUrl" [name]="c.cardName ?? null" />
                    </button>
                    <eras-card-peek [card]="c" [mine]="true" />
                  </div>
                } @empty {
                  <eras-alert tone="danger">Tu mazo no tiene criaturas con el keyword Iniciador.</eras-alert>
                }
              </div>
            }
          </eras-stack>
        </eras-card>
      }
      @case ('MULLIGAN') {
        <eras-card class="mulligan">
          <div class="panel">
            <header class="head">
              <h2 class="title">Mulligan</h2>
              <p class="subtitle">{{ mulliganSent() ? 'Esperando al rival…' : 'Elige las cartas que envías al fondo del mazo.' }}</p>
            </header>
            @if (!mulliganSent()) {
              <div class="cards">
                @for (c of topFive(); track c.instanceId) {
                  <div class="slot">
                    <button type="button" class="pick" [class.chosen]="toBottom().has(c.instanceId)" [attr.aria-pressed]="toBottom().has(c.instanceId)" [attr.aria-label]="c.cardName" (click)="toggle(c.instanceId)">
                      <eras-game-card [imageUrl]="c.imageUrl" [name]="c.cardName ?? null" />
                      <span class="tag">{{ toBottom().has(c.instanceId) ? 'Al fondo' : '' }}</span>
                    </button>
                    <eras-card-peek [card]="c" [mine]="true" />
                  </div>
                }
              </div>
              <footer class="foot">
                <span class="count">{{ toBottom().size }} de {{ topFive().length }}</span>
                <button erasButton type="button" (click)="confirmMulligan()">
                  {{ toBottom().size ? 'Enviar ' + toBottom().size + ' al fondo' : 'Quedarme con todas' }}
                </button>
              </footer>
            }
          </div>
        </eras-card>
      }
      @case ('FINISHED') {
        <eras-card>
          <eras-stack [gap]="3">
            <strong>La sala se cerró</strong>
            <div><button erasButton type="button" (click)="leave.emit()">Volver al simulador</button></div>
          </eras-stack>
        </eras-card>
      }
    }
  `,
  styles: `
    :host { display: block; }
    /* Wider for the mulligan's five cards in one row (the board reads it) */
    :host:has(.mulligan) { --status-width: 48rem; }
    :host:empty { display: none; }
    code { padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); background: var(--color-surface-muted); overflow-wrap: anywhere; }
    /* The cards to pick, centered, with the eye at their corner, as in the other choices */
    .cards { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3) var(--space-2); }
    .slot { position: relative; display: flex; }
    .pick {
      --game-card-width: 7rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 2px solid transparent;
      border-radius: var(--radius-md);
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .pick:hover { border-color: color-mix(in srgb, var(--color-primary) 60%, transparent); }
    .pick.chosen { border-color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 12%, transparent); }
    .pick.chosen eras-game-card { opacity: 0.6; }
    .tag { min-block-size: 1.2em; color: var(--color-danger); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); }
    /* The mulligan reads as the sheets: title and subtitle, the cards, the count and the button at the foot */
    .panel { display: grid; gap: var(--space-4); }
    .title { font-size: var(--font-size-lg); line-height: 2rem; }
    .subtitle { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    /* The mulligan is always five cards: one row, the cards narrowing on a small screen */
    .mulligan .cards { flex-wrap: nowrap; }
    .mulligan .pick { --game-card-width: min(7rem, calc((100vw - 8rem) / 5)); }
    .foot { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); }
    .count { color: var(--color-text-muted); font-size: var(--font-size-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPanelsComponent {
  readonly leave = output<void>();
  protected readonly game = inject(GameStore);

  protected readonly copied = signal(false);
  protected readonly toBottom = signal(new Set<string>());
  protected readonly mulliganSent = signal(false);

  protected readonly link = computed(() => `${location.origin}/simulator/${this.game.roomId() ?? ''}`);
  protected readonly players = computed(() => Object.values(this.game.state()?.players ?? {}));
  protected readonly starters = computed(() => (this.game.myState()?.deck ?? []).filter((c) => c.starter));
  protected readonly starterChosen = computed(() => (this.game.myState()?.field.length ?? 0) > 0);
  protected readonly topFive = computed(() => (this.game.myState()?.deck ?? []).slice(0, 5));

  constructor() {
    // A new game (rematch) goes through the same phases again
    effect(() => {
      this.game.status();
      // A test room switches sides: the mulligan panel is that side's
      const side = this.game.myState()?.userId;
      untracked(() => {
        this.mulliganSent.set(!!side && (this.game.state()?.mulliganReady ?? []).includes(side));
        this.toBottom.set(new Set());
      });
    });
  }

  protected async copy(): Promise<void> {
    await navigator.clipboard?.writeText(this.link()).catch(() => undefined);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  protected toggle(id: string): void {
    this.toBottom.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected confirmMulligan(): void {
    this.mulliganSent.set(true);
    this.game.confirmMulligan([...this.toBottom()]);
  }

}
