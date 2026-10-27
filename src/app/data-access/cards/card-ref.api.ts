import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { CardEffect, CardRefData, RefListField } from './card.model';

/** Cards using a reference value (GET /api/cards/ref/{field}/check). */
export interface RefUsage {
  count: number;
  cards: { id: string; cardName?: string | null; edition?: string | null; cardNumber?: number | null }[];
}

/** Reference data endpoints (manage_cards). Every change answers the whole updated reference data. */
@Injectable({ providedIn: 'root' })
export class CardRefApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  get(): Observable<CardRefData> {
    return this.http.get<CardRefData>(this.api.url('/api/cards/ref'));
  }

  addValue(field: RefListField, value: string): Observable<CardRefData> {
    return this.http.post<CardRefData>(this.api.url(`/api/cards/ref/${field}`), { value });
  }

  removeValue(field: RefListField, value: string): Observable<CardRefData> {
    return this.http.delete<CardRefData>(this.api.url(`/api/cards/ref/${field}`), { body: { value } });
  }

  usage(field: RefListField | 'keywordEffects', value: string): Observable<RefUsage> {
    return this.http.get<RefUsage>(this.api.url(`/api/cards/ref/${field}/check`), { params: { value } });
  }

  /** Replaces the value in every card (or removes it when `replacement` is null), then drops it from the list. */
  replaceValue(field: RefListField, value: string, replacement: string | null): Observable<CardRefData> {
    return this.http.post<CardRefData>(this.api.url(`/api/cards/ref/${field}/replace`), { value, replacement });
  }

  setInstanceKind(instance: string, kind: string | null): Observable<CardRefData> {
    return this.http.patch<CardRefData>(this.api.url('/api/cards/ref/instance-kind'), { instance, kind });
  }

  saveKeyword(keyword: string, effect: CardEffect): Observable<CardRefData> {
    return this.http.post<CardRefData>(this.api.url('/api/cards/ref/keywordEffects'), { keyword, effect });
  }

  removeKeyword(keyword: string): Observable<CardRefData> {
    return this.http.delete<CardRefData>(this.api.url('/api/cards/ref/keywordEffects'), { body: { keyword } });
  }
}
