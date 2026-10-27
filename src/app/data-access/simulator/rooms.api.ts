import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { RoomInfo } from './simulator.model';

@Injectable({ providedIn: 'root' })
export class RoomsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  create(): Observable<{ roomId: string }> {
    return this.http.post<{ roomId: string }>(this.api.url('/api/simulator/rooms'), null);
  }

  get(roomId: string): Observable<RoomInfo> {
    return this.http.get<RoomInfo>(this.api.url(`/api/simulator/rooms/${encodeURIComponent(roomId)}`));
  }
}
