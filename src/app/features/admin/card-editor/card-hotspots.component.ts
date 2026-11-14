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
import { applyCode, classMatches, defaultSummonKind } from './card-editor-rules';
import { Zone, ZoneKey } from './render/card-zones';

const W = 744;
const H = 1039;
type TextKey = 'name' | 'regulation' | 'requirement' | 'code';
type NumberKey = 'cost' | 'strength' | 'level' | 'specialCost';
const NUMBER_KEYS: ZoneKey[] = ['cost', 'strength', 'level', 'specialCost'];
const TEXT_KEYS: ZoneKey[] = ['name', 'regulation', 'requirement', 'code'];
const NUMBER_FIELD: Record<NumberKey, keyof MetaForm> = {
  cost: 'cost',
  strength: 'strength',
  level: 'level',
  specialCost: 'specialCost',
};
const TEXT_FIELD: Record<Exclude<TextKey, 'code'>, keyof MetaForm> = {
  name: 'cardName',
  regulation: 'regulation',
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
        } @else if (z.key === 'specialRemove') {
          <span aria-hidden="true">🗑</span>
        }
      </button>
    }

    @if (editing(); as z) {
      <div
        class="editor"
        [class.above]="z.rect[1] > H * 0.6"
        [style.left.%]="(z.rect[0] / W) * 100"
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
          @case ('rarity') {
            <div class="options" role="listbox" [attr.aria-label]="labels[z.key]">
              @for (r of rarities; track r) {
                <button
                  type="button"
                  role="option"
                  [attr.aria-selected]="form().rarity === r"
                  (click)="setRarity(r)"
                >
                  {{ r }}
                </button>
              }
              <button
                type="button"
                role="option"
                [attr.aria-selected]="!form().rarity"
                (click)="setRarity(null)"
              >
                —
              </button>
            </div>
          }
          @case ('kind') {
            <div class="options" role="listbox" [attr.aria-label]="labels[z.key]">
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
    .options button[aria-selected='true'] {
      border-color: var(--color-primary);
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
    code: 'Código',
    rarity: 'Rareza',
    regulation: 'Regulación',
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

  protected kindOf(key: ZoneKey): 'number' | 'text' | 'rarity' | 'kind' | 'classes' | null {
    if (NUMBER_KEYS.includes(key)) return 'number';
    if (TEXT_KEYS.includes(key)) return 'text';
    if (key === 'rarity') return 'rarity';
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
    const f = this.form();
    if (key === 'code')
      return `${f.edition}-${f.colorIdentity ?? ''}${String(f.cardNumber ?? '').padStart(2, '0')}`;
    return String(f[TEXT_FIELD[key as Exclude<TextKey, 'code'>]] ?? '');
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
    if (key === 'code') this.form.update((f) => applyCode(f, raw));
    else
      this.form.update((f) => ({
        ...f,
        [TEXT_FIELD[key as Exclude<TextKey, 'code'>]]: raw.trim(),
      }));
    this.close();
  }

  protected setRarity(r: string | null): void {
    this.form.update((f) => ({ ...f, rarity: r }));
    this.close();
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
