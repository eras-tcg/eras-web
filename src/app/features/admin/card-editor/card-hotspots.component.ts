import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CARD_RARITIES, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { MetaForm } from '@data/cards/meta-rules';
import { classMatches, defaultSummonKind } from './card-editor-rules';
import { Zone, ZoneKey } from './render/card-zones';

const W = 744;
const H = 1039;
type TextKey = 'name' | 'requirement';
type NumberKey = 'cost' | 'strength' | 'level' | 'specialCost';
const NUMBER_KEYS: ZoneKey[] = ['cost', 'strength', 'level', 'specialCost'];
const TEXT_KEYS: ZoneKey[] = ['name', 'requirement'];
const NUMBER_FIELD: Record<NumberKey, keyof MetaForm> = {
  cost: 'cost',
  strength: 'strength',
  level: 'level',
  specialCost: 'specialCost',
};
const TEXT_FIELD: Record<TextKey, keyof MetaForm> = {
  name: 'cardName',
  requirement: 'requirement',
};

/** Clickable areas over the card preview: each opens a small editor for that value. */
@Component({
  selector: 'eras-card-hotspots',
  template: `
    @for (z of zones(); track z.key) {
      <button
        type="button"
        class="zone"
        [class.add]="z.key === 'specialAdd'"
        [class.remove]="z.key === 'specialRemove'"
        [class.starter]="z.key === 'starter'"
        [class.on]="z.key === 'starter' && form().starter"
        [class.active]="active() === z.key"
        [style.left.%]="(z.rect[0] / W) * 100"
        [style.top.%]="(z.rect[1] / H) * 100"
        [style.width.%]="((z.rect[2] - z.rect[0]) / W) * 100"
        [style.height.%]="((z.rect[3] - z.rect[1]) / H) * 100"
        [attr.aria-label]="labels[z.key]"
        (pointerdown)="$event.stopPropagation()"
        (click)="activate(z.key)"
      >
        @if (z.key === 'specialAdd') {
          <span>Añadir invocación especial</span>
        } @else if (z.key === 'starter' && !form().starter) {
          <span class="proposal">Iniciador</span>
        } @else if (z.key === 'specialRemove') {
          <span aria-hidden="true">🗑</span>
        }
      </button>
    }

    @if (editing(); as z) {
      <div
        class="editor"
        [class.above]="z.rect[1] > H * 0.6"
        [style.left.%]="z.rect[0] > W * 0.55 ? null : (z.rect[0] / W) * 100"
        [style.right.%]="z.rect[0] > W * 0.55 ? 100 - (z.rect[2] / W) * 100 : null"
        [style.top.%]="z.rect[1] > H * 0.6 ? null : (z.rect[3] / H) * 100"
        [style.bottom.%]="z.rect[1] > H * 0.6 ? 100 - (z.rect[1] / H) * 100 : null"
        (pointerdown)="$event.stopPropagation()"
      >
        @switch (kindOf(z.key)) {
          @case ('number') {
            <input
              #field
              type="number"
              min="0"
              [attr.aria-label]="labels[z.key]"
              [value]="numberValue(z.key)"
              (keydown.enter)="commitNumber(z.key, $any($event.target).value)"
              (keydown.escape)="close()"
              (blur)="commitNumber(z.key, $any($event.target).value)"
            />
          }
          @case ('text') {
            <input
              #field
              type="text"
              [attr.aria-label]="labels[z.key]"
              [value]="textValue(z.key)"
              (keydown.enter)="commitText(z.key, $any($event.target).value)"
              (keydown.escape)="close()"
              (blur)="commitText(z.key, $any($event.target).value)"
            />
          }
          @case ('code') {
            <div class="code-menu">
              <label
                >Edición
                <input
                  #field
                  type="text"
                  [value]="form().edition"
                  (change)="setField('edition', $any($event.target).value.trim().toUpperCase())"
                  (keydown.escape)="close()"
              /></label>
              <label
                >Número
                <input
                  type="number"
                  min="0"
                  [value]="form().cardNumber ?? ''"
                  (change)="setNumberField($any($event.target).value)"
                  (keydown.escape)="close()"
              /></label>
              <span class="fixed">Color: {{ colorLetters() || '—' }}</span>
              <span class="fixed">Rareza</span>
              <div class="options" role="listbox" aria-label="Rareza">
                @for (r of rarities; track r) {
                  <button
                    type="button"
                    role="option"
                    [attr.aria-selected]="form().rarity === r"
                    (click)="setField('rarity', r)"
                  >
                    {{ r }}
                  </button>
                }
                <button
                  type="button"
                  role="option"
                  [attr.aria-selected]="!form().rarity"
                  (click)="setField('rarity', null)"
                >
                  —
                </button>
              </div>
              <label
                >Regulación
                <input
                  type="text"
                  maxlength="2"
                  [value]="form().regulation"
                  (change)="setField('regulation', $any($event.target).value.trim().toUpperCase())"
                  (keydown.escape)="close()"
              /></label>
              <button type="button" class="done" (click)="close()">Listo</button>
            </div>
          }
          @case ('kind') {
            <div class="options column" role="listbox" [attr.aria-label]="labels[z.key]">
              @for (k of kinds; track k) {
                <button
                  type="button"
                  role="option"
                  [attr.aria-selected]="form().specialSummonKind === k"
                  (click)="setKind(k)"
                >
                  {{ kindLabels[k] }}
                </button>
              }
            </div>
          }
          @case ('classes') {
            <div class="classes">
              @for (c of form().cardClasses; track c) {
                <button
                  type="button"
                  class="chip"
                  [attr.aria-label]="'Quitar ' + c"
                  (click)="removeClass(c)"
                >
                  {{ c }} ×
                </button>
              }
              <input
                #field
                type="text"
                aria-label="Añadir clase"
                [value]="classQuery()"
                (input)="classQuery.set($any($event.target).value)"
                (keydown.enter)="addClass(classQuery())"
                (keydown.escape)="close()"
              />
              @if (suggestions().length) {
                <div class="options" role="listbox" aria-label="Clases">
                  @for (s of suggestions(); track s) {
                    <button type="button" role="option" aria-selected="false" (click)="addClass(s)">
                      {{ s }}
                    </button>
                  }
                </div>
              }
            </div>
          }
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
    }
    .zone {
      position: absolute;
      padding: 0;
      border: 1px dashed transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      cursor: pointer;
    }
    .zone:hover,
    .zone.active {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }
    .zone.starter .proposal {
      display: grid;
      place-items: center;
      block-size: 100%;
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--color-surface) 85%, transparent);
      color: var(--color-text);
      font-size: var(--font-size-sm);
      font-weight: 700;
      opacity: 0;
    }
    .zone.starter:hover .proposal {
      opacity: 0.85;
    }
    .zone.add {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-surface) 80%, transparent);
      color: var(--color-text);
      font-size: var(--font-size-sm);
    }
    .zone.remove {
      background: var(--color-surface);
      border-color: var(--color-border);
      font-size: var(--font-size-sm);
      line-height: 1;
    }
    .editor {
      position: absolute;
      z-index: 2;
      min-inline-size: 12rem;
      max-inline-size: 22rem;
      padding: var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
    }
    .editor input {
      inline-size: 100%;
    }
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin-block-start: var(--space-1);
    }
    .options button,
    .chip {
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-muted);
      color: var(--color-text);
      cursor: pointer;
    }
    .options.column {
      flex-direction: column;
      align-items: stretch;
    }
    .editor:has(.column) {
      min-inline-size: 10rem;
    }
    .options button[aria-selected='true'] {
      border-color: var(--color-primary);
    }
    .code-menu {
      display: grid;
      gap: var(--space-2);
    }
    .code-menu label {
      display: grid;
      gap: var(--space-1);
      font-size: var(--font-size-sm);
    }
    .fixed {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
    .done {
      justify-self: end;
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-muted);
      color: var(--color-text);
      cursor: pointer;
    }
    .classes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardHotspotsComponent {
  readonly zones = input.required<Zone[]>();
  readonly form = model.required<MetaForm>();
  /** Known classes, for the suggestions. */
  readonly classes = input<string[]>([]);
  /** A click on an effect box (its editor lives in the page). */
  readonly effectZone = output<Zone>();

  protected readonly W = W;
  protected readonly H = H;
  protected readonly rarities = CARD_RARITIES;
  protected readonly kinds = Object.keys(SPECIAL_SUMMON_LABELS);
  protected readonly kindLabels = SPECIAL_SUMMON_LABELS;
  protected readonly labels: Record<ZoneKey, string> = {
    cost: 'Coste',
    strength: 'Fuerza',
    level: 'Nivel',
    name: 'Nombre',
    classes: 'Clases',
    starter: 'Iniciador',
    code: 'Código, rareza y regulación',
    specialAdd: 'Añadir invocación especial',
    specialCost: 'Coste especial',
    specialKind: 'Método de invocación especial',
    requirement: 'Requerimiento',
    specialRemove: 'Quitar invocación especial',
    effects: 'Efectos',
    inheritEffects: 'Efectos heredados',
    formationEffects: 'Efectos de enlace',
  };

  protected readonly active = signal<ZoneKey | null>(null);
  protected readonly editing = computed(
    () => this.zones().find((z) => z.key === this.active()) ?? null,
  );
  protected readonly classQuery = signal('');
  protected readonly suggestions = computed(() =>
    classMatches(this.classQuery(), this.classes(), this.form().cardClasses),
  );
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    // Focus the field of the editor that just opened.
    effect(() => {
      const f = this.field();
      f?.nativeElement.focus();
    });
  }

  protected kindOf(key: ZoneKey): 'number' | 'text' | 'code' | 'kind' | 'classes' | null {
    if (NUMBER_KEYS.includes(key)) return 'number';
    if (key === 'code') return 'code';
    if (TEXT_KEYS.includes(key)) return 'text';
    if (key === 'specialKind') return 'kind';
    if (key === 'classes') return 'classes';
    return null;
  }

  protected activate(key: ZoneKey): void {
    const zone = this.zones().find((z) => z.key === key)!;
    if (key === 'effects' || key === 'inheritEffects' || key === 'formationEffects') {
      this.active.set(null);
      this.effectZone.emit(zone);
      return;
    }
    if (key === 'starter') {
      this.form.update((f) => ({ ...f, starter: !f.starter }));
      this.active.set(null);
      return;
    }
    if (key === 'specialAdd') {
      this.form.update((f) => ({ ...f, specialSummonKind: defaultSummonKind(f) }));
      this.active.set(null);
      return;
    }
    if (key === 'specialRemove') {
      this.form.update((f) => ({
        ...f,
        specialSummonKind: null,
        specialCost: null,
        requirement: '',
      }));
      this.active.set(null);
      return;
    }
    this.classQuery.set('');
    this.active.set(this.active() === key ? null : key);
  }

  protected close(): void {
    this.active.set(null);
  }

  protected numberValue(key: ZoneKey): string {
    const v = this.form()[NUMBER_FIELD[key as NumberKey]];
    return v === null || v === undefined ? '' : String(v);
  }

  protected textValue(key: ZoneKey): string {
    return String(this.form()[TEXT_FIELD[key as TextKey]] ?? '');
  }

  protected commitNumber(key: ZoneKey, raw: string): void {
    if (this.active() !== key) return;
    const value = raw.trim() === '' ? null : Math.max(0, Math.round(Number(raw)));
    this.form.update((f) => ({
      ...f,
      [NUMBER_FIELD[key as NumberKey]]: Number.isNaN(value) ? null : value,
    }));
    this.close();
  }

  protected commitText(key: ZoneKey, raw: string): void {
    if (this.active() !== key) return;
    this.form.update((f) => ({ ...f, [TEXT_FIELD[key as TextKey]]: raw.trim() }));
    this.close();
  }

  /** Color letters of the code: the card's colors, not editable here. */
  protected readonly colorLetters = computed(() => {
    const f = this.form();
    return f.colors.length ? f.colors.join('') : (f.colorIdentity ?? '');
  });

  protected setField<K extends 'edition' | 'rarity' | 'regulation'>(
    key: K,
    value: MetaForm[K],
  ): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected setNumberField(raw: string): void {
    const n = raw.trim() === '' ? null : Math.max(0, Math.round(Number(raw)));
    this.form.update((f) => ({ ...f, cardNumber: n === null || Number.isNaN(n) ? null : n }));
  }

  protected setKind(k: string): void {
    this.form.update((f) => ({ ...f, specialSummonKind: k }));
    this.close();
  }

  protected addClass(raw: string): void {
    const c = raw.trim().toLowerCase();
    if (!c) return;
    this.form.update((f) =>
      f.cardClasses.includes(c) ? f : { ...f, cardClasses: [...f.cardClasses, c] },
    );
    this.classQuery.set('');
    queueMicrotask(() => this.field()?.nativeElement.focus());
  }

  protected removeClass(c: string): void {
    this.form.update((f) => ({ ...f, cardClasses: f.cardClasses.filter((x) => x !== c) }));
  }
}
