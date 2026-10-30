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

/** How applying all the changes goes (it runs on the server: POST /api/drive/staged/apply). */
export interface ApplyProgress {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  current: string | null;
  errors: string[];
  startedAt: string | null;
  finishedAt: string | null;
  /** The batch being applied, from 1 (several changes at the same time) */
  batch?: number;
  batches?: number;
}

@Injectable({ providedIn: 'root' })
export class StagedChangesApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(): Observable<StagedChange[]> {
    return this.http.get<StagedChange[]>(this.api.url('/api/drive/staged'));
  }

  /** Starts applying them in the background, in batches: all of them, or only the given ids. */
  applyAll(ids?: readonly string[]): Observable<ApplyProgress> {
    return this.http.post<ApplyProgress>(this.api.url('/api/drive/staged/apply'), ids?.length ? { ids } : null);
  }

  applyStatus(): Observable<ApplyProgress> {
    return this.http.get<ApplyProgress>(this.api.url('/api/drive/staged/apply/status'));
  }

  apply(id: string): Observable<unknown> {
    return this.http.post(this.api.url(`/api/drive/staged/apply/${encodeURIComponent(id)}`), null);
  }

  reject(id: string): Observable<unknown> {
    return this.http.delete(this.api.url(`/api/drive/staged/${encodeURIComponent(id)}`), { responseType: 'text' });
  }
}
