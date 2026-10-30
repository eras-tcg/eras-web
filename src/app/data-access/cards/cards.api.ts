import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { CardMeta, CardRefData, DriveCard } from './card.model';

@Injectable({ providedIn: 'root' })
export class CardsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  listImages(): Observable<DriveCard[]> {
    return this.http.get<DriveCard[]>(this.api.url('/api/drive/cards/db'));
  }

  listMeta(): Observable<CardMeta[]> {
    return this.http.get<CardMeta[]>(this.api.url('/api/cards/search'));
  }

  /** Cards the simulator does not run in full: metadata id → what is missing. */
  listUnprogrammed(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(this.api.url('/api/simulator/unprogrammed'));
  }

  getRef(): Observable<CardRefData> {
    return this.http.get<CardRefData>(this.api.url('/api/cards/ref'));
  }
}
