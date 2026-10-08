import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AppStateService } from './app-state.service';

// ── Request / Response interfaces ──────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
  termsAccepted: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SettingsResponse {
  notificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  aiVoice: 'female' | 'male';
  speechSpeed: 'slow' | 'normal' | 'fast';
  theme: 'light' | 'dark' | 'system';
  timezone: string;
}

// ── API error codes ────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
}

export function mapApiError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    // Network error
    if (err.status === 0) return 'Không thể kết nối tới máy chủ.';
    const body = err.error as Partial<ApiError> | undefined;
    switch (body?.code) {
      case 'INVALID_CREDENTIALS':
        return 'Email hoặc mật khẩu không đúng.';
      case 'ACCOUNT_LOCKED':
        return 'Tài khoản tạm khóa do nhập sai quá nhiều lần.';
      case 'EMAIL_ALREADY_EXISTS':
        return 'Email này đã có tài khoản.';
      case 'TERMS_NOT_ACCEPTED':
        return 'Vui lòng chấp nhận điều khoản.';
      case 'PASSWORD_TOO_SHORT':
        return 'Mật khẩu tối thiểu 6 ký tự.';
      default:
        return body?.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    }
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

// ── Storage keys ───────────────────────────────────────────────────────────────

const REFRESH_TOKEN_KEY = 'twm.refresh_token';

// ── AuthService ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly appState = inject(AppStateService);
  private readonly BASE = environment.apiUrl;

  /** Access token stored in memory only — never in localStorage */
  private _accessToken: string | null = null;

  readonly currentUser = signal<MeResponse | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  get accessToken(): string | null {
    return this._accessToken;
  }

  // ── Refresh token queue (prevents multiple simultaneous refresh calls) ────────

  private _isRefreshing = false;
  private _refreshSubject = new Subject<string>();

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Called by APP_INITIALIZER on app start.
   * If a refresh token exists in localStorage, silently exchange it for a new
   * access token and load the current user.
   */
  async initialize(): Promise<void> {
    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) return;
    try {
      const tokens = await this.http
        .post<TokenResponse>(`${this.BASE}/auth/refresh`, { refreshToken })
        .toPromise();
      if (tokens) {
        this.storeTokens(tokens);
        await this.loadCurrentUser();
      }
    } catch {
      // Refresh failed — clear stale token silently
      this.clearTokens();
    }
  }

  // ── Auth actions ───────────────────────────────────────────────────────────

  async login(req: LoginRequest): Promise<void> {
    const tokens = await this.http
      .post<TokenResponse>(`${this.BASE}/auth/login`, req)
      .toPromise();
    if (tokens) {
      this.storeTokens(tokens);
      await this.loadCurrentUser();
      await this.router.navigateByUrl('/dashboard');
    }
  }

  async register(req: RegisterRequest): Promise<void> {
    const tokens = await this.http
      .post<TokenResponse>(`${this.BASE}/auth/register`, req)
      .toPromise();
    if (tokens) {
      this.storeTokens(tokens);
      await this.loadCurrentUser();
      await this.router.navigateByUrl('/onboarding');
    }
  }

  async loginWithGoogle(idToken: string): Promise<void> {
    const tokens = await this.http
      .post<TokenResponse>(`${this.BASE}/auth/google`, { idToken })
      .toPromise();
    if (tokens) {
      this.storeTokens(tokens);
      await this.loadCurrentUser();
      await this.router.navigateByUrl('/dashboard');
    }
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = this.getStoredRefreshToken();
      if (refreshToken) {
        await this.http
          .post(`${this.BASE}/auth/logout`, { refreshToken })
          .toPromise();
      }
    } catch {
      // ignore errors on logout
    } finally {
      this.clearTokens();
      this.currentUser.set(null);
      this.appState.user.set(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('talk-with-me.mock-user');
      }
      await this.router.navigateByUrl('/login');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    await this.http
      .post(`${this.BASE}/auth/forgot-password`, { email })
      .toPromise();
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.http
      .post(`${this.BASE}/auth/reset-password`, { token, newPassword })
      .toPromise();
  }

  async loadCurrentUser(): Promise<void> {
    const me = await this.http
      .get<MeResponse>(`${this.BASE}/me`)
      .toPromise();
    if (me) this.currentUser.set(me);
  }

  // ── Token refresh — used by TokenInterceptor ───────────────────────────────

  /**
   * Returns an Observable that emits a new access token.
   * Multiple simultaneous callers share a single refresh request via Subject.
   */
  refreshTokens(): Observable<string> {
    if (this._isRefreshing) {
      // Queue — wait for the ongoing refresh to complete
      return this._refreshSubject.asObservable();
    }

    this._isRefreshing = true;
    const refreshToken = this.getStoredRefreshToken();

    if (!refreshToken) {
      this._isRefreshing = false;
      return throwError(() => new Error('No refresh token'));
    }

    return this.http
      .post<TokenResponse>(`${this.BASE}/auth/refresh`, { refreshToken })
      .pipe(
        tap((tokens) => {
          this.storeTokens(tokens);
          this._isRefreshing = false;
          this._refreshSubject.next(tokens.accessToken);
        }),
        switchMap((tokens) => {
          return [tokens.accessToken] as unknown as Observable<string>;
        }),
        catchError((err: unknown) => {
          this._isRefreshing = false;
          this.clearTokens();
          this.currentUser.set(null);
          void this.router.navigateByUrl('/login');
          return throwError(() => err);
        })
      );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private storeTokens(resp: TokenResponse): void {
    this._accessToken = resp.accessToken;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, resp.refreshToken);
    }
  }

  private clearTokens(): void {
    this._accessToken = null;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  private getStoredRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  }
}
