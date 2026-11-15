import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { CardMeta } from './card.model';

/** A card being made in the card editor, seen only by whoever manages cards until it is published. */
export interface CardDraft {
  id: string;
  /** The published card it changes; null for a new card. */
  metaId: string | null;
  meta: Omit<CardMeta, 'id'>;
  /** Frame, extras and art framing, as the editor keeps them. */
  design: Record<string, unknown> | null;
  artKey: string | null;
  artType: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** The card editor's drafts and their art (manage_cards). */
@Injectable({ providedIn: 'root' })
export class CardDraftsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(): Observable<CardDraft[]> {
    return this.http.get<CardDraft[]>(this.api.url('/api/card-drafts'));
  }

  create(
    metaId: string | null,
    meta: Omit<CardMeta, 'id'>,
    design: Record<string, unknown>,
  ): Observable<CardDraft> {
    return this.http.post<CardDraft>(this.api.url('/api/card-drafts'), { metaId, meta, design });
  }

  update(
    id: string,
    meta: Omit<CardMeta, 'id'>,
    design: Record<string, unknown>,
  ): Observable<CardDraft> {
    return this.http.put<CardDraft>(this.api.url(`/api/card-drafts/${encodeURIComponent(id)}`), {
      meta,
      design,
    });
  }

  setArt(id: string, file: Blob): Observable<CardDraft> {
    return this.http.put<CardDraft>(
      this.api.url(`/api/card-drafts/${encodeURIComponent(id)}/art`),
      file,
      { headers: { 'Content-Type': file.type || 'application/octet-stream' } },
    );
  }

  removeArt(id: string): Observable<CardDraft> {
    return this.http.delete<CardDraft>(
      this.api.url(`/api/card-drafts/${encodeURIComponent(id)}/art`),
    );
  }

  art(id: string): Observable<Blob> {
    return this.http.get(this.api.url(`/api/card-drafts/${encodeURIComponent(id)}/art`), {
      responseType: 'blob',
    });
  }
}
