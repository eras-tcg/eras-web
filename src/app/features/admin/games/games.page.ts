import { DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DecksStore } from '@data/decks/decks.store';
import { EMPTY_STATS_FILTER, StatsFilter, deckStats, emptyGame, formatDuration, timeline } from '@data/games/games-rules';
import { GamesApi } from '@data/games/games.api';
import { Game, GameNote, Life, Side } from '@data/games/games.model';
import { TableComponent } from '@ui/data/table/table.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { SortControlComponent } from '@ui/forms/sort-control/sort-control.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { feedbackState } from '../admin-feedback';
import { GameEditData, GameEditDialogComponent } from './game-edit-dialog.component';
import { GameFormComponent } from './game-form.component';
import { PluralPipe } from '@ui/utilities/plural.pipe';

type StatsSort = 'deckName' | 'played' | 'won' | 'ratio';

/** Game log for testing decks (manage_decks): register games and notes, and per-deck win stats. */
@Component({
  selector: 'eras-games-page',
  imports: [
    DatePipe,
    PluralPipe,
    PercentPipe,
    PageComponent,
    GridComponent,
    StackComponent,
    SectionHeaderComponent,
    CardComponent,
    FormFieldComponent,
    SortControlComponent,
    TableComponent,
    GameFormComponent,
    AlertComponent,
    EmptyStateComponent,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './games.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamesPage {
  private readonly api = inject(GamesApi);
  private readonly decksStore = inject(DecksStore);
  private readonly modal = inject(ModalService);

  protected readonly fb = feedbackState();
  protected readonly games = signal<Game[]>([]);
  protected readonly notes = signal<GameNote[]>([]);
  protected readonly loading = signal(false);
  protected readonly decks = this.decksStore.publicDecks;
  private readonly deckNames = computed(() => new Map(this.decks().map((d) => [d.id, d.deckName])));

  protected readonly draft = signal<Game>(emptyGame());
  protected readonly savingGame = signal(false);
  protected readonly noteText = signal('');
  protected readonly savingNote = signal(false);
  protected readonly editingNote = signal<GameNote | null>(null);
  protected readonly editNoteText = signal('');
  protected readonly busy = signal<string | null>(null);

  protected readonly items = computed(() => timeline(this.games(), this.notes()));

  protected readonly showStats = signal(false);
  protected readonly statsFilter = signal<StatsFilter>(EMPTY_STATS_FILTER);
  protected readonly statsSort = signal<StatsSort>('played');
  protected readonly statsDirection = signal<'asc' | 'desc'>('desc');
  protected readonly statsSortOptions = [
    { value: 'played', label: 'Jugadas' },
    { value: 'won', label: 'Ganadas' },
    { value: 'ratio', label: '% victorias' },
    { value: 'deckName', label: 'Mazo' },
  ];
  protected readonly stats = computed(() => {
    const key = this.statsSort();
    const sign = this.statsDirection() === 'asc' ? 1 : -1;
    return deckStats(this.games(), this.decks(), this.statsFilter()).sort(
      (a, b) => (key === 'deckName' ? a.deck.deckName.localeCompare(b.deck.deckName, 'es') : a[key] - b[key]) * sign,
    );
  });

  protected readonly duration = formatDuration;
  protected readonly sides: Side[] = ['player1', 'player2'];

  constructor() {
    void this.load();
  }

  protected deckName(id: string): string {
    return this.deckNames().get(id) ?? (id || '—');
  }

  protected player(game: Game, side: Side): string {
    return game[side]?.playerName || (side === 'player1' ? 'Jugador 1' : 'Jugador 2');
  }

  protected lives(lives: Life[] | undefined): string {
    return lives?.length ? lives.map((l) => (l === 'up' ? '▲' : '▼')).join('') : '—';
  }

  protected setFilter<K extends keyof StatsFilter>(key: K, value: StatsFilter[K]): void {
    this.statsFilter.update((f) => ({ ...f, [key]: value }));
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      await this.decksStore.loadPublic();
      const [games, notes] = await Promise.all([firstValueFrom(this.api.listGames()), firstValueFrom(this.api.listNotes())]);
      this.games.set(games);
      this.notes.set(notes);
    } catch (e) {
      this.fb.fail(e, 'No se pudo cargar el registro de partidas');
    } finally {
      this.loading.set(false);
    }
  }

  protected async registerGame(): Promise<void> {
    this.savingGame.set(true);
    this.fb.clear();
    try {
      const saved = await firstValueFrom(this.api.createGame(this.draft()));
      this.games.update((list) => [saved, ...list]);
      this.draft.set(emptyGame(saved));
      this.fb.ok('Partida registrada');
    } catch (e) {
      this.fb.fail(e, 'No se pudo registrar la partida');
    } finally {
      this.savingGame.set(false);
    }
  }

  protected async addNote(): Promise<void> {
    const text = this.noteText().trim();
    if (!text) return;
    this.savingNote.set(true);
    this.fb.clear();
    try {
      const note = await firstValueFrom(this.api.createNote(text));
      this.notes.update((list) => [note, ...list]);
      this.noteText.set('');
    } catch (e) {
      this.fb.fail(e, 'No se pudo guardar la nota');
    } finally {
      this.savingNote.set(false);
    }
  }

  protected async editGame(game: Game): Promise<void> {
    const data: GameEditData = { game, decks: this.decks() };
    const saved = await firstValueFrom(this.modal.open<Game>(GameEditDialogComponent, { data }).closed);
    if (saved) this.games.update((list) => list.map((g) => (g.id === saved.id ? saved : g)));
  }

  protected startEditNote(note: GameNote): void {
    this.editingNote.set(note);
    this.editNoteText.set(note.text);
  }

  protected async saveNote(): Promise<void> {
    const note = this.editingNote();
    const text = this.editNoteText().trim();
    if (!note || !text) return;
    this.busy.set(note.id);
    try {
      const saved = await firstValueFrom(this.api.updateNote(note.id, text));
      this.notes.update((list) => list.map((n) => (n.id === saved.id ? saved : n)));
      this.editingNote.set(null);
    } catch (e) {
      this.fb.fail(e, 'No se pudo guardar la nota');
    } finally {
      this.busy.set(null);
    }
  }

  protected async remove(kind: 'game' | 'note', id: string | undefined): Promise<void> {
    if (!id) return;
    const ok = await this.modal.confirm({
      title: kind === 'game' ? 'Eliminar partida' : 'Eliminar nota',
      message: kind === 'game' ? 'La partida deja de contar en las estadísticas.' : '¿Eliminar esta nota?',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.busy.set(id);
    this.fb.clear();
    try {
      if (kind === 'game') {
        await firstValueFrom(this.api.deleteGame(id));
        this.games.update((list) => list.filter((g) => g.id !== id));
      } else {
        await firstValueFrom(this.api.deleteNote(id));
        this.notes.update((list) => list.filter((n) => n.id !== id));
      }
    } catch (e) {
      this.fb.fail(e, 'No se pudo eliminar');
    } finally {
      this.busy.set(null);
    }
  }
}
