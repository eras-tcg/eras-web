import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZONE_LABELS, ZoneName } from '@data/simulator/simulator.model';
import { legalActions, specialKindLabel } from '@data/simulator/legal-actions';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { PluralPipe } from '@ui/utilities/plural.pipe';
import { firstValueFrom } from 'rxjs';
import { SendToData, SendToDialogComponent, SendToOption } from './send-to-dialog.component';

export interface ZoneDialogData {
  zone: ZoneName;
  opponent: boolean;
  /** Only to look at the cards (a choice is lowered): no actions. */
  readonly?: boolean;
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
  imports: [PluralPipe, ModalComponent, GameCardComponent, StackComponent, EmptyStateComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal size="xl" [title]="title()" [subtitle]="cards().length | plural: 'carta'" (closed)="ref.close()">
      @if (cards().length === 0) {
        <eras-empty-state title="Zona vacía" />
      } @else {
        @if (canAct()) {
          <eras-stack direction="row" [gap]="2" wrap align="center">
            <button erasButton variant="ghost" size="sm" type="button" (click)="selectAll()">{{ selected().size === cards().length ? 'Quitar selección' : 'Seleccionar todo' }}</button>
            @if (selected().size) {
              <span class="count">{{ selected().size }} {{ selected().size === 1 ? 'seleccionada' : 'seleccionadas' }}</span>
              <button erasButton size="sm" type="button" (click)="sendSelected()">Enviar selección a…</button>
            }
          </eras-stack>
        }
        <ol class="cards" [attr.aria-label]="title()">
          @for (c of cards(); track c.instanceId; let i = $index) {
            <li>
              <button
                type="button"
                class="pick"
                [class.chosen]="selected().has(c.instanceId)"
                [class.static]="!canAct()"
                [attr.aria-pressed]="canAct() ? selected().has(c.instanceId) : null"
                [attr.aria-label]="label(c, i)"
                (click)="canAct() && toggle(c.instanceId)"
              >
                <eras-game-card
                  [imageUrl]="c.imageUrl"
                  [name]="c.cardName"
                  [hidden]="isHidden(c)"
                  [peeked]="isPeeked(c)"
                  [class.can-play]="actionsOf(c).includes('ritual')"
                  [class.can-activate]="actionsOf(c).includes('activate')"
                />
                @if (!data.readonly) {
                  <!-- "Enviar a…": on the card's lower right corner -->
                  <span
                    class="send"
                    role="button"
                    tabindex="0"
                    [attr.aria-label]="'Enviar ' + (c.cardName ?? 'la carta') + ' a…'"
                    (click)="$event.stopPropagation(); sendOne(c, i)"
                    (keydown.enter)="$event.stopPropagation(); sendOne(c, i)"
                  ><eras-icon name="external" /></span>
                }
                <span class="position">{{ positionLabel(i) }}</span>
              </button>
              @if (actionsOf(c).includes('ritual')) {
                <button erasButton size="sm" type="button" (click)="special(c)">{{ kindLabel(c) }}</button>
              }
              @for (e of effectsOf(c); track e.scriptId) {
                <button erasButton variant="secondary" size="sm" type="button" [title]="e.text" (click)="activate(c, e.scriptId)">{{ e.label }}</button>
              }

            </li>
          }
        </ol>
      }
    </eras-modal>
  `,
  styles: `
    .count { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .cards {
      --game-card-width: 7.5rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: var(--space-3);
      margin: var(--space-3) 0 0;
      padding: 0;
      list-style: none;
    }
    li { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
    .pick {
      position: relative;
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
    .pick:hover:not(.static) { background: var(--color-surface-muted); }
    .pick.static { cursor: default; }
    // Selected: the same glow as the choices of an effect
    .pick.chosen { border-color: var(--color-success); background: color-mix(in srgb, var(--color-success) 12%, transparent); }
    .pick.chosen eras-game-card { box-shadow: 0 0 0 2px var(--color-success), 0 0 14px 3px color-mix(in srgb, var(--color-success) 60%, transparent); }
    .pick:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .position { color: var(--color-text-muted); font-size: var(--font-size-xs); }
    .send {
      position: absolute;
      inset-block-end: 1.6rem;
      inset-inline-end: 0.15rem;
      display: inline-grid;
      place-items: center;
      inline-size: 1.9rem;
      block-size: 1.9rem;
      border: 1px solid var(--color-border);
      border-radius: 50%;
      background: var(--color-surface);
      color: var(--color-text);
      box-shadow: var(--shadow-md);
      cursor: pointer;
    }
    .send:hover, .send:focus-visible { border-color: var(--color-primary); color: var(--color-primary); outline: none; }
    .send eras-icon { inline-size: 1rem; block-size: 1rem; }
    eras-game-card.can-play { box-shadow: 0 0 0 2px var(--color-sim-ally), 0 0 14px 3px color-mix(in srgb, var(--color-sim-ally) 70%, transparent); }
    eras-game-card.can-activate { box-shadow: 0 0 0 2px var(--color-sim-gold), 0 0 14px 3px color-mix(in srgb, var(--color-sim-gold) 70%, transparent); }
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
  /** My zone, or in a test room either side's (the other side's actions are done as that side). */
  protected readonly editable = computed(() => !this.data.opponent || this.game.editorRoom());
  /** The order of the deck, lives and hand is changed only in a test room. */
  protected readonly canReorder = computed(
    () => this.editable() && (this.data.zone === 'discardPile' || this.data.zone === 'tributeZone' || (this.game.editorRoom() && this.data.zone !== 'field')),
  );
  private readonly owner = computed(() => (this.data.opponent ? (this.game.opponentState()?.userId ?? null) : null));
  /** In a test room the other side's zone is changed as that side; otherwise its cards are moved as targets. */
  private readonly targetPlayer = computed(() => (this.game.editorRoom() ? null : this.owner()));

  /** Cards can be selected and sent (my zone, or either side's in a test room). */
  protected readonly canAct = computed(() => this.editable() && !this.data.readonly);

  protected isHidden(c: CardSlot): boolean {
    // In the editor mode my own deck is looked at as it is
    const myDeck = this.data.zone === 'deck' && !this.data.opponent && this.game.editorMode();
    return c.faceDown && !this.peeked().has(c.instanceId) && !this.game.seeAll() && !myDeck;
  }

  /** Hidden but shown by "Mostrar cartas ocultas" (not my own deck in the editor mode, nor one I chose to look at). */
  protected isPeeked(c: CardSlot): boolean {
    const myDeck = this.data.zone === 'deck' && !this.data.opponent && this.game.editorMode();
    return c.faceDown && this.game.seeAll() && !this.peeked().has(c.instanceId) && !myDeck;
  }

  protected label(c: CardSlot, i: number): string {
    return `${this.isHidden(c) ? 'Carta oculta' : (c.cardName ?? 'Carta')}, ${this.positionLabel(i)}`;
  }

  /** Where it is in the pile: the deck's and lives' order matters. */
  protected positionLabel(i: number): string {
    const n = this.cards().length;
    if (this.data.zone === 'deck') return i === 0 ? 'Tope' : i === n - 1 ? 'Fondo' : `${i + 1}ª desde el tope`;
    if (this.data.zone === 'lifeStack') return i === 0 ? 'Vida del tope' : `Vida ${i + 1}`;
    return `${i + 1}`;
  }

  private async choose(data: SendToData): Promise<string | undefined> {
    return firstValueFrom(this.modal.open<string, SendToData>(SendToDialogComponent, { data }).closed);
  }

  private zones(): SendToOption[] {
    return [
      ...this.destinations().map((d) => ({ id: `to:${d.zone}`, label: d.label })),
      ...(this.data.zone === 'deck' ? [] : [{ id: 'to:deck-bottom', label: 'Al fondo del mazo' }]),
    ];
  }

  /** "Enviar a…" for one card: its destinations, then what else can be done with it here. */
  protected async sendOne(c: CardSlot, i: number): Promise<void> {
    const last = this.cards().length - 1;
    const other: SendToOption[] = [];
    if (this.editable()) {
      other.push({ id: 'flip', label: c.faceDown ? 'Poner boca arriba' : 'Poner boca abajo' });
      if (this.data.zone === 'lifeStack' && c.faceDown && !this.game.seeAll()) other.push({ id: 'peek', label: 'Mirar' });
    }
    const order: SendToOption[] = [];
    if (this.canReorder()) {
      if (i > 0) order.push({ id: 'first', label: this.data.zone === 'deck' ? 'Al tope' : 'Al principio' }, { id: 'up', label: 'Subir una' });
      if (i < last) order.push({ id: 'down', label: 'Bajar una' }, { id: 'last', label: this.data.zone === 'deck' ? 'Al fondo' : 'Al final' });
    }
    const id = await this.choose({
      title: 'Enviar a…',
      subtitle: this.isHidden(c) ? 'Carta oculta' : (c.cardName ?? undefined),
      groups: [
        { label: 'Zona', options: this.editable() ? this.zones() : [] },
        { label: 'Orden en ' + ZONE_LABELS[this.data.zone].toLowerCase(), options: order },
        { label: 'Carta', options: [...other, { id: 'remove', label: 'Eliminar del juego', danger: true }] },
      ],
    });
    if (!id) return;
    if (id === 'remove') return this.remove(c);
    if (id === 'peek') return this.peek(c);
    this.asOwner(() => {
      if (id.startsWith('to:')) {
        const to = id.slice(3);
        if (to === 'deck-bottom') this.game.bulkToDeckBottom(this.data.zone, [c.instanceId], false);
        else this.move(c, to as ZoneName);
      } else if (id === 'flip') this.game.flipCard(c.instanceId, this.data.zone);
      else if (id === 'up') this.reorder(i, -1);
      else if (id === 'down') this.reorder(i, 1);
      else if (id === 'first') this.reorderTo(i, 0);
      else if (id === 'last') this.reorderTo(i, last);
    });
    this.selected.update((s) => {
      const next = new Set(s);
      next.delete(c.instanceId);
      return next;
    });
  }

  /** "Enviar selección a…": the same zones, or the deck's bottom in order or shuffled. */
  protected async sendSelected(): Promise<void> {
    const n = this.selected().size;
    const id = await this.choose({
      title: 'Enviar selección a…',
      subtitle: `${n} ${n === 1 ? 'carta' : 'cartas'}`,
      groups: [
        { label: 'Zona', options: this.destinations().map((d) => ({ id: `to:${d.zone}`, label: d.label })) },
        {
          label: 'Fondo del mazo',
          options: [
            { id: 'bottom', label: 'En el orden de aquí' },
            { id: 'bottom-random', label: 'En orden aleatorio' },
          ],
        },
      ],
    });
    if (!id) return;
    this.asOwner(() => {
      if (id === 'bottom') this.bulkBottom(false);
      else if (id === 'bottom-random') this.bulkBottom(true);
      else this.bulkMove(id.slice(3) as ZoneName);
    });
  }

  /** Runs the actions as the owner of the zone (the other side of a test room). */
  protected asOwner(actions: () => void): void {
    if (this.game.editorRoom() && this.owner()) this.game.actingAs(this.owner(), actions);
    else actions();
  }

  private readonly lookOnly = inject(SheetState).lowered;

  /** What the rules let me do with one of my cards here now. */
  protected actionsOf(c: CardSlot) {
    return this.data.opponent || this.lookOnly() ? [] : legalActions(this.game.rules(), c, this.data.zone);
  }

  protected effectsOf(c: CardSlot) {
    return this.actionsOf(c).includes('activate') ? this.game.rules().activatable.filter((e) => e.instanceId === c.instanceId) : [];
  }

  protected kindLabel(c: CardSlot): string {
    return specialKindLabel(c.specialSummonKind);
  }

  /** The server asks for the summoner and the materials. */
  protected special(c: CardSlot): void {
    this.ref.close();
    this.game.ritualSummon(c.instanceId);
  }

  protected activate(c: CardSlot, scriptId: string): void {
    this.ref.close();
    this.game.activateEffect(c.instanceId, scriptId);
  }

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
    const ids = this.cards().filter((c) => this.selected().has(c.instanceId)).map((c) => c.instanceId);
    this.game.bulkMove(ids, this.data.zone, to, { targetPlayerId: this.targetPlayer(), toPosition: to === 'deck' ? 'top' : undefined, faceDown: to === 'lifeStack' ? true : undefined });
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

  /** Puts a card first or last (the deck's top or bottom). */
  protected reorderTo(index: number, to: number): void {
    const ids = this.cards().map((c) => c.instanceId);
    const [id] = ids.splice(index, 1);
    ids.splice(to, 0, id);
    this.game.zoneReorder(this.data.zone, ids);
  }

  protected async remove(c: CardSlot): Promise<void> {
    const ok = await this.modal.confirm({ title: 'Eliminar carta', message: '¿Eliminar esta carta del juego por completo?', confirmLabel: 'Eliminar', danger: true });
    if (ok) this.game.removeCard(c.instanceId, this.data.zone, this.targetPlayer());
  }
}
