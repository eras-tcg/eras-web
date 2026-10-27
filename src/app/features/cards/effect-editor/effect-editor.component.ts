import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CardEffect, EffectBlock, USAGE_LIMITS, USAGE_LIMIT_LABELS } from '@data/cards/card.model';
import { emptyBlock } from '@data/cards/effect-rules';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { MultiselectComponent } from '@ui/forms/multiselect/multiselect.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

/**
 * Edits one card effect: instance, usage limit, kind, tags and its blocks
 * (activation condition : cost ; resolution). Keywords go inline as [[Keyword]] or [[Keyword:3]].
 */
@Component({
  selector: 'eras-effect-editor',
  imports: [FormFieldComponent, MultiselectComponent, GridComponent, StackComponent, CardComponent, ButtonComponent, IconComponent],
  template: `
    <eras-stack [gap]="3">
      <eras-grid minColumn="12rem" [gap]="3">
        <eras-form-field label="Instancia">
          <select (change)="instanceChange($any($event.target).value)">
            <option value="" [selected]="!value().instance">Ninguna</option>
            @for (i of withCurrent(instances(), value().instance); track i) {
              <option [value]="i" [selected]="i === value().instance">{{ i }}</option>
            }
          </select>
        </eras-form-field>
        <eras-form-field label="Límite de uso">
          <select (change)="set('ussageLimit', $any($event.target).value || null)">
            <option value="" [selected]="!value().ussageLimit">Sin límite</option>
            @for (u of usageLimits; track u) {
              <option [value]="u" [selected]="u === value().ussageLimit">{{ usageLabels[u] }}</option>
            }
          </select>
        </eras-form-field>
        <eras-form-field label="Tipo de efecto">
          <select (change)="set('kind', $any($event.target).value || null)">
            <option value="" [selected]="!value().kind">Ninguno</option>
            @for (k of withCurrent(kinds(), value().kind); track k) {
              <option [value]="k" [selected]="k === value().kind">{{ k }}</option>
            }
          </select>
        </eras-form-field>
      </eras-grid>

      <eras-multiselect label="Tags" placeholder="Ninguno" [options]="tags()" [value]="value().tags ?? []" (valueChange)="set('tags', $event)" />

      @for (block of blocks(); track $index; let i = $index) {
        <eras-card padding="sm">
          <eras-stack [gap]="2">
            <eras-stack direction="row" justify="space-between" align="center">
              <strong>Bloque {{ i + 1 }}</strong>
              @if (blocks().length > 1) {
                <button erasButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Quitar bloque ' + (i + 1)" (click)="removeBlock(i)"><eras-icon name="x" /></button>
              }
            </eras-stack>
            <eras-form-field label="Condición de activación">
              <input [value]="block.activationCondition ?? ''" (input)="setBlock(i, 'activationCondition', $any($event.target).value)" />
            </eras-form-field>
            <eras-form-field label="Coste">
              <input [value]="block.cost ?? ''" (input)="setBlock(i, 'cost', $any($event.target).value)" />
            </eras-form-field>
            <eras-form-field label="Resolución" hint="Keywords entre corchetes dobles: [[Celeridad]] o [[Provocar {nivel}:3]]">
              <textarea rows="2" [value]="block.resolution ?? ''" (input)="setBlock(i, 'resolution', $any($event.target).value)"></textarea>
            </eras-form-field>
          </eras-stack>
        </eras-card>
      }
      <div>
        <button erasButton variant="secondary" size="sm" type="button" (click)="addBlock()"><eras-icon name="plus" /> Agregar bloque</button>
      </div>
    </eras-stack>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectEditorComponent {
  readonly value = input.required<CardEffect>();
  readonly instances = input<readonly string[]>([]);
  readonly kinds = input<readonly string[]>([]);
  readonly tags = input<readonly string[]>([]);
  /** Default kind per instance, applied when the instance changes. */
  readonly instanceKinds = input<Record<string, string | null | undefined>>({});
  readonly valueChange = output<CardEffect>();

  protected readonly usageLimits = USAGE_LIMITS;
  protected readonly usageLabels = USAGE_LIMIT_LABELS;

  /** Keeps a stored value selectable even when it is no longer in the reference list (so saving does not drop it). */
  protected withCurrent(options: readonly string[], current: string | null | undefined): readonly string[] {
    return current && !options.includes(current) ? [current, ...options] : options;
  }

  protected blocks(): EffectBlock[] {
    const blocks = this.value().effectBlocks ?? [];
    return blocks.length ? blocks : [emptyBlock()];
  }

  protected set<K extends keyof CardEffect>(key: K, v: CardEffect[K]): void {
    this.valueChange.emit({ ...this.value(), [key]: v });
  }

  protected instanceChange(instance: string): void {
    const mapped = instance ? this.instanceKinds()[instance] : null;
    this.valueChange.emit({ ...this.value(), instance: instance || null, kind: mapped ?? this.value().kind ?? null });
  }

  protected setBlock(index: number, key: keyof EffectBlock, text: string): void {
    this.set('effectBlocks', this.blocks().map((b, i) => (i === index ? { ...b, [key]: text } : b)));
  }

  protected addBlock(): void {
    this.set('effectBlocks', [...this.blocks(), emptyBlock()]);
  }

  protected removeBlock(index: number): void {
    this.set('effectBlocks', this.blocks().filter((_, i) => i !== index));
  }
}
