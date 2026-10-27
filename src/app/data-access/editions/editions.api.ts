import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { Edition, EditionSaveRequest } from './edition.model';

/** The only place that knows the editions endpoints. */
@Injectable({ providedIn: 'root' })
export class EditionsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(): Observable<Edition[]> {
    return this.http.get<Edition[]>(this.api.url('/api/drive/editions'));
  }

  save(request: EditionSaveRequest): Observable<Edition> {
    return this.http.post<Edition>(this.api.url('/api/drive/editions'), request);
  }
}
