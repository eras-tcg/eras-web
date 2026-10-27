import { CdkMenuTrigger } from '@angular/cdk/menu';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZONE_LABELS, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';

export interface ZoneDialogData {
  zone: ZoneName;
  opponent: boolean;
}

const DESTINATIONS: { zone: ZoneName; label: string }[] = [
  { zone: 'hand', label: 'A la mano' },
  { zone: 'field', label: 'Al campo' },
  { zone: 'tributeZone', label: 'A tributos' },
  { zone: 'discardPile', label: 'Al descarte' },
  { zone: 'lifeStack', label: 'A las vidas' },
  { zone: 'deck', label: 'Al tope del mazo' },
];

/** Cards of a pile (tributes, discard, lives…): move, flip, peek, delete, reorder and bulk actions. */
@Component({
  selector: 'eras-zone-dialog',
  imports: [ModalComponent, GameCardComponent, StackComponent, EmptyStateComponent, ButtonComponent, CdkMenuTrigger, MenuComponent, MenuItemDirective],
  template: `
    <eras-modal [title]="title()" [subtitle]="cards().length + ' cartas'" (closed)="ref.close()">
      @if (cards().length === 0) {
        <eras-empty-state title="Zona vacía" />
      } @else {
        @if (!data.opponent) {
          <eras-stack direction="row" [gap]="2" wrap align="center">
            <button erasButton variant="ghost" size="sm" type="button" (click)="selectAll()">{{ selected().size === cards().length ? 'Quitar selección' : 'Seleccionar todo' }}</button>
            @if (selected().size) {
              <span>{{ selected().size }} seleccionadas</span>
              <button erasButton variant="secondary" size="sm" type="button" [cdkMenuTriggerFor]="bulk">Mover selección…</button>
              <ng-template #bulk>
                <eras-menu>
                  @for (d of destinations(); track d.zone) {
                    <button erasMenuItem (triggered)="bulkMove(d.zone)">{{ d.label }}</button>
                  }
                  <button erasMenuItem (triggered)="bulkBottom(false)">Al fondo del mazo (en orden)</button>
                  <button erasMenuItem (triggered)="bulkBottom(true)">Al fondo del mazo (aleatorio)</button>
                </eras-menu>
              </ng-template>
            }
          </eras-stack>
        }
        <ol class="cards" [attr.aria-label]="title()">
          @for (c of cards(); track c.instanceId; let i = $index) {
            <li [class.selected]="selected().has(c.instanceId)">
              <eras-game-card small [imageUrl]="c.imageUrl" [hidden]="c.faceDown && !peeked().has(c.instanceId)" [attr.title]="c.cardName" />
              @if (!data.opponent) {
                <label class="pick">
                  <input type="checkbox" [checked]="selected().has(c.instanceId)" (change)="toggle(c.instanceId)" />
                  <span class="visually-hidden">Seleccionar</span>
                </label>
              }
              <button erasButton variant="ghost" size="sm" type="button" [cdkMenuTriggerFor]="actions" [attr.aria-label]="'Acciones de la carta ' + (i + 1)">⋯</button>
              <ng-template #actions>
                <eras-menu>
                  @if (!data.opponent) {
                    @for (d of destinations(); track d.zone) {
                      <button erasMenuItem (triggered)="move(c, d.zone)">{{ d.label }}</button>
                    }
                    <button erasMenuItem (triggered)="game.flipCard(c.instanceId, data.zone)">{{ c.faceDown ? 'Poner boca arriba' : 'Poner boca abajo' }}</button>
                    @if (data.zone === 'lifeStack' && c.faceDown) {
                      <button erasMenuItem (triggered)="peek(c)">Mirar</button>
                    }
                    @if (canReorder() && i > 0) {
                      <button erasMenuItem (triggered)="reorder(i, -1)">Subir</button>
                    }
                    @if (canReorder() && i < cards().length - 1) {
                      <button erasMenuItem (triggered)="reorder(i, 1)">Bajar</button>
                    }
                    <hr />
                  }
                  <button erasMenuItem class="danger" (triggered)="remove(c)">Eliminar del juego</button>
                </eras-menu>
              </ng-template>
            </li>
          }
        </ol>
      }
    </eras-modal>
  `,
  styles: `
    .cards { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: var(--space-3) 0 0; padding: 0; list-style: none; }
    li { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); padding: var(--space-1); border-radius: var(--radius-md); }
    li.selected { background: var(--color-surface-muted); outline: 2px solid var(--color-primary); }
    .pick { display: inline-flex; }
    .visually-hidden { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoneDialogComponent {
  protected readonly data = inject<ZoneDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly game = inject(GameStore);
  private readonly modal = inject(ModalService);

  protected readonly selected = signal(new Set<string>());
  protected readonly peeked = signal(new Set<string>());
  protected readonly cards = computed<CardSlot[]>(() => (this.data.opponent ? this.game.opponentState() : this.game.myState())?.[this.data.zone] ?? []);
  protected readonly title = computed(() => `${ZONE_LABELS[this.data.zone]}${this.data.opponent ? ' del rival' : ''}`);
  protected readonly destinations = computed(() => DESTINATIONS.filter((d) => d.zone !== this.data.zone));
  protected readonly canReorder = computed(() => !this.data.opponent && (this.data.zone === 'discardPile' || this.data.zone === 'tributeZone'));
  private readonly targetPlayer = computed(() => (this.data.opponent ? (this.game.opponentState()?.userId ?? null) : null));

  protected toggle(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected selectAll(): void {
    this.selected.set(this.selected().size === this.cards().length ? new Set() : new Set(this.cards().map((c) => c.instanceId)));
  }

  protected move(c: CardSlot, to: ZoneName): void {
    // Cards sent to the lives go face down, like when they are dealt
    this.game.moveCard(c.instanceId, this.data.zone, to, { targetPlayerId: this.targetPlayer(), toPosition: to === 'deck' ? 'top' : undefined, faceDown: to === 'lifeStack' ? true : undefined });
  }

  protected bulkMove(to: ZoneName): void {
    for (const c of this.cards().filter((x) => this.selected().has(x.instanceId))) this.move(c, to);
    this.selected.set(new Set());
  }

  protected bulkBottom(random: boolean): void {
    const ids = this.cards().filter((c) => this.selected().has(c.instanceId)).map((c) => c.instanceId);
    this.game.bulkToDeckBottom(this.data.zone, ids, random);
    this.selected.set(new Set());
  }

  protected peek(c: CardSlot): void {
    // The opponent is told a life card was looked at
    this.game.viewLifeCard(c.instanceId);
    this.peeked.update((s) => new Set(s).add(c.instanceId));
  }

  protected reorder(index: number, step: -1 | 1): void {
    const ids = this.cards().map((c) => c.instanceId);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    this.game.zoneReorder(this.data.zone, ids);
  }

  protected async remove(c: CardSlot): Promise<void> {
    const ok = await this.modal.confirm({ title: 'Eliminar carta', message: '¿Eliminar esta carta del juego por completo?', confirmLabel: 'Eliminar', danger: true });
    if (ok) this.game.removeCard(c.instanceId, this.data.zone, this.targetPlayer());
  }
}
