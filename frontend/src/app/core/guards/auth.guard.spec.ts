import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard, onboardingGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { signal } from '@angular/core';

describe('authGuard', () => {
  let mockAuthService: { isAuthenticated: () => boolean; currentUser: ReturnType<typeof signal> };
  let mockRouter: jasmine.SpyObj<Router>;
  const dummyRoute = {} as unknown as ActivatedRouteSnapshot;
  const dummyState = {} as unknown as RouterStateSnapshot;

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

  it('allows access when user is authenticated and onboarded', () => {
    mockAuthService.currentUser.set({
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
      onboardingCompletedAt: '2026-01-01T01:00:00Z',
    });

    const result = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('redirects to /onboarding when user is authenticated but not onboarded', () => {
    mockAuthService.currentUser.set({
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
      onboardingCompletedAt: null,
    });

    const result = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/onboarding']);
    expect(result).toEqual({} as UrlTree);
  });

  it('redirects to /login when user is not authenticated', () => {
    mockAuthService.currentUser.set(null);

    const result = TestBed.runInInjectionContext(() => authGuard(dummyRoute, dummyState));
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toEqual({} as UrlTree);
  });
});

describe('onboardingGuard', () => {
  let mockAuthService: { isAuthenticated: () => boolean; currentUser: ReturnType<typeof signal> };
  let mockRouter: jasmine.SpyObj<Router>;
  const dummyRoute = {} as unknown as ActivatedRouteSnapshot;
  const dummyState = {} as unknown as RouterStateSnapshot;

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

  it('allows access to onboarding when authenticated and not onboarded', () => {
    mockAuthService.currentUser.set({
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
      onboardingCompletedAt: null,
    });

    const result = TestBed.runInInjectionContext(() => onboardingGuard(dummyRoute, dummyState));
    expect(result).toBeTrue();
  });

  it('redirects to /dashboard when user is already onboarded', () => {
    mockAuthService.currentUser.set({
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
      onboardingCompletedAt: '2026-01-01T01:00:00Z',
    });

    const result = TestBed.runInInjectionContext(() => onboardingGuard(dummyRoute, dummyState));
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    expect(result).toEqual({} as UrlTree);
  });

  it('redirects to /login when not authenticated', () => {
    mockAuthService.currentUser.set(null);

    const result = TestBed.runInInjectionContext(() => onboardingGuard(dummyRoute, dummyState));
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toEqual({} as UrlTree);
  });
});
