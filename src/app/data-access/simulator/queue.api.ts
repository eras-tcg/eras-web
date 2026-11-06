import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';

/** How the search for a ranked rival goes. */
export interface QueueStatus {
  /** "waiting" in the queue, "matched" (roomId: the room made for both) or "none" (not in it). */
  state: 'waiting' | 'matched' | 'none';
  waitedMs: number;
  /** The gap of strength accepted now (it grows while waiting). */
  window: number;
  roomId: string | null;
}

/** The ranked queue of Online: entering, asking how it goes (it keeps the player in it) and leaving. */
@Injectable({ providedIn: 'root' })
export class QueueApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  join(username: string): Observable<QueueStatus> {
    return this.http.post<QueueStatus>(this.api.url('/api/simulator/queue'), { username });
  }

  poll(): Observable<QueueStatus> {
    return this.http.get<QueueStatus>(this.api.url('/api/simulator/queue'));
  }

  leave(): Observable<void> {
    return this.http.delete<void>(this.api.url('/api/simulator/queue'));
  }
}
