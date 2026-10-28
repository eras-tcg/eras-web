import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, inject, input, signal, viewChild } from '@angular/core';
import { creatureNear, fieldY, zoneTargetId } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, PlayerState, ZoneName } from '@data/simulator/simulator.model';
import { ResourcePipsComponent } from '@ui/domain/game-counters/resource-pips.component';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { GameZoneComponent } from '@ui/domain/game-zone/game-zone.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { BoardDialogs } from './board-dialogs';
import { BoardDrag } from './board-drag';
import { SimCardComponent } from './sim-card.component';

type Pile = 'deck' | 'tributeZone' | 'discardPile' | 'lifeStack';

/**
 * One player's side of the table. Own side: drop cards anywhere (field position, hand, piles),
 * deck and lives have their action menus. Opponent side (drawn upside down): drops become targets.
 */
@Component({
  selector: 'eras-player-half',
  imports: [SimCardComponent, GameZoneComponent, GameCardComponent, ResourcePipsComponent, ButtonComponent, CdkContextMenuTrigger, MenuComponent, MenuItemDirective],
  templateUrl: './player-half.component.html',
  styleUrl: './player-half.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.opponent]': 'opponent()' },
})
export class PlayerHalfComponent {
  readonly player = input.required<PlayerState>();
  readonly opponent = input(false, { transform: booleanAttribute });

  protected readonly game = inject(GameStore);
  protected readonly drag = inject(BoardDrag);
  protected readonly dialogs = inject(BoardDialogs);
  private readonly modal = inject(ModalService);
  private readonly fieldEl = viewChild<ElementRef<HTMLElement>>('field');

  protected readonly over = signal<string | null>(null);
  /** Creature the dragged card would interact with if dropped now. */
  protected readonly nearby = signal<CardSlot | null>(null);
  /** Own creature summoned from hand/piles: ask whether it was by effect (draws a card). */
  protected readonly effectSummon = signal<{ instanceId: string; fromZone: ZoneName } | null>(null);
  protected readonly peekCount = signal(5);

  protected readonly targeting = computed(() => this.game.pendingTargetSource() !== null);
  protected readonly topTribute = computed(() => this.last(this.player().tributeZone));
  protected readonly topDiscard = computed(() => this.last(this.player().discardPile));
  protected readonly fieldY = fieldY;

  private last(list: CardSlot[]): CardSlot | null {
    return list.length ? list[list.length - 1] : null;
  }

  protected zoneId(zone: ZoneName): string {
    return zoneTargetId(zone, this.opponent());
  }

  protected isTargeted(zone: ZoneName): boolean {
    return this.game.targetedId() === this.zoneId(zone);
  }

  // ── Drag over / drop ──────────────────────────────────────────────────

  protected dragOver(event: DragEvent, zone: string): void {
    if (!this.drag.accepts(event)) return;
    event.preventDefault();
    this.over.set(zone);
    if (zone === 'field') {
      const el = this.fieldEl()?.nativeElement;
      const dragging = this.drag.dragging();
      if (el && dragging) {
        const { x, y } = this.drag.position(event, el, this.opponent());
        this.nearby.set(creatureNear(this.player().field, x, y, this.opponent() ? null : dragging.instanceId));
      }
    }
  }

  protected dragLeave(): void {
    this.over.set(null);
    this.nearby.set(null);
  }

