import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { plain } from '@data/decks/deck-search';
import { HomeNews, MAX_NEWS_CARDS } from '@data/home/home.model';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { firstValueFrom } from 'rxjs';

export interface NewsEditData {
  /** The news item to edit; none for a new one. */
  news: HomeNews | null;
  /** The catalog, to pick the cards shown beside it. */
  cards: readonly CatalogCard[];
}

const TITLE_MAX = 80;
const EXCERPT_MAX = 400;
const RESULTS = 30;

/** "2026-11-23T20:00" for a datetime-local field (the news' ISO date cut to minutes). */
function toLocalInput(iso: string): string {
  return iso.slice(0, 16);
}

/** Now, as a datetime-local value. */
function nowInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Writes a news item of the home's carousel: its title, date and text, an optional button to a page of the site, and up
 * to three cards shown whole beside it (searched by name in the catalog). Closes with the item, or nothing on cancel.
 */
@Component({
  selector: 'eras-news-edit-dialog',
  imports: [ModalComponent, FormFieldComponent, CardThumbComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal [title]="data.news ? 'Editar noticia' : 'Nueva noticia'" size="lg" (closed)="ref.close()">
      <div class="form">
        <eras-form-field label="Título" required>
          <input type="text" [maxLength]="titleMax" [value]="title()" (input)="title.set($any($event.target).value)" />
        </eras-form-field>
        <eras-form-field label="Fecha" required>
          <input type="datetime-local" [value]="date()" (input)="date.set($any($event.target).value)" />
        </eras-form-field>
        <eras-form-field label="Texto">
          <textarea rows="3" [maxLength]="excerptMax" [value]="excerpt()" (input)="excerpt.set($any($event.target).value)"></textarea>
        </eras-form-field>
        <div class="pair">
          <eras-form-field label="Botón (texto)">
            <input type="text" placeholder="Ver cartas" [value]="linkLabel()" (input)="linkLabel.set($any($event.target).value)" />
          </eras-form-field>
          <eras-form-field label="Botón (página)" [error]="routeError()">
            <input type="text" placeholder="/cards?edition=E1.3" [value]="linkRoute()" (input)="linkRoute.set($any($event.target).value)" />
          </eras-form-field>
        </div>

        <section class="cards" aria-label="Cartas de la noticia">
          <span class="label">Cartas ({{ chosen().length }}/{{ maxCards }})</span>
          <div class="chosen">
            @for (card of chosen(); track card.id) {
              <div class="pick">
                <eras-card-thumb [name]="card.name ?? ''" [imageUrl]="image(card)" />
                <button erasButton variant="secondary" size="sm" type="button" [attr.aria-label]="'Quitar ' + card.name" (click)="remove(card)"><eras-icon name="x" /></button>
              </div>
            }
          </div>
          @if (chosen().length < maxCards) {
            <input #search type="search" class="search" placeholder="Buscar carta por nombre…" aria-label="Buscar carta" (input)="query.set(search.value)" />
            @if (results().length) {
              <div class="results">
                @for (card of results(); track card.id) {
                  <eras-card-thumb [name]="card.name ?? ''" [imageUrl]="image(card)" (selected)="add(card); search.value = ''; search.focus()" />
                }
              </div>
            }
          }
        </section>
      </div>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [disabled]="!valid()" (click)="done()">Listo</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--space-3);
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
    }
    .chosen {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .pick {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-1);
      inline-size: 6rem;
    }
    .search {
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
    }
    .results {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
      gap: var(--space-2);
      max-block-size: 18rem;
      overflow: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsEditDialogComponent {
  protected readonly ref = inject<DialogRef<HomeNews>>(DialogRef);
  protected readonly data = inject<NewsEditData>(DIALOG_DATA);
  protected readonly titleMax = TITLE_MAX;
  protected readonly excerptMax = EXCERPT_MAX;
  protected readonly maxCards = MAX_NEWS_CARDS;

  private readonly byId = new Map(this.data.cards.map((c) => [c.id, c]));
  protected readonly title = signal(this.data.news?.title ?? '');
  protected readonly date = signal(this.data.news ? toLocalInput(this.data.news.date) : nowInput());
  protected readonly excerpt = signal(this.data.news?.excerpt ?? '');
  protected readonly linkLabel = signal(this.data.news?.linkLabel ?? '');
  protected readonly linkRoute = signal(this.data.news?.linkRoute ?? '');
  protected readonly chosen = signal<CatalogCard[]>(
    (this.data.news?.cardIds ?? []).map((id) => this.byId.get(id)).filter((c): c is CatalogCard => !!c),
  );
  protected readonly query = signal('');

  /** Cards whose name has every word typed (accents and case aside), not already chosen, with an image. */
  protected readonly results = computed(() => {
    const words = plain(this.query()).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const chosen = new Set(this.chosen().map((c) => c.id));
    return this.data.cards
      .filter((c) => !chosen.has(c.id) && !!cardImageUrl(c))
      .filter((c) => {
        const name = plain(c.meta?.cardName ?? c.name ?? '');
        return words.every((w) => name.includes(w));
      })
      .slice(0, RESULTS);
  });
  protected readonly routeError = computed(() => {
    const route = this.linkRoute().trim();
    return route && !route.startsWith('/') ? 'Una página del sitio: empieza con /' : null;
  });
  protected readonly valid = computed(() => !!this.title().trim() && !!this.date() && !this.routeError());
  protected readonly image = cardImageUrl;

  protected add(card: CatalogCard): void {
    if (this.chosen().length >= MAX_NEWS_CARDS) return;
    this.chosen.update((list) => [...list, card]);
    this.query.set('');
  }

  protected remove(card: CatalogCard): void {
    this.chosen.update((list) => list.filter((c) => c.id !== card.id));
  }

  protected done(): void {
    if (!this.valid()) return;
    const route = this.linkRoute().trim();
    this.ref.close({
      ...(this.data.news?.id ? { id: this.data.news.id } : {}),
      title: this.title().trim(),
      date: this.date(),
      excerpt: this.excerpt().trim(),
      cardIds: this.chosen().map((c) => c.id),
      linkRoute: route || null,
      linkLabel: route ? this.linkLabel().trim() || null : null,
    });
  }
}

/** Opens the news form; resolves the item written, or undefined on cancel. */
export async function editNews(modal: ModalService, data: NewsEditData): Promise<HomeNews | undefined> {
  return firstValueFrom(modal.open<HomeNews, NewsEditData>(NewsEditDialogComponent, { data }).closed);
}
