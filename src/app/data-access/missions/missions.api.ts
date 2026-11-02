import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { MissionBoard, MissionPeriod } from './mission.model';

/** The signed-in player's daily and weekly missions (DriveManager /api/drive/missions). */
@Injectable({ providedIn: 'root' })
export class MissionsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  /** Reading them counts the day's login. */
  mine(): Observable<MissionBoard> {
    return this.http.get<MissionBoard>(this.api.url('/api/drive/missions/me'));
  }

  claim(period: MissionPeriod, missionId: string): Observable<MissionBoard> {
    return this.http.post<MissionBoard>(this.api.url('/api/drive/missions/me/claim'), { period, missionId });
  }
}
