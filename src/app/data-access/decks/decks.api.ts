import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { Deck } from './deck.model';

@Injectable({ providedIn: 'root' })
export class DecksApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  listPublic(): Observable<Deck[]> {
    return this.http.get<Deck[]>(this.api.url('/api/drive/decklists'), { params: { publicDecks: true } });
  }
}
