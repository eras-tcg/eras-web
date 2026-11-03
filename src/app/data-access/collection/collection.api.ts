import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { Collection, Crafted, Finish } from './collection.model';

/** The signed-in player's collection (DriveManager /api/drive/collection). */
@Injectable({ providedIn: 'root' })
export class CollectionApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  mine(): Observable<Collection> {
    return this.http.get<Collection>(this.api.url('/api/drive/collection/me'));
  }

  breakCopies(cardId: string, finish: Finish, count: number): Observable<Collection> {
    return this.http.post<Collection>(this.api.url('/api/drive/collection/me/break'), { cardId, finish, count });
  }

  craft(cardId: string, count: number): Observable<Crafted> {
    return this.http.post<Crafted>(this.api.url('/api/drive/collection/me/craft'), { cardId, count });
  }

  /** Several cards at once (card id → copies): all of them or none. */
  craftMany(cards: Record<string, number>): Observable<Crafted> {
    return this.http.post<Crafted>(this.api.url('/api/drive/collection/me/craft-many'), { cards });
  }

  /** Until a copy comes out at least as fine as `finish`, spending at most `maxFragments`. */
  craftUntil(cardId: string, finish: Finish, maxFragments: number): Observable<Crafted> {
    return this.http.post<Crafted>(this.api.url('/api/drive/collection/me/craft-until'), { cardId, finish, maxFragments });
  }

  /** Administrators (manage_users): sets an account's fragments of some rarities. */
  setFragments(userId: string, fragments: Record<string, number>): Observable<Collection> {
    return this.http.post<Collection>(this.api.url(`/api/drive/collection/${encodeURIComponent(userId)}/fragments`), { fragments });
  }

  breakExtras(): Observable<Collection> {
    return this.http.post<Collection>(this.api.url('/api/drive/collection/me/break-extras'), {});
  }
}
