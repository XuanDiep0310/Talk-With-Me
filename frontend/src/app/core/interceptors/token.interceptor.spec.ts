import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { tokenInterceptor } from './token.interceptor';
import { AuthService } from '../services/auth.service';
import { of } from 'rxjs';

describe('tokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: {
    accessToken: string | null;
    refreshTokens: jasmine.Spy;
  };

  beforeEach(() => {
    mockAuthService = {
      accessToken: 'initial-access-token',
      refreshTokens: jasmine.createSpy('refreshTokens').and.returnValue(of('new-access-token')),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches Bearer token to requests', () => {
    http.get('/api/v1/me').subscribe();

    const req = httpMock.expectOne('/api/v1/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer initial-access-token');
    req.flush({});
  });

  it('does not attach Bearer token to /auth/ endpoints', () => {
    http.post('/api/v1/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('refreshes token on 401 response and retries request', () => {
    http.get('/api/v1/me').subscribe();

    // First attempt gets 401
    const firstReq = httpMock.expectOne('/api/v1/me');
    firstReq.flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });

    expect(mockAuthService.refreshTokens).toHaveBeenCalled();

    // Retried attempt with new token
    const retryReq = httpMock.expectOne('/api/v1/me');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retryReq.flush({ fullName: 'Success' });
  });
});
