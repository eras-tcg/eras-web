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

  /** Adds an alternative art from an image file, with its own odds (null: the shop's): answers the metadata after it. */
  addAltArt(metaId: string, file: File, odds: number | null): Observable<CardMeta> {
    const query = odds === null ? '' : `?odds=${odds}`;
    return this.http.post<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/alt-arts${query}`), file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  }

  /** A new image for one of the card's alternative arts (its id and odds stay). */
  replaceAltArt(metaId: string, artId: string, file: File): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/alt-arts/${encodeURIComponent(artId)}`), file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  }

  /** One art's own odds per pulled copy; null: it takes the shop's. */
  setAltArtOdds(metaId: string, artId: string, odds: number | null): Observable<CardMeta> {
    return this.http.patch<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/alt-arts/${encodeURIComponent(artId)}`), { odds });
  }

  /** The card loses that alternative art (copies already pulled with it show the usual one). */
  removeAltArt(metaId: string, artId: string): Observable<CardMeta> {
    return this.http.delete<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/alt-arts/${encodeURIComponent(artId)}`));
  }

  deleteImage(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/cards/db/${encodeURIComponent(id)}`), { responseType: 'text' });
  }
}
