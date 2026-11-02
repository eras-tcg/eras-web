import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { CRAFT_COST, FINISHES, FINISH_LABELS, FRAGMENTS_OF } from '@data/collection/collection-rules';
import { Finish } from '@data/collection/collection.model';
import { CollectionStore } from '@data/collection/collection.store';
import { RARITY_NAMES } from '@data/editions/booster-rules';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';

const TARGETS: ToggleOption[] = [
  { value: 'foil', label: FINISH_LABELS.foil },
  { value: 'prism', label: FINISH_LABELS.prism },
];

/**
 * A card in the player's collection, under its image in the deck builder: the copies of each finish (each can be
 * broken, for fragments of the card's rarity), the fragments of that rarity, and crafting: a number of copies, or
 * again and again until one comes out in a finish (or the fragments run out). Each crafted copy's finish comes at
 * random, by the packs' odds.
 */
@Component({
  selector: 'eras-collection-panel',
  imports: [ButtonComponent, AlertComponent, ToggleGroupComponent],
  template: `
    <section class="panel" aria-label="Tu colección">
      <header>
        <strong>Tu colección</strong>
        <span class="fragments" [title]="'Fragmentos de rareza ' + rarityName()">{{ fragments() }} fragmentos {{ rarity() }}</span>
      </header>

      <ul class="copies">
        @for (finish of finishes; track finish) {
          <li [class]="'finish-' + finish">
            <span class="name">{{ labels[finish] }}</span>
            <span class="count">×{{ copies()[finish] ?? 0 }}</span>
            <button
              erasButton
              variant="ghost"
              size="sm"
              type="button"
              [title]="'Romper una copia: +' + fragmentsOf[finish] + ' fragmentos ' + rarity()"
              [disabled]="!(copies()[finish] ?? 0) || store.busy()"
              (click)="breakOne(finish)"
            >
              Romper +{{ fragmentsOf[finish] }}
            </button>
          </li>
        }
      </ul>

      <div class="craft">
        <label class="amount">
          <span>Cantidad</span>
          <input type="number" min="1" [max]="maxCraft() || 1" [value]="amount()" (input)="setAmount($event)" />
        </label>
        <button erasButton size="sm" type="button" [disabled]="amount() * cost > fragments() || store.busy()" (click)="craft()">
          Fabricar · {{ amount() * cost }}
        </button>
      </div>

      <div class="craft">
        <eras-toggle-group label="Fabricar hasta obtenerla" [options]="targets" [selected]="[target()]" (toggled)="target.set($any($event))" />
        <button erasButton variant="secondary" size="sm" type="button" [disabled]="fragments() < cost || store.busy()" (click)="craftUntil()">
          Fabricar hasta {{ labels[target()] }}
        </button>
      </div>

      @if (result(); as text) {
        <p class="result" role="status">{{ text }}</p>
      }
      @if (store.error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
    </section>
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      font-size: var(--font-size-sm);
    }
    header { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); }
    .fragments { color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .copies { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
    .copies li { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: var(--space-2); }
    .count { font-variant-numeric: tabular-nums; }
    .finish-foil .name { color: var(--color-card-b); }
    .finish-prism .name { color: var(--color-rarity-sec); }
    .craft { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--space-2); }
    .amount { display: flex; flex-direction: column; gap: var(--space-1); color: var(--color-text-muted); }
    .amount input { inline-size: 5rem; }
    .result { margin: 0; color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPanelComponent {
  readonly card = input.required<CatalogCard>();

  protected readonly store = inject(CollectionStore);
  private readonly modal = inject(ModalService);

  protected readonly finishes = FINISHES;
  protected readonly labels = FINISH_LABELS;
  protected readonly fragmentsOf = FRAGMENTS_OF;
  protected readonly cost = CRAFT_COST;
  protected readonly targets = TARGETS;

  protected readonly rarity = computed(() => this.card().meta?.rarity || 'C');
  protected readonly rarityName = computed(() => RARITY_NAMES[this.rarity()] ?? this.rarity());
  protected readonly copies = computed(() => this.store.collection()?.cards[this.card().id] ?? {});
  protected readonly fragments = computed(() => this.store.fragments()[this.rarity()] ?? 0);
  protected readonly maxCraft = computed(() => Math.floor(this.fragments() / CRAFT_COST));
  protected readonly amount = signal(1);
  protected readonly target = signal<Finish>('foil');
  /** What the last craft gave ("Fabricaste: Normal, Foil"). */
  protected readonly result = signal<string | null>(null);

  protected setAmount(event: Event): void {
    const value = Math.floor(Number((event.target as HTMLInputElement).value));
    this.amount.set(Math.max(1, Number.isFinite(value) ? value : 1));
  }

  /** Breaks one copy (a prismatic one only after asking). */
  protected async breakOne(finish: Finish): Promise<void> {
    if (finish === 'prism') {
      const ok = await this.modal.confirm({
        title: 'Romper una copia prismática',
        message: `¿Romper una copia prismática de "${this.card().name}" por ${FRAGMENTS_OF.prism} fragmentos ${this.rarity()}?`,
        confirmLabel: 'Romper',
        danger: true,
      });
      if (!ok) return;
    }
    this.result.set(null);
    await this.store.breakCopies(this.card().id, finish, 1);
  }

  protected async craft(): Promise<void> {
    this.show(await this.store.craft(this.card().id, this.amount()));
  }

  protected async craftUntil(): Promise<void> {
    this.show(await this.store.craftUntil(this.card().id, this.target()));
  }

  private show(finishes: Finish[]): void {
    this.result.set(finishes.length ? `Fabricaste: ${finishes.map((f) => FINISH_LABELS[f]).join(', ')}` : null);
  }
}
