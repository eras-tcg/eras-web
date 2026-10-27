import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { DEFAULT_TIERS, addDecks, moveDeck, normalizeTierList } from '@data/games/games-rules';
import { GamesApi } from '@data/games/games.api';
import { TierList, TierPage } from '@data/games/games.model';
import { DeckChipComponent } from '@ui/domain/deck-chip/deck-chip.component';
import { TierRowComponent } from '@ui/domain/tier-row/tier-row.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { MultiselectComponent } from '@ui/forms/multiselect/multiselect.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { TabsComponent } from '@ui/surfaces/tabs/tabs.component';

const DRAG_TYPE = 'application/x-eras-deck';

/** Deck tier list with several pages. Everyone signed in can see it; manage_decks edits it. */
@Component({
  selector: 'eras-tierlist-page',
  imports: [
    PageComponent,
    StackComponent,
    CardComponent,
    TabsComponent,
    TierRowComponent,
    DeckChipComponent,
    FormFieldComponent,
    MultiselectComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './tierlist.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TierlistPage {
  private readonly api = inject(GamesApi);
  private readonly decksStore = inject(DecksStore);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);

  protected readonly canEdit = computed(() => this.auth.user() !== null && this.auth.can('manage_decks'));
  protected readonly list = signal<TierList | null>(null);
  private saved: TierList | null = null;
  protected readonly pageId = signal('');
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly savedNotice = signal(false);
  protected readonly dragOver = signal<string | null>(null);
  protected readonly toAdd = signal<string[]>([]);

  private readonly decksById = computed(() => new Map(this.decksStore.publicDecks().map((d) => [d.id, d])));
  protected readonly tabs = computed(() => (this.list()?.pages ?? []).map((p) => ({ key: p.id, label: p.name })));
  protected readonly page = computed(() => this.list()?.pages.find((p) => p.id === this.pageId()) ?? this.list()?.pages[0] ?? null);
  /** Names of public decks not on the current page, for the "add" picker. */
  protected readonly addable = computed(() => {
    const placed = new Set(this.page()?.tiers.flatMap((t) => t.deckIds) ?? []);
    return this.decksStore.publicDecks().filter((d) => !placed.has(d.id));
  });
  protected readonly addableNames = computed(() => this.addable().map((d) => this.optionLabel(d)));

  constructor() {
    void this.load();
  }

  protected deck(id: string): Deck | null {
    return this.decksById().get(id) ?? null;
  }

  private optionLabel(d: Deck): string {
    return `${d.deckName} (${d.username ?? '—'})`;
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.decksStore.loadPublic();
      const list = normalizeTierList(await firstValueFrom(this.api.getTierList()));
      this.list.set(list);
      this.saved = structuredClone(list);
      if (!list.pages.some((p) => p.id === this.pageId())) this.pageId.set(list.pages[0].id);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo cargar la tierlist'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Editing ───────────────────────────────────────────────────────────

  private updatePage(change: (page: TierPage) => TierPage): void {
    const current = this.page();
    if (!current) return;
    this.list.update((l) => l && { ...l, pages: l.pages.map((p) => (p.id === current.id ? change(p) : p)) });
    this.savedNotice.set(false);
  }

  protected rename(name: string): void {
    this.updatePage((p) => ({ ...p, name }));
  }

  protected addPage(): void {
    const page: TierPage = { id: Date.now().toString(), name: `Página ${(this.list()?.pages.length ?? 0) + 1}`, tiers: DEFAULT_TIERS() };
    this.list.update((l) => l && { ...l, pages: [...l.pages, page] });
    this.pageId.set(page.id);
  }

  protected async deletePage(): Promise<void> {
    const page = this.page();
    const list = this.list();
    if (!page || !list || list.pages.length <= 1) return;
    const ok = await this.modal.confirm({ title: 'Eliminar página', message: `¿Eliminar la página "${page.name}"?`, confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const pages = list.pages.filter((p) => p.id !== page.id);
    this.list.set({ ...list, pages });
    this.pageId.set(pages[0].id);
  }

  protected move(deckId: string, to: string | null): void {
    this.updatePage((p) => moveDeck(p, deckId, to));
  }

  protected addSelected(): void {
    const page = this.page();
    if (!page) return;
    const names = new Set(this.toAdd());
    const ids = this.addable().filter((d) => names.has(this.optionLabel(d))).map((d) => d.id);
    // New decks go to the last tier, then get moved
    this.updatePage((p) => addDecks(p, ids, p.tiers[p.tiers.length - 1].label));
    this.toAdd.set([]);
  }

  protected cancel(): void {
    this.list.set(this.saved ? structuredClone(this.saved) : null);
    this.editing.set(false);
  }

  protected async save(): Promise<void> {
    const list = this.list();
    if (!list) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = normalizeTierList(await firstValueFrom(this.api.saveTierList(list)));
      this.list.set(saved);
      this.saved = structuredClone(saved);
      this.editing.set(false);
      this.savedNotice.set(true);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo guardar la tierlist'));
    } finally {
      this.saving.set(false);
    }
  }

  // ── Drag & drop between tiers (desktop; the "Mover a" menu does the same with keyboard/touch) ──

  protected dragStart(event: DragEvent, deckId: string): void {
    event.dataTransfer?.setData(DRAG_TYPE, deckId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected dragOverTier(event: DragEvent, label: string): void {
    if (!event.dataTransfer?.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    this.dragOver.set(label);
  }

  protected drop(event: DragEvent, label: string): void {
    this.dragOver.set(null);
    const id = event.dataTransfer?.getData(DRAG_TYPE);
    if (!id) return;
    event.preventDefault();
    this.move(id, label);
  }
}
