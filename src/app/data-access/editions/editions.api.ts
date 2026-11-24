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

  /** Hides the edition (in development: only admins and testers see it) or shows it to everyone. */
  setHidden(editionId: string, hidden: boolean): Observable<Edition> {
    return this.http.put<Edition>(this.api.url(`/api/drive/editions/${encodeURIComponent(editionId)}/hidden`), { hidden });
  }

  /** The edition's cover: the image file is the body. */
  setImage(editionId: string, file: Blob): Observable<Edition> {
    return this.http.put<Edition>(this.api.url(`/api/drive/editions/${encodeURIComponent(editionId)}/image`), file, {
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  }
}
