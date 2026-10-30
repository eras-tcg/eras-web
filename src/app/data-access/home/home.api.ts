import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiConfig } from '@core/http/api-config';
import { Observable } from 'rxjs';
import { HomeContent, HomeSaveRequest } from './home.model';

@Injectable({ providedIn: 'root' })
export class HomeApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  get(): Observable<HomeContent> {
    return this.http.get<HomeContent>(this.api.url('/api/drive/front-content/home'));
  }

  /** The server answers plain text ("Home content updated"), not JSON. */
  save(request: HomeSaveRequest): Observable<string> {
    return this.http.post(this.api.url('/api/drive/front-content/home'), request, { responseType: 'text' });
  }
}
