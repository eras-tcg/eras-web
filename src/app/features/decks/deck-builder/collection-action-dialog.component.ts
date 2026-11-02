import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { CRAFT_COST, FINISHES, FINISH_LABELS, breakPlan, craftedSummary, fragmentsFrom } from '@data/collection/collection-rules';
import { Finish } from '@data/collection/collection.model';
import { CollectionStore } from '@data/collection/collection.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** craft: n copies · break: n copies, the plainest first · finish: crafting until a finish, spending at most a limit. */
export type CollectionAction = 'craft' | 'break' | 'finish';

export interface CollectionActionData {
  card: CatalogCard;
  action: CollectionAction;
}

const TITLES: Record<CollectionAction, string> = { craft: 'Fabricar', break: 'Romper', finish: 'Fabricar acabado' };
const TARGETS: ToggleOption[] = [
  { value: 'foil', label: FINISH_LABELS.foil },
  { value: 'prism', label: FINISH_LABELS.prism },
];

/** Crafting or breaking copies of a card from the deck builder's collection panel; it shows what came out. */
@Component({
  selector: 'eras-collection-action-dialog',
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, ToggleGroupComponent, AlertComponent],
  template: `
    <eras-modal [title]="title + ' · ' + (data.card.name ?? '')" (closed)="ref.close()">
      @if (result(); as text) {
        <p class="result" role="status">{{ text }}</p>
      } @else {
        <div class="form">
          @if (data.action === 'finish') {
            <eras-toggle-group label="Acabado" [options]="targets" [selected]="[target()]" (toggled)="target.set($any($event))" />
            <eras-form-field label="Máximo de fragmentos a gastar">
              <input type="number" min="30" [step]="cost" [max]="fragments()" [value]="amount()" (input)="setAmount($event)" />
            </eras-form-field>
          } @else {
            <eras-form-field label="Copias">
              <input type="number" min="1" [max]="max()" [value]="amount()" (input)="setAmount($event)" />
            </eras-form-field>
          }
          <p class="hint">{{ summary() }}</p>
        </div>
      }
      @if (collection.error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      <ng-container modal-footer>
        @if (result()) {
          <button erasButton type="button" (click)="ref.close()">Cerrar</button>
        } @else {
          <button erasButton variant="ghost" type="button" (click)="ref.close()">Cancelar</button>
          <button erasButton type="button" [loading]="collection.busy()" [disabled]="!valid()" (click)="run()">{{ title }}</button>
        }
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: var(--space-3); }
    .hint, .result { margin: 0; color: var(--color-text-muted); }
    .result { color: var(--color-text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionActionDialogComponent {
  protected readonly data = inject<CollectionActionData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly collection = inject(CollectionStore);

  protected readonly title = TITLES[this.data.action];
  protected readonly targets = TARGETS;
  protected readonly cost = CRAFT_COST;
  private readonly rarity = this.data.card.meta?.rarity || 'C';
  private readonly copies = computed(() => this.collection.collection()?.cards[this.data.card.id] ?? {});
  private readonly owned = computed(() => FINISHES.reduce((sum, f) => sum + (this.copies()[f] ?? 0), 0));
  protected readonly fragments = computed(() => this.collection.fragments()[this.rarity] ?? 0);
  /** The most copies this can take (craft: what the fragments pay; break: the copies owned). */
  protected readonly max = computed(() => (this.data.action === 'break' ? this.owned() : Math.floor(this.fragments() / CRAFT_COST)));
  protected readonly amount = signal(this.data.action === 'finish' ? this.collection.fragments()[this.rarity] ?? 0 : 1);
  protected readonly target = signal<Finish>('foil');
  protected readonly result = signal<string | null>(null);

  protected readonly valid = computed(() =>
    this.data.action === 'finish' ? this.amount() >= CRAFT_COST && this.amount() <= this.fragments() : this.amount() >= 1 && this.amount() <= this.max(),
  );

  protected readonly summary = computed(() => {
    const n = this.amount();
    const have = `Tienes ${this.fragments()} fragmentos ${this.rarity}.`;
    if (this.data.action === 'craft') return `Gastas ${n * CRAFT_COST} fragmentos ${this.rarity}. ${have}`;
    if (this.data.action === 'finish') {
      return `Fabrica hasta obtenerla en ${FINISH_LABELS[this.target()].toLowerCase()}: hasta ${Math.floor(n / CRAFT_COST)} intentos. ${have}`;
    }
    const plan = breakPlan(this.copies(), n);
    const parts = FINISHES.filter((f) => plan[f]).map((f) => `${plan[f]} ${FINISH_LABELS[f].toLowerCase()}`);
    return `Se rompen ${parts.join(', ') || 'ninguna'} (las más simples primero): +${fragmentsFrom(plan)} fragmentos ${this.rarity}.`;
  });

  protected setAmount(event: Event): void {
    const value = Math.floor(Number((event.target as HTMLInputElement).value));
    this.amount.set(Number.isFinite(value) ? Math.max(0, value) : 0);
  }

  protected async run(): Promise<void> {
    const id = this.data.card.id;
    if (this.data.action === 'break') {
      if (await this.collection.breakMany(id, this.amount())) this.ref.close();
      return;
    }
    const finishes =
      this.data.action === 'craft' ? await this.collection.craft(id, this.amount()) : await this.collection.craftUntil(id, this.target(), this.amount());
    if (finishes.length) this.result.set(`Fabricaste: ${craftedSummary(finishes)}.`);
  }
}
