import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { Deck, DeckSaveRequest, ProxyPrintRequest } from './deck.model';

@Injectable({ providedIn: 'root' })
export class DecksApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  listPublic(): Observable<Deck[]> {
    return this.http.get<Deck[]>(this.api.url('/api/drive/decklists'), { params: { publicDecks: true } });
  }

  listByUser(userId: string): Observable<Deck[]> {
    return this.http.get<Deck[]>(this.api.url('/api/drive/decklists'), { params: { userId } });
  }

  get(id: string): Observable<Deck> {
    return this.http.get<Deck>(this.api.url(`/api/drive/decklists/${encodeURIComponent(id)}`));
  }

  create(request: DeckSaveRequest): Observable<Deck> {
    return this.http.post<Deck>(this.api.url('/api/drive/decklists'), request);
  }

  update(id: string, request: DeckSaveRequest): Observable<Deck> {
    return this.http.put<Deck>(this.api.url(`/api/drive/decklists/${encodeURIComponent(id)}`), request);
  }

  delete(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/decklists/${encodeURIComponent(id)}`));
  }

  proxyPdf(request: ProxyPrintRequest): Observable<Blob> {
    return this.http.post(this.api.url('/api/drive/proxy-print'), request, { responseType: 'blob' });
  }
}
