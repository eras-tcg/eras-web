import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { ActivityPage, ActivityQuery } from './activity.model';

/** The players' activity log (manage_users). */
@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  search(query: ActivityQuery): Observable<ActivityPage> {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.actions.length) params = params.set('actions', query.actions.join(','));
    if (query.user.trim()) params = params.set('user', query.user.trim());
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    return this.http.get<ActivityPage>(this.api.url('/api/drive/activity'), { params });
  }
}
