/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService, mapApiError, TokenResponse, MeResponse } from './auth.service';
import { AppStateService } from './app-state.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockAppState: jasmine.SpyObj<AppStateService>;
  const BASE = environment.apiUrl;

  const mockTokens: TokenResponse = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenType: 'bearer',
    expiresIn: 3600,
  };

  const mockUser: MeResponse = {
    id: 'user-001',
    email: 'user@example.com',
    fullName: 'Nguyen Van A',
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    localStorage.clear();
    mockRouter = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    mockAppState = jasmine.createSpyObj<AppStateService>('AppStateService', ['go'], {
      user: { set: jasmine.createSpy('set') } as unknown as AppStateService['user'],
    });

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
        { provide: AppStateService, useValue: mockAppState },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('Initialization (initialize)', () => {
    it('does nothing if no refresh token exists in localStorage', async () => {
      await service.initialize();
      expect(service.currentUser()).toBeNull();
      expect(service.accessToken).toBeNull();
    });

    it('exchanges existing refresh token for new access token and loads current user', async () => {
      localStorage.setItem('twm.refresh_token', 'saved-refresh-token');

      const initPromise = service.initialize();

      const refreshReq = httpMock.expectOne(`${BASE}/auth/refresh`);
      expect(refreshReq.request.method).toBe('POST');
      expect(refreshReq.request.body).toEqual({ refreshToken: 'saved-refresh-token' });
      refreshReq.flush(mockTokens);

      await Promise.resolve();

      const meReq = httpMock.expectOne(`${BASE}/me`);
      expect(meReq.request.method).toBe('GET');
      meReq.flush(mockUser);

      await initPromise;

      expect(service.accessToken).toBe(mockTokens.accessToken);
      expect(service.currentUser()).toEqual(mockUser);
      expect(service.isAuthenticated()).toBeTrue();
      expect(localStorage.getItem('twm.refresh_token')).toBe(mockTokens.refreshToken);
    });

    it('clears stale tokens silently when refresh fails during initialize', async () => {
      localStorage.setItem('twm.refresh_token', 'stale-refresh-token');

      const initPromise = service.initialize();

      const refreshReq = httpMock.expectOne(`${BASE}/auth/refresh`);
      refreshReq.flush({ code: 'INVALID_TOKEN' }, { status: 401, statusText: 'Unauthorized' });

      await initPromise;

      expect(service.accessToken).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(localStorage.getItem('twm.refresh_token')).toBeNull();
    });
  });

  describe('Login (login)', () => {
    it('authenticates, stores tokens, loads user profile, and navigates to /dashboard', async () => {
      const loginPromise = service.login({
        email: 'test@example.com',
        password: 'Password123!',
        rememberMe: true,
      });

      const loginReq = httpMock.expectOne(`${BASE}/auth/login`);
      expect(loginReq.request.method).toBe('POST');
      loginReq.flush(mockTokens);

      await Promise.resolve();

      const meReq = httpMock.expectOne(`${BASE}/me`);
      meReq.flush(mockUser);

      await loginPromise;

      expect(service.accessToken).toBe(mockTokens.accessToken);
      expect(service.currentUser()).toEqual(mockUser);
      expect(service.isAuthenticated()).toBeTrue();
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Register (register)', () => {
    it('creates account, stores tokens, loads user, and navigates to /onboarding', async () => {
      const regPromise = service.register({
        email: 'new@example.com',
        fullName: 'New User',
        password: 'Password123!',
        termsAccepted: true,
      });

      const regReq = httpMock.expectOne(`${BASE}/auth/register`);
      expect(regReq.request.method).toBe('POST');
      regReq.flush(mockTokens);

      await Promise.resolve();

      const meReq = httpMock.expectOne(`${BASE}/me`);
      meReq.flush(mockUser);

      await regPromise;

      expect(service.accessToken).toBe(mockTokens.accessToken);
      expect(service.currentUser()).toEqual(mockUser);
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/onboarding');
    });
  });

  describe('Google Login (loginWithGoogle)', () => {
    it('posts google idToken, stores tokens, and navigates to /dashboard', async () => {
      const googlePromise = service.loginWithGoogle('google-id-token-xyz');

      const req = httpMock.expectOne(`${BASE}/auth/google`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ idToken: 'google-id-token-xyz' });
      req.flush(mockTokens);

      await Promise.resolve();

      const meReq = httpMock.expectOne(`${BASE}/me`);
      meReq.flush(mockUser);

      await googlePromise;

      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/dashboard');
      expect(service.currentUser()).toEqual(mockUser);
    });
  });

  describe('Logout (logout)', () => {
    it('revokes refresh token on backend, clears local state, and navigates to /login', async () => {
      localStorage.setItem('twm.refresh_token', 'active-refresh-token');

      const logoutPromise = service.logout();

      const logoutReq = httpMock.expectOne(`${BASE}/auth/logout`);
      expect(logoutReq.request.method).toBe('POST');
      expect(logoutReq.request.body).toEqual({ refreshToken: 'active-refresh-token' });
      logoutReq.flush({});

      await logoutPromise;

      expect(service.accessToken).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(localStorage.getItem('twm.refresh_token')).toBeNull();
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('still clears local state and redirects if backend logout fails', async () => {
      localStorage.setItem('twm.refresh_token', 'stale-refresh-token');

      const logoutPromise = service.logout();

      const logoutReq = httpMock.expectOne(`${BASE}/auth/logout`);
      logoutReq.flush({}, { status: 500, statusText: 'Server Error' });

      await logoutPromise;

      expect(service.accessToken).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(localStorage.getItem('twm.refresh_token')).toBeNull();
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/login');
    });
  });

  describe('Forgot & Reset Password', () => {
    it('forgotPassword sends POST to /auth/forgot-password', async () => {
      const promise = service.forgotPassword('user@example.com');

      const req = httpMock.expectOne(`${BASE}/auth/forgot-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com' });
      req.flush({});

      await promise;
    });

    it('resetPassword sends POST to /auth/reset-password with token and new password', async () => {
      const promise = service.resetPassword('secret-token-123', 'NewPass123!');

      const req = httpMock.expectOne(`${BASE}/auth/reset-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ token: 'secret-token-123', newPassword: 'NewPass123!' });
      req.flush({});

      await promise;
    });
  });

  describe('Token Refresh (refreshTokens)', () => {
    it('throws error immediately if no refresh token is stored', (done) => {
      service.refreshTokens().subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err.message).toBe('No refresh token');
          done();
        },
      });
    });

    it('refreshes token successfully and updates accessToken', (done) => {
      localStorage.setItem('twm.refresh_token', 'valid-refresh-token');

      service.refreshTokens().subscribe({
        next: (newToken) => {
          expect(newToken).toBe(mockTokens.accessToken);
          expect(service.accessToken).toBe(mockTokens.accessToken);
          expect(localStorage.getItem('twm.refresh_token')).toBe(mockTokens.refreshToken);
          done();
        },
      });

      const req = httpMock.expectOne(`${BASE}/auth/refresh`);
      req.flush(mockTokens);
    });

    it('clears state, redirects to /login and throws error if refresh call fails', (done) => {
      localStorage.setItem('twm.refresh_token', 'expired-refresh-token');

      service.refreshTokens().subscribe({
        next: () => fail('Should have failed'),
        error: () => {
          expect(service.accessToken).toBeNull();
          expect(service.currentUser()).toBeNull();
          expect(localStorage.getItem('twm.refresh_token')).toBeNull();
          expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/login');
          done();
        },
      });

      const req = httpMock.expectOne(`${BASE}/auth/refresh`);
      req.flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('mapApiError utility', () => {
    it('handles network error (status 0)', () => {
      const err = new HttpErrorResponse({ status: 0 });
      expect(mapApiError(err)).toBe('Không thể kết nối tới máy chủ.');
    });

    it('maps known error codes correctly', () => {
      const createErr = (code: string) =>
        new HttpErrorResponse({ status: 400, error: { code } });

      expect(mapApiError(createErr('INVALID_CREDENTIALS'))).toBe('Email hoặc mật khẩu không đúng.');
      expect(mapApiError(createErr('ACCOUNT_LOCKED'))).toBe('Tài khoản tạm khóa do nhập sai quá nhiều lần.');
      expect(mapApiError(createErr('EMAIL_ALREADY_EXISTS'))).toBe('Email này đã có tài khoản.');
      expect(mapApiError(createErr('TERMS_NOT_ACCEPTED'))).toBe('Vui lòng chấp nhận điều khoản.');
      expect(mapApiError(createErr('PASSWORD_TOO_SHORT'))).toBe('Mật khẩu tối thiểu 6 ký tự.');
    });

    it('returns custom backend message when code is unrecognized', () => {
      const err = new HttpErrorResponse({
        status: 400,
        error: { code: 'UNKNOWN_CUSTOM', message: 'Tùy chỉnh từ máy chủ' },
      });
      expect(mapApiError(err)).toBe('Tùy chỉnh từ máy chủ');
    });

    it('returns fallback message for non-http errors', () => {
      expect(mapApiError(new Error('Random'))).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.');
    });
  });
});
