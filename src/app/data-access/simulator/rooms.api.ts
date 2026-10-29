import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { RoomInfo } from './simulator.model';

@Injectable({ providedIn: 'root' })
export class RoomsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  /** A room; {@code editor}: a test room, played alone on both sides (edit mode only). */
  create(editor = false): Observable<{ roomId: string }> {
    return this.http.post<{ roomId: string }>(this.api.url('/api/simulator/rooms'), null, editor ? { params: { editor: 'true' } } : {});
  }

  /** The owner, waiting alone, plays both sides: the room becomes a test room (edit mode only). */
  playAlone(roomId: string): Observable<{ roomId: string }> {
    return this.http.post<{ roomId: string }>(this.api.url(`/api/simulator/rooms/${encodeURIComponent(roomId)}/solo`), null);
  }

  /** Open rooms (public), newest first. */
  list(): Observable<RoomInfo[]> {
    return this.http.get<RoomInfo[]>(this.api.url('/api/simulator/rooms'));
  }

  get(roomId: string): Observable<RoomInfo> {
    return this.http.get<RoomInfo>(this.api.url(`/api/simulator/rooms/${encodeURIComponent(roomId)}`));
  }
}
