import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { Game, GameNote, TierList } from './games.model';

@Injectable({ providedIn: 'root' })
export class GamesApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  listGames(): Observable<Game[]> {
    return this.http.get<Game[]>(this.api.url('/api/drive/games'));
  }
  createGame(game: Game): Observable<Game> {
    return this.http.post<Game>(this.api.url('/api/drive/games'), game);
  }
  updateGame(id: string, game: Game): Observable<Game> {
    return this.http.put<Game>(this.api.url(`/api/drive/games/${encodeURIComponent(id)}`), game);
  }
  deleteGame(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/games/${encodeURIComponent(id)}`), { responseType: 'text' });
  }

  listNotes(): Observable<GameNote[]> {
    return this.http.get<GameNote[]>(this.api.url('/api/drive/game-notes'));
  }
  createNote(text: string): Observable<GameNote> {
    return this.http.post<GameNote>(this.api.url('/api/drive/game-notes'), { text });
  }
  updateNote(id: string, text: string): Observable<GameNote> {
    return this.http.put<GameNote>(this.api.url(`/api/drive/game-notes/${encodeURIComponent(id)}`), { text });
  }
  deleteNote(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/game-notes/${encodeURIComponent(id)}`), { responseType: 'text' });
  }

  getTierList(): Observable<TierList & { tiers?: TierList['pages'][number]['tiers'] }> {
    return this.http.get<TierList & { tiers?: TierList['pages'][number]['tiers'] }>(this.api.url('/api/drive/tierlist'));
  }
  saveTierList(list: TierList): Observable<TierList> {
    return this.http.put<TierList>(this.api.url('/api/drive/tierlist'), list);
  }
}
