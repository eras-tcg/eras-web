import { HttpErrorResponse } from '@angular/common/http';

/** Turns any backend or network error into a readable message (same rules as the Vue app). */
export function apiErrorMessage(error: unknown, fallback = 'Ocurrió un error'): string {
  if (error instanceof HttpErrorResponse) {
    const data: unknown = error.error;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record['error'] === 'string') return record['error'];
      if (typeof record['message'] === 'string') return record['message'];
      const firstText = Object.values(record).find((v): v is string => typeof v === 'string');
      if (firstText) return firstText;
    }
    if (error.status === 0) return 'No hay conexión con el servidor';
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
