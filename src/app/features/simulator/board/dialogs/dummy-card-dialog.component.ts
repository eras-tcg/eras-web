import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { CARD_TYPE_LABELS, CatalogCard, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { GameStore } from '@data/simulator/game.store';
import { DummyCard, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** Where a test card goes: a zone, and for the field the line, for the deck and lives the end. */
interface Place {
  id: string;
  label: string;
  zone: ZoneName;
  position?: 'top' | 'bottom';
  y?: number;
  faceDown?: boolean;
}

const PLACES: Place[] = [
  { id: 'hand', label: 'Mano', zone: 'hand' },
  { id: 'front', label: 'Línea frontal', zone: 'field', y: 25 },
  { id: 'back', label: 'Retaguardia', zone: 'field', y: 75 },
  { id: 'deck-top', label: 'Tope del mazo', zone: 'deck', position: 'top' },
  { id: 'deck-bottom', label: 'Fondo del mazo', zone: 'deck', position: 'bottom' },
  { id: 'life', label: 'Tope de las vidas', zone: 'lifeStack', position: 'top', faceDown: true },
  { id: 'tributes', label: 'Tributos', zone: 'tributeZone' },
  { id: 'discard', label: 'Descarte', zone: 'discardPile' },
];

const COLORS = [
  { id: 'B', label: 'Azul' },
  { id: 'G', label: 'Verde' },
  { id: 'P', label: 'Violeta' },
  { id: 'R', label: 'Rojo' },
  { id: 'W', label: 'Blanco' },
];

const list = (text: string) =>
  text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const num = (text: string) => (text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text));

/**
 * Test room: makes a card up (or copies a real one, which then has its effects: the engine finds them by name)
 * and places it in a zone of either side.
 */
/** The highest "Dummy N" created from this board, by room. */
const lastDummy = new Map<string, number>();

@Component({
  selector: 'eras-dummy-card-dialog',
  imports: [ModalComponent, FormFieldComponent, ButtonComponent, GameCardComponent],
  template: `
    <eras-modal title="Carta de prueba" subtitle="Se coloca directamente: no se invoca ni se juega." size="lg" (closed)="ref.close()">
      <div class="layout">
        <eras-game-card class="preview" [imageUrl]="imageUrl()" [name]="name() || '?'" [strength]="type() === 'creature' ? num(strength()) : null" />
        <form class="fields" (submit)="$event.preventDefault(); create()">
          <eras-form-field label="Copiar una carta real (opcional)" hint="Toma sus propiedades, su imagen y sus efectos.">
            <input type="search" list="dummy-real-cards" placeholder="Nombre de la carta…" [value]="copyQuery()" (input)="copyFrom($any($event.target).value)" />
            <datalist id="dummy-real-cards">
              @for (c of suggestions(); track c.id) {
                <option [value]="c.meta?.cardName ?? c.name ?? ''">{{ c.edition }}</option>
              }
            </datalist>
          </eras-form-field>

          <div class="grid">
            <eras-form-field label="Nombre">
              <input type="text" required [value]="name()" (input)="name.set($any($event.target).value); unlink()" />
            </eras-form-field>
            <eras-form-field label="Tipo">
              <select [value]="type()" (change)="type.set($any($event.target).value)">
                @for (t of types; track t.id) {
                  <option [value]="t.id" [selected]="t.id === type()">{{ t.label }}</option>
                }
              </select>
            </eras-form-field>
            <eras-form-field label="Coste">
              <input type="number" [value]="cost()" (input)="cost.set($any($event.target).value)" />
            </eras-form-field>
            <eras-form-field label="Nivel">
              <input type="number" [value]="level()" (input)="level.set($any($event.target).value)" />
            </eras-form-field>
            @if (type() === 'creature') {
              <eras-form-field label="Fuerza">
                <input type="number" [value]="strength()" (input)="strength.set($any($event.target).value)" />
              </eras-form-field>
              <eras-form-field label="Invocación especial">
                <select [value]="specialKind()" (change)="specialKind.set($any($event.target).value)">
                  <option value="" [selected]="!specialKind()">Ninguna</option>
                  @for (k of specialKinds; track k.id) {
                    <option [value]="k.id" [selected]="k.id === specialKind()">{{ k.label }}</option>
                  }
                </select>
              </eras-form-field>
              @if (specialKind()) {
                <eras-form-field label="Coste especial">
                  <input type="number" [value]="specialCost()" (input)="specialCost.set($any($event.target).value)" />
                </eras-form-field>
                <eras-form-field label="Requerimiento">
                  <input type="text" placeholder="criatura nivel 2" [value]="requirement()" (input)="requirement.set($any($event.target).value)" />
                </eras-form-field>
              }
            }
            <eras-form-field label="Clases" hint="Separadas por coma: ente, dragón">
              <input type="text" [value]="classes()" (input)="classes.set($any($event.target).value)" />
            </eras-form-field>
            <eras-form-field label="Habilidades" hint="Separadas por coma: Provocar, Letalidad 1">
              <input type="text" [value]="keywords()" (input)="keywords.set($any($event.target).value)" />
            </eras-form-field>
          </div>

          <fieldset class="colors">
            <legend>Colores</legend>
            @for (c of colorOptions; track c.id) {
              <label><input type="checkbox" [checked]="colors().includes(c.id)" (change)="toggleColor(c.id)" /> {{ c.label }}</label>
            }
          </fieldset>

          <div class="grid">
            <eras-form-field label="Lado">
              <select [value]="side()" (change)="side.set($any($event.target).value)">
                @for (p of game.sides(); track p.userId) {
                  <option [value]="p.userId" [selected]="p.userId === side()">{{ p.username }}</option>
                }
              </select>
            </eras-form-field>
            <eras-form-field label="Dónde">
              <select [value]="place()" (change)="place.set($any($event.target).value)">
                @for (p of places; track p.id) {
                  <option [value]="p.id" [selected]="p.id === place()">{{ p.label }}</option>
                }
              </select>
            </eras-form-field>
          </div>
          <label class="check"><input type="checkbox" [checked]="faceDown()" (change)="faceDown.set(!faceDown())" /> Boca abajo</label>
          <label class="check">
            <input type="checkbox" [checked]="randomEmpty()" (change)="randomEmpty.set(!randomEmpty())" />
            Completar al azar lo que dejes vacío (nombre, coste, nivel, fuerza, clases, habilidades, colores)
          </label>
        </form>
      </div>
      <ng-container modal-footer>
        <button erasButton variant="ghost" type="button" (click)="ref.close()">Cerrar</button>
        <button erasButton variant="secondary" type="button" [disabled]="!canCreate()" (click)="create(false)">Crear y seguir</button>
        <button erasButton type="button" [disabled]="!canCreate()" (click)="create()">Crear</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-4); align-items: start; }
    .preview { --game-card-width: 9rem; }
    .fields { display: grid; gap: var(--space-3); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: var(--space-3); }
    .colors { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: 0; padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .colors legend { padding-inline: var(--space-1); font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .colors label, .check { display: inline-flex; gap: var(--space-1); align-items: center; }
    @media (max-width: 40rem) { .layout { grid-template-columns: 1fr; } .preview { justify-self: center; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DummyCardDialogComponent {
  protected readonly ref = inject(DialogRef);
  protected readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);

  protected readonly types = Object.entries(CARD_TYPE_LABELS).map(([id, label]) => ({ id, label }));
  protected readonly specialKinds = Object.entries(SPECIAL_SUMMON_LABELS).map(([id, label]) => ({ id, label }));
  protected readonly colorOptions = COLORS;
  protected readonly places = PLACES;
  protected readonly num = num;

  protected readonly copyQuery = signal('');
  /** The real card copied (its art and id), while the name is not changed. */
  private readonly copied = signal<CatalogCard | null>(null);
  protected readonly name = signal(this.nextDummyName());
  protected readonly type = signal<DummyCard['cardType']>('creature');
  protected readonly cost = signal('1');
  protected readonly level = signal('1');
  protected readonly strength = signal('1');
  protected readonly specialKind = signal('');
  protected readonly specialCost = signal('');
  protected readonly requirement = signal('');
  protected readonly classes = signal('');
  protected readonly keywords = signal('');
  protected readonly colors = signal<string[]>(['W']);
  /** The other side by default (the test room's rival). */
  protected readonly side = signal(this.game.sides()[1]?.userId ?? this.game.myState()?.userId ?? '');
  protected readonly place = signal('front');
  protected readonly faceDown = signal(false);
  /** Empty fields get a random value when it is created. */
  protected readonly randomEmpty = signal(false);
  protected readonly canCreate = computed(() => !!this.name().trim() || this.randomEmpty());

  protected readonly imageUrl = computed(() => this.copied()?.image_url ?? null);
  /** Real cards whose name starts with what was typed (the datalist filters the rest). */
  protected readonly suggestions = computed(() => {
    const q = this.copyQuery().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.cards.cards().filter((c) => (c.meta?.cardName ?? c.name ?? '').toLowerCase().includes(q)).slice(0, 30);
  });

  constructor() {
    void this.cards.load();
  }

  /** Typing a real card's exact name copies it. */
  protected copyFrom(query: string): void {
    this.copyQuery.set(query);
    const q = query.trim().toLowerCase();
    const card = this.cards.cards().find((c) => (c.meta?.cardName ?? c.name ?? '').toLowerCase() === q);
    if (!card) return;
    const m = card.meta;
    this.copied.set(card);
    this.name.set(m?.cardName ?? card.name ?? '');
    this.type.set((m?.cardType as DummyCard['cardType']) ?? 'creature');
    this.cost.set(m?.cost?.toString() ?? '');
    this.level.set(m?.level?.toString() ?? '');
    this.strength.set(m?.strength?.toString() ?? '');
    this.specialKind.set(m?.specialSummonKind ?? '');
    this.specialCost.set(m?.specialCost?.toString() ?? '');
    this.requirement.set(m?.requirement ?? '');
    this.classes.set((m?.cardClasses ?? []).join(', '));
    // "Letalidad {cantidad}" + 1 → "Letalidad 1", as the server reads them
    this.keywords.set(
      (m?.keywordEffects ?? [])
        .filter((k) => k.keyword)
        .map((k) => (k.keyword ?? '').replace(/\{[^}]*\}/g, k.number != null ? String(k.number) : '').replace(/\s+/g, ' ').trim())
        .join(', '),
    );
    this.colors.set([...new Set([m?.colorIdentity, ...(m?.colors ?? [])].filter((c): c is string => !!c))]);
  }

  /** A new name makes it a made-up card (no art). */
  protected unlink(): void {
    this.copied.set(null);
  }

  /**
   * "Dummy N": the next number after the test cards already in the game and those created from this board (a card hidden from
   * this side, as the rival's hand or a deck, does not show its name, and the broadcast of the last one may not have arrived).
   */
  private nextDummyName(): string {
    let max = lastDummy.get(this.game.state()?.roomId ?? '') ?? 0;
    for (const p of Object.values(this.game.state()?.players ?? {})) {
      for (const zone of [p.hand, p.deck, p.lifeStack, p.tributeZone, p.discardPile, p.field]) {
        for (const c of [...zone, ...zone.flatMap((x) => [...x.materials, ...x.resources])]) {
          const n = /^Dummy (\d+)$/.exec(c.cardName ?? '')?.[1];
          if (n) max = Math.max(max, Number(n));
        }
      }
    }
    return `Dummy ${max + 1}`;
  }

  /** Classes and abilities to draw from: the reference data, else a few common ones. */
  private pools() {
    const ref = this.cards.ref();
    const classes = ref?.classes?.length ? ref.classes : ['ente', 'bestia', 'dragón', 'caballero'];
    const keywords = Object.keys(ref?.keywordEffects ?? {}).map((k) => k.replace(/\{[^}]*\}/g, String(1 + Math.floor(Math.random() * 3))).replace(/\s+/g, ' ').trim());
    return { classes, keywords: keywords.length ? keywords : ['Provocar', 'Celeridad', 'Letalidad 1', 'Perforante', 'Imbloqueable', 'Enfrentar 2', 'Furia 1'] };
  }

  protected toggleColor(id: string): void {
    this.colors.update((list) => (list.includes(id) ? list.filter((c) => c !== id) : [...list, id]));
  }

  protected create(close = true): void {
    const place = PLACES.find((p) => p.id === this.place()) ?? PLACES[0];
    const creature = this.type() === 'creature';
    const random = this.randomEmpty();
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
    const between = (min: number, max: number) => String(min + Math.floor(Math.random() * (max - min + 1)));
    const fill = (value: string, make: () => string) => (random && !value.trim() ? make() : value);
    const { classes, keywords } = this.pools();
    const card: DummyCard = {
      zone: place.zone,
      position: place.position,
      y: place.y,
      faceDown: this.faceDown() || !!place.faceDown,
      cardId: this.copied()?.id ?? null,
      imageUrl: this.copied()?.image_url ?? null,
      cardName: fill(this.name(), () => this.nextDummyName()).trim(),
      cardType: this.type(),
      cost: num(fill(this.cost(), () => between(0, 6))),
      level: num(fill(this.level(), () => between(1, 5))),
      strength: creature ? num(fill(this.strength(), () => between(1, 12))) : null,
      specialSummonKind: creature && this.specialKind() ? this.specialKind() : null,
      specialCost: creature && this.specialKind() ? num(this.specialCost()) : null,
      requirement: creature && this.specialKind() ? this.requirement().trim() || null : null,
      colors: random && !this.colors().length ? [pick(COLORS).id] : this.colors(),
      classes: list(fill(this.classes(), () => pick(classes))),
      keywords: list(fill(this.keywords(), () => pick(keywords))),
    };
    this.game.actingAs(this.side() || null, () => this.game.createDummy(card));
    const created = /^Dummy (\d+)$/.exec(card.cardName)?.[1];
    const room = this.game.state()?.roomId ?? '';
    if (created) lastDummy.set(room, Math.max(lastDummy.get(room) ?? 0, Number(created)));
    if (close) {
      this.ref.close();
      return;
    }
    // The next one gets the next number (the broadcast may not have arrived yet)
    const n = /^Dummy (\d+)$/.exec(card.cardName)?.[1];
    if (n) this.name.set(`Dummy ${Number(n) + 1}`);
  }
}
