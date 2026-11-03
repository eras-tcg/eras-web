import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { IconComponent } from '@ui/primitives/icon/icon.component';

/** The keyword abilities from the cards' reference data (one per name), with a search by name or text. */
@Component({
  selector: 'eras-keyword-list',
  imports: [IconComponent],
  template: `
    <label class="search">
      <eras-icon name="search" />
      <input type="search" placeholder="Buscar una habilidad" aria-label="Buscar una habilidad" [value]="search()" (input)="search.set($any($event.target).value)" />
    </label>
    @if (keywords().length) {
      <dl class="keywords">
        @for (k of keywords(); track k.name) {
          <div class="kw"><dt>{{ k.name }}</dt><dd>{{ k.text }}</dd></div>
        }
      </dl>
    } @else if (cards.loading()) {
      <p>Cargando habilidades…</p>
    } @else if (search()) {
      <p>Ninguna habilidad coincide con «{{ search() }}».</p>
    } @else {
      <p>No se pudo cargar la lista de habilidades.</p>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-3); }
    p { margin: 0; }
    .search {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    .search input { flex: 1; border: 0; background: none; color: inherit; font: inherit; outline: none; }
    .keywords { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr)); gap: var(--space-2); margin: 0; }
    .kw { padding: var(--space-3); border: var(--border-width) solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
    .kw dt { color: var(--color-keyword, var(--color-hub-accent)); font-weight: var(--font-weight-bold); }
    .kw dd { margin: 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeywordListComponent {
  protected readonly cards = inject(CardsStore);
  protected readonly search = signal('');

  protected readonly keywords = computed(() => {
    const q = this.search().trim().toLowerCase();
    return Object.entries(this.cards.ref()?.keywordEffects ?? {})
      .map(([name, k]) => ({ name, text: (k?.displayText ?? k?.description ?? '').replace(/^<[^>]*>\s*/, '') }))
      .filter((k) => k.text && (!q || k.name.toLowerCase().includes(q) || k.text.toLowerCase().includes(q)))
      .map((k) => ({ ...k, text: k.text.charAt(0).toUpperCase() + k.text.slice(1) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  constructor() {
    void this.cards.load();
  }
}
