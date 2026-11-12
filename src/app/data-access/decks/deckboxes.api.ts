import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { DeckBox, DeckBoxSaveRequest } from './deckbox.model';

/** The signed-in player's deckboxes (every call is scoped to them on the server). */
@Injectable({ providedIn: 'root' })
export class DeckBoxesApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(): Observable<DeckBox[]> {
    return this.http.get<DeckBox[]>(this.api.url('/api/drive/deckboxes'));
  }

  create(request: DeckBoxSaveRequest): Observable<DeckBox> {
    return this.http.post<DeckBox>(this.api.url('/api/drive/deckboxes'), request);
  }

  update(id: string, request: DeckBoxSaveRequest): Observable<DeckBox> {
    return this.http.put<DeckBox>(this.api.url(`/api/drive/deckboxes/${encodeURIComponent(id)}`), request);
  }

  delete(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/deckboxes/${encodeURIComponent(id)}`));
  }

  /** Every deckbox id, in the new order; answers the deckboxes in that order. */
  reorder(ids: string[]): Observable<DeckBox[]> {
    return this.http.put<DeckBox[]>(this.api.url('/api/drive/deckboxes/order'), ids);
  }

  /** Puts one of the player's decks in a deckbox (null: takes it out); answers every deckbox. */
  moveDeck(deckId: string, boxId: string | null): Observable<DeckBox[]> {
    return this.http.put<DeckBox[]>(this.api.url(`/api/drive/deckboxes/deck/${encodeURIComponent(deckId)}`), { boxId });
  }
}
