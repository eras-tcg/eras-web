import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';

/** One change found in Drive, staged for review. */
export interface SyncReportItem {
  fileId: string;
  fileName: string | null;
  action: 'upsert' | 'delete' | string;
}

/** The last check of Drive for changes (GET /api/drive/sync/report, manage_cards). */
export interface SyncReport {
  id: string;
  status: 'running' | 'done' | 'error';
  /** "changes": Drive's change list since the last check; "full": Drive compared with the registered cards. */
  mode: 'changes' | 'full' | null;
  checkedAt: string;
  previousCheckAt: string | null;
  items: SyncReportItem[];
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class SyncReportApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  /** Null when there was no check yet (204). */
  report(): Observable<SyncReport | null> {
    return this.http.get<SyncReport | null>(this.api.url('/api/drive/sync/report'));
  }
}
