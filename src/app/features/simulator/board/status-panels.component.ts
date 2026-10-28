import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { POST_GAME_LABELS, postGameOptions } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { PostGameChoice } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

/** Phase-gated panels over the board: waiting room, starter choice, mulligan and post game. */
@Component({
  selector: 'eras-status-panels',
  imports: [CardComponent, StackComponent, GameCardComponent, AlertComponent, ButtonComponent],
  template: `
    @switch (game.status()) {
      @case ('WAITING') {
        <eras-card>
          <eras-stack [gap]="3">
            <strong>Esperando al rival</strong>
            <span>Comparte el enlace de la sala:</span>
            <eras-stack direction="row" [gap]="2" align="center" wrap>
              <code>{{ link() }}</code>
              <button erasButton variant="secondary" size="sm" type="button" (click)="copy()">{{ copied() ? 'Copiado' : 'Copiar enlace' }}</button>
            </eras-stack>
            @if (game.isHost() && players().length === 2) {
              <span>¿Quién empieza?</span>
              <eras-stack direction="row" [gap]="2" wrap>
                @for (p of players(); track p.userId) {
                  <button erasButton type="button" (click)="game.startGame(p.userId)">Empieza {{ p.username }}</button>
                }
                <button erasButton variant="secondary" type="button" (click)="game.startGame('random')">Aleatorio</button>
              </eras-stack>
            } @else if (players().length === 2) {
              <span>Esperando que el anfitrión inicie la partida.</span>
            }
          </eras-stack>
        </eras-card>
      }
      @case ('SELECTING_STARTER') {
        <eras-card>
          <eras-stack [gap]="3">
            <strong>Elige tu criatura iniciadora</strong>
            @if (starterChosen()) {
              <span>Esperando al rival…</span>
            } @else {
              <eras-stack direction="row" [gap]="2" wrap>
                @for (c of starters(); track c.instanceId) {
                  <button type="button" class="pick" [attr.aria-label]="'Elegir ' + c.cardName" (click)="game.selectStarter(c.instanceId)">
                    <eras-game-card [imageUrl]="c.imageUrl" />
                  </button>
                } @empty {
                  <eras-alert tone="danger">Tu mazo no tiene criaturas con el keyword Iniciador.</eras-alert>
                }
              </eras-stack>
            }
          </eras-stack>
        </eras-card>
      }
      @case ('MULLIGAN') {
        <eras-card>
          <eras-stack [gap]="3">
            <strong>Mulligan</strong>
            @if (mulliganSent()) {
              <span>Esperando al rival…</span>
            } @else {
              <span>Marca las cartas que quieres enviar al fondo del mazo y confirma.</span>
              <eras-stack direction="row" [gap]="2" wrap>
                @for (c of topFive(); track c.instanceId) {
                  <button type="button" class="pick" [class.chosen]="toBottom().has(c.instanceId)" [attr.aria-pressed]="toBottom().has(c.instanceId)" [attr.aria-label]="c.cardName" (click)="toggle(c.instanceId)">
                    <eras-game-card [imageUrl]="c.imageUrl" />
                  </button>
                }
              </eras-stack>
              <div>
                <button erasButton type="button" (click)="confirmMulligan()">
                  {{ toBottom().size ? 'Enviar ' + toBottom().size + ' al fondo' : 'Quedarme con todas' }}
                </button>
              </div>
            }
          </eras-stack>
        </eras-card>
      }
      @case ('POST_GAME') {
        <eras-card>
          <eras-stack [gap]="3">
            @if (result(); as r) {
              <div class="result" [class.won]="r.won">
                <strong>{{ r.title }}</strong>
                <span>{{ r.detail }}</span>
              </div>
            } @else {
              <strong>Partida terminada</strong>
            }
            @if (myChoice(); as c) {
              <span>Elegiste: {{ labels[c] }}. Esperando al rival…</span>
            } @else {
              <eras-stack direction="row" [gap]="2" wrap>
                @for (o of options(); track o) {
                  <button erasButton [variant]="o === 'exit' ? 'secondary' : 'primary'" type="button" (click)="choose(o)">{{ labels[o] }}</button>
                }
              </eras-stack>
            }
          </eras-stack>
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
    :host:empty { display: none; }
    code { padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); background: var(--color-surface-muted); overflow-wrap: anywhere; }
    .pick { padding: 0; border: 2px solid transparent; border-radius: var(--radius-md); background: none; cursor: pointer; }
    .pick:hover { border-color: var(--color-border); }
    .pick.chosen { border-color: var(--color-danger); opacity: 0.6; }
    .result { display: grid; gap: var(--space-1); padding: var(--space-3) var(--space-4); border: 2px solid var(--color-danger); border-radius: var(--radius-md); text-align: center; }
    .result.won { border-color: var(--color-success); box-shadow: 0 0 24px 4px color-mix(in srgb, var(--color-success) 45%, transparent); }
    .result strong { font-size: var(--font-size-2xl, 1.75rem); }
    .result span { color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPanelsComponent {
  readonly leave = output<void>();
  protected readonly game = inject(GameStore);
  private readonly auth = inject(AuthService);

  protected readonly labels = POST_GAME_LABELS;
  protected readonly copied = signal(false);
  protected readonly toBottom = signal(new Set<string>());
  protected readonly mulliganSent = signal(false);

  protected readonly link = computed(() => `${location.origin}/simulator/${this.game.roomId() ?? ''}`);
  protected readonly players = computed(() => Object.values(this.game.state()?.players ?? {}));
  protected readonly starters = computed(() => (this.game.myState()?.deck ?? []).filter((c) => c.starter));
  protected readonly starterChosen = computed(() => (this.game.myState()?.field.length ?? 0) > 0);
  protected readonly topFive = computed(() => (this.game.myState()?.deck ?? []).slice(0, 5));
  protected readonly myChoice = computed(() => this.game.postGameChoices()[this.auth.user()?.id ?? ''] ?? null);
  /** Who won and why. */
  protected readonly result = computed(() => {
    const s = this.game.state();
    if (!s?.winnerId) return null;
    const me = this.auth.user()?.id;
    const won = s.winnerId === me;
    const winner = s.players?.[s.winnerId]?.username ?? 'Tu rival';
    const loser = Object.values(s.players ?? {}).find((p) => p.userId !== s.winnerId)?.username ?? 'Tu rival';
    const detail = s.endReason === 'surrender'
      ? (won ? `${loser} se rindió` : 'Te rendiste')
      : (won ? `${loser} se quedó sin vidas` : 'Te quedaste sin vidas');
    return { won, title: won ? '¡Ganaste!' : `Ganó ${winner}`, detail };
  });
  protected readonly options = computed(() => {
    const state = this.game.state();
    const surrenderer = state?.event === 'SURRENDER' ? state.actorId : null;
    const me = this.auth.user()?.id;
    const iSurrendered = !!surrenderer && surrenderer === me;
    const theirChoice = surrenderer && surrenderer !== me ? (this.game.postGameChoices()[surrenderer] ?? null) : null;
    return postGameOptions(iSurrendered, theirChoice);
  });

  constructor() {
    // A new game (rematch) goes through the same phases again
    effect(() => {
      this.game.status();
      untracked(() => {
        this.mulliganSent.set(false);
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

  protected choose(choice: PostGameChoice): void {
    this.game.postGameChoice(choice);
    if (choice === 'exit') this.leave.emit();
  }
}
