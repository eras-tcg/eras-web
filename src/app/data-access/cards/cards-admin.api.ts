import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { CardMeta } from './card.model';

/** Card metadata and image administration (manage_cards). */
@Injectable({ providedIn: 'root' })
export class CardsAdminApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  createMeta(meta: Omit<CardMeta, 'id'>): Observable<CardMeta> {
    return this.http.post<CardMeta>(this.api.url('/api/cards'), meta);
  }

  updateMeta(id: string, meta: Omit<CardMeta, 'id'>): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(id)}`), meta);
  }

  deleteMeta(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/cards/${encodeURIComponent(id)}`), { responseType: 'text' });
  }

  /** Renames the image record (the card name shown everywhere). */
  renameImage(id: string, name: string): Observable<unknown> {
    return this.http.patch(this.api.url(`/api/drive/cards/db/${encodeURIComponent(id)}/name`), { name });
  }

  /** Sets (or replaces) a card's alternative art from an image file: answers the metadata after it. */
  setAltImage(metaId: string, file: File): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/alt-image`), file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  }

  /** The card has no alternative art any more. */
  removeAltImage(metaId: string): Observable<CardMeta> {
    return this.http.delete<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/alt-image`));
  }

  deleteImage(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/cards/db/${encodeURIComponent(id)}`), { responseType: 'text' });
  }
}
