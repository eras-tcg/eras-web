import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';

/** A card image change detected in Drive, waiting for approval (GET /api/drive/staged, manage_cards). */
export interface StagedChange {
  id: string;
  action: 'upsert' | 'delete' | string;
  name?: string | null;
  fileName?: string | null;
  number?: number | null;
  colorIdentity?: string | null;
  edition?: string | null;
  subEdition?: string | null;
  stagedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class StagedChangesApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(): Observable<StagedChange[]> {
    return this.http.get<StagedChange[]>(this.api.url('/api/drive/staged'));
  }

  applyAll(): Observable<{ applied: number }> {
    return this.http.post<{ applied: number }>(this.api.url('/api/drive/staged/apply'), null);
  }

  apply(id: string): Observable<unknown> {
    return this.http.post(this.api.url(`/api/drive/staged/apply/${encodeURIComponent(id)}`), null);
  }

  reject(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/staged/${encodeURIComponent(id)}`), { responseType: 'text' });
  }
}
