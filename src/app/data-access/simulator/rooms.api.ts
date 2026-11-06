import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { RoomInfo } from './simulator.model';

@Injectable({ providedIn: 'root' })
export class RoomsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  /**
   * A room; `editor`: a test room (Sala de pruebas), played alone on both sides; `bot`: a game against the server's bot
   * (Modo solo); `ranked`: its result moves the players' rank (never a test room).
   */
  create(editor = false, bot = false, ranked = false): Observable<{ roomId: string }> {
    const params: Record<string, string> = editor ? { editor: 'true' } : bot ? { bot: 'true' } : {};
    if (ranked && !editor) params['ranked'] = 'true';
    return this.http.post<{ roomId: string }>(this.api.url('/api/simulator/rooms'), null, { params });
  }

  /** Open rooms (public), newest first. */
  list(): Observable<RoomInfo[]> {
    return this.http.get<RoomInfo[]>(this.api.url('/api/simulator/rooms'));
  }

  get(roomId: string): Observable<RoomInfo> {
    return this.http.get<RoomInfo>(this.api.url(`/api/simulator/rooms/${encodeURIComponent(roomId)}`));
  }
}
