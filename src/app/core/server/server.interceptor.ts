import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ServerWarmupService } from './server-warmup.service';

/** A backend that sleeps went to sleep while the site was open: an API request that gets no answer wakes it up again. */
export const serverInterceptor: HttpInterceptorFn = (req, next) => {
  const warmup = inject(ServerWarmupService);
  if (!req.url.includes('/api/')) return next(req);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status)) warmup.lost();
      return throwError(() => error);
    }),
  );
};
