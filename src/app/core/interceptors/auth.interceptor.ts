import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

const AUTH_FREE = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/password-reset', '/auth/oauth/'];

function isOwnApi(url: string): boolean {
  try {
    return environment.allowedApiOrigins.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

/**
 * - Refuses plain-HTTP API calls in production builds.
 * - Attaches the bearer token only to our own API origin (never leaks it to third parties).
 * - On 401 refreshes once (single-flight) and replays; a second 401 signs the user out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (environment.production && req.url.startsWith('http://')) {
    return throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Insecure request blocked', url: req.url }));
  }
  if (!isOwnApi(req.url)) return next(req);

  const needsAuth = !AUTH_FREE.some((p) => req.url.includes(p));
  const withHeaders = (token: string | null): HttpRequest<unknown> =>
    req.clone({
      setHeaders: {
        ...(needsAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Requested-With': 'Gatemate',
      },
      withCredentials: false,
    });

  return from(needsAuth ? auth.getAccessToken() : Promise.resolve(null)).pipe(
    switchMap((token) => next(withHeaders(token))),
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !needsAuth) return throwError(() => err);
      return from(auth.refresh()).pipe(
        switchMap((session) => {
          if (!session) {
            void auth.forceSignOut();
            return throwError(() => err);
          }
          return next(withHeaders(session.accessToken));
        }),
      );
    }),
  );
};
