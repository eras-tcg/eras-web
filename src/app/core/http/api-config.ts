import { Injectable } from '@angular/core';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class ApiConfig {
  url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }
}
