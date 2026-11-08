import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Injector, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable, of, throwError } from 'rxjs';
import { LOCAL_ROOM_ID } from './engine-protocol';
import { GameStore } from './game.store';
import { RoomInfo } from './simulator.model';

@Injectable({ providedIn: 'root' })
export class RoomsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly injector = inject(Injector);

  /**
   * A room; `editor`: a test room (Sala de pruebas), played alone on both sides; `bot`: a game against the server's bot
   * (Modo solo); `ranked`: its result moves the players' rank (never a test room).
   */
  create(editor = false, bot = false, ranked = false): Observable<{ roomId: string }> {
    const params: Record<string, string> = editor ? { editor: 'true' } : bot ? { bot: 'true' } : {};
    if (ranked && !editor) params['ranked'] = 'true';
    return this.http.post<{ roomId: string }>(this.api.url('/api/simulator/rooms'), null, { params });
  }

  /**
   * Modo solo sin conexión: its room is made by the engine in this browser, always "local" (the server is not asked).
   * It is the player's alone: never listed with the open rooms.
   */
  createLocal(): Observable<{ roomId: string }> {
    return of({ roomId: LOCAL_ROOM_ID });
  }

  /** Open rooms (public), newest first. */
  list(): Observable<RoomInfo[]> {
    return this.http.get<RoomInfo[]>(this.api.url('/api/simulator/rooms'));
  }

  get(roomId: string): Observable<RoomInfo> {
    if (roomId === LOCAL_ROOM_ID) return this.localRoom();
    return this.http.get<RoomInfo>(this.api.url(`/api/simulator/rooms/${encodeURIComponent(roomId)}`));
  }

  /** The offline room as the server would describe it while it is open; else, as the server says of a room that is not there (404). */
  private localRoom(): Observable<RoomInfo> {
    const game = this.injector.get(GameStore);
    const state = game.local() ? game.state() : null;
    if (!state) return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: LOCAL_ROOM_ID }));
    const players = Object.values(state.players ?? {});
    return of({
      roomId: LOCAL_ROOM_ID,
      status: state.status,
      playerIds: players.map((p) => p.userId),
      players: players.map((p) => p.username),
      playerCount: players.length,
      ranked: !!state.ranked,
    });
  }
}
