import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { ShopOdds } from './shop-odds.model';

/** The shop's odds: read by everyone, saved by whoever manages editions. */
@Injectable({ providedIn: 'root' })
export class ShopOddsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  get(): Observable<ShopOdds> {
    return this.http.get<ShopOdds>(this.api.url('/api/drive/shop/odds'));
  }

  save(odds: ShopOdds): Observable<ShopOdds> {
    return this.http.put<ShopOdds>(this.api.url('/api/drive/shop/odds'), odds);
  }
}
