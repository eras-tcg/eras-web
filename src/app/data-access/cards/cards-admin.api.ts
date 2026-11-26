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

  /** A card's rarity (only that field changes). */
  setRarity(id: string, rarity: string): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(id)}`), { rarity });
  }

  /** A structure card's copies in its deck (only that field changes). */
  setDeckCopies(id: string, copies: number): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(id)}`), { deckCopies: copies });
  }

  /** Moves cards to other slots all at once (each card's images move with it); answers the cards as they are now. */
  moveSlots(
    moves: readonly { id: string; edition: string; subEdition: string | null; cardNumber: number }[],
  ): Observable<CardMeta[]> {
    return this.http.put<CardMeta[]>(this.api.url('/api/cards/slots'), moves);
  }

  /** A reprint of the card in an empty slot (a card of its own, with its own copy of the art). */
  reprint(id: string, slot: { edition: string; subEdition: string | null; cardNumber: number }): Observable<CardMeta> {
    return this.http.post<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(id)}/reprint`), slot);
  }

  deleteMeta(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/cards/${encodeURIComponent(id)}`), { responseType: 'text' });
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

  /** One art's name (null: "Alternativo N") and its own odds per pulled copy (null: the shop's), at once. */
  updateAltArt(metaId: string, artId: string, change: { name: string | null; odds: number | null }): Observable<CardMeta> {
    return this.http.patch<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/alt-arts/${encodeURIComponent(artId)}`), change);
  }

  /** The card loses that alternative art (copies already pulled with it show the usual one). */
  removeAltArt(metaId: string, artId: string): Observable<CardMeta> {
    return this.http.delete<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/alt-arts/${encodeURIComponent(artId)}`));
  }

  /** The card's illustration (the art alone, kept as it came): answers the card. */
  setArt(metaId: string, file: Blob): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/art`), file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  }

  removeArt(metaId: string): Observable<CardMeta> {
    return this.http.delete<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/art`));
  }

  /** The finished card drawn by the editor (a cache of the document and its art): answers the card. */
  setRender(metaId: string, image: Blob): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/render`), image, {
      headers: { 'Content-Type': image.type || 'image/jpeg' },
    });
  }

  /** Where the card shines (a PNG drawn with its render: gloss on top, gold below): answers the card. */
  setShine(metaId: string, image: Blob): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/shine`), image, {
      headers: { 'Content-Type': 'image/png' },
    });
  }

  /** Its creature cut out of the illustration (a PNG with transparency, for its summon): answers the card. */
  setCreature(metaId: string, image: Blob): Observable<CardMeta> {
    return this.http.put<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/creature`), image, {
      headers: { 'Content-Type': 'image/png' },
    });
  }

  removeCreature(metaId: string): Observable<CardMeta> {
    return this.http.delete<CardMeta>(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/creature`));
  }

  render(metaId: string): Observable<Blob> {
    return this.http.get(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/render`), { responseType: 'blob' });
  }

  art(metaId: string): Observable<Blob> {
    return this.http.get(this.api.url(`/api/cards/${encodeURIComponent(metaId)}/art`), { responseType: 'blob' });
  }

  deleteImage(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/cards/db/${encodeURIComponent(id)}`), { responseType: 'text' });
  }
}
