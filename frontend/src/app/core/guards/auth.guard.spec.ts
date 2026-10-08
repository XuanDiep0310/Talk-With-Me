import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { signal } from '@angular/core';

describe('authGuard', () => {
  let mockAuthService: { isAuthenticated: () => boolean; currentUser: ReturnType<typeof signal> };
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(() => {
    mockAuthService = {
      currentUser: signal(null),
      isAuthenticated: () => mockAuthService.currentUser() !== null,
    };
    mockRouter = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    mockRouter.createUrlTree.and.returnValue({} as UrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('allows access when user is authenticated', () => {
    mockAuthService.currentUser.set({
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).toBeTrue();
  });

  it('redirects to /login when user is not authenticated', () => {
    mockAuthService.currentUser.set(null);

    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toEqual({} as UrlTree);
  });
});
