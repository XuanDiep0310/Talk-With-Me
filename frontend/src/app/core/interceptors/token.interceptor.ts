import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpEvent,
} from '@angular/common/http';
import { Observable, throwError, Subject } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

// Shared state across all interceptor calls
let isRefreshing = false;
const refreshSubject$ = new Subject<string>();

function addBearerToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<HttpEvent<unknown>> {
  if (isRefreshing) {
    // Wait for the current refresh to finish, then retry
    return refreshSubject$.pipe(
      take(1),
      switchMap((newToken) => next(addBearerToken(req, newToken)))
    );
  }

  isRefreshing = true;

  return authService.refreshTokens().pipe(
    switchMap((newToken: string) => {
      isRefreshing = false;
      refreshSubject$.next(newToken);
      return next(addBearerToken(req, newToken));
    }),
    catchError((err: unknown) => {
      isRefreshing = false;
      // refreshTokens() already handles logout + redirect
      return throwError(() => err);
    })
  );
}

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip auth header for auth endpoints themselves
  const isAuthEndpoint = req.url.includes('/auth/');
  const token = authService.accessToken;

  const authReq = (!isAuthEndpoint && token)
    ? addBearerToken(req, token)
    : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !isAuthEndpoint) {
        return handle401(req, next, authService);
      }
      return throwError(() => err);
    })
  );
};