  protected async drop(event: DragEvent, to: ZoneName | 'deckBottom', half?: 'top' | 'bottom'): Promise<void> {
    if (!this.drag.accepts(event)) return;
    event.preventDefault();
    const el = this.fieldEl()?.nativeElement;
    const pos = to === 'field' && el ? this.drag.position(event, el, this.opponent()) : null;
    const nearby = this.nearby();
    this.dragLeave();
    const card = this.drag.read(event);
    if (!card) return;

    if (this.opponent()) {
      // Dropping on the rival's side points your card at their creature or zone
      const target = to === 'field' ? nearby?.instanceId : to === 'deckBottom' ? null : this.zoneId(to);
      if (target) this.game.target(target, card.instanceId);
      return;
    }

    if (to === 'field' && pos) {
      const me = this.game.myState();
      const dragged = me?.[card.fromZone].find((c) => c.instanceId === card.instanceId);
      if (nearby && dragged) {
        this.dialogs.creatureInteraction(dragged, nearby, card.fromZone);
        return;
      }
      // A creature from the hand without an effect: normal summon by the rules (the server pays and triggers)
      if (this.game.status() === 'IN_PROGRESS' && card.fromZone === 'hand' && dragged?.cardType === 'creature') {
        this.game.normalSummon(card.instanceId, pos.x, pos.y);
        return;
      }
      const summon = this.game.status() === 'IN_PROGRESS' && card.fromZone !== 'field' && dragged?.cardType === 'creature';
      this.game.moveCard(card.instanceId, card.fromZone, 'field', pos);
      if (summon) this.effectSummon.set({ instanceId: card.instanceId, fromZone: card.fromZone });
      return;
    }
    if (to === 'deckBottom') {
      const ok = await this.modal.confirm({ title: 'Fondo del mazo', message: '¿Enviar esta carta al fondo del mazo?', confirmLabel: 'Enviar' });
      if (ok) this.game.moveCard(card.instanceId, card.fromZone, 'deck', { toPosition: 'bottom' });
      return;
    }
    if (to === card.fromZone && to !== 'lifeStack') return;
    this.game.moveCard(card.instanceId, card.fromZone, to, {
      toPosition: to === 'deck' ? 'top' : to === 'lifeStack' ? (half ?? 'top') : undefined,
    });
  }

  protected lifeHalf(event: DragEvent): 'top' | 'bottom' {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom';
  }

  /** Drags a life card out: the top or bottom one, depending on where the stack is grabbed. */
  protected lifeDragStart(event: DragEvent): void {
    const lives = this.player().lifeStack;
    if (this.opponent() || !lives.length) {
      event.preventDefault();
      return;
    }
    const card = this.lifeHalf(event) === 'top' ? lives[0] : lives[lives.length - 1];
    this.drag.start(event, { instanceId: card.instanceId, fromZone: 'lifeStack' });
  }

  protected resolveEffectSummon(draw: boolean): void {
    const pending = this.effectSummon();
    if (pending) this.game.resolveEffectSummon(pending.instanceId, pending.fromZone, draw);
    this.effectSummon.set(null);
  }

  // ── Clicks on piles ───────────────────────────────────────────────────

  protected pileClick(zone: Pile): void {
    if (this.targeting()) {
      this.game.target(this.zoneId(zone));
      return;
    }
    if (zone === 'deck') return;
    if (this.player()[zone].length) this.dialogs.zone(zone, this.opponent());
  }

  protected deckDoubleClick(): void {
    if (!this.opponent() && this.player().deck.length) this.game.drawCard();
  }

  // ── Deck and life actions ─────────────────────────────────────────────

  protected topTo(to: ZoneName, faceDown: boolean): void {
    const top = this.player().deck[0];
    if (top) this.game.moveCard(top.instanceId, 'deck', to, { toPosition: to === 'lifeStack' ? 'top' : undefined, faceDown });
  }

  protected peek(position: 'top' | 'bottom'): void {
    const n = Math.max(1, Math.min(this.peekCount() || 1, this.player().deck.length));
    this.dialogs.deckPeek(position, n);
  }

  protected async confirmThen(message: string, action: () => void): Promise<void> {
    if (await this.modal.confirm({ title: 'Confirmar', message, confirmLabel: 'Aceptar' })) action();
  }

  protected viewLives(): void {
    this.game.viewLifeStack();
    this.dialogs.zone('lifeStack', false);
  }
}
