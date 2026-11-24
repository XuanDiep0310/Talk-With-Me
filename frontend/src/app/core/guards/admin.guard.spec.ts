import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminReturnUrl } from '../utils/admin-route';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  const currentUser = signal<{ role: string; onboardingCompletedAt: null } | null>(null);
  const route = new ActivatedRouteSnapshot();
  const target = { url: '/admin/scenarios/new' } as RouterStateSnapshot;

  beforeEach(() => {
    currentUser.set(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { currentUser } }]
    });
  });

  it('retains the admin URL for login', () => {
    const redirect = TestBed.runInInjectionContext(() => adminGuard(route, target)) as UrlTree;
    expect(redirect.queryParams['returnUrl']).toBe(target.url);
    expect(TestBed.inject(Router).serializeUrl(redirect)).toMatch(/^\/login\?/);
  });

  it('redirects a learner to their dashboard', () => {
    currentUser.set({ role: 'LEARNER', onboardingCompletedAt: null });
    const redirect = TestBed.runInInjectionContext(() => adminGuard(route, target)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(redirect)).toBe('/dashboard');
  });

  it('allows a new admin without learner onboarding', () => {
    currentUser.set({ role: 'ADMIN', onboardingCompletedAt: null });
    expect(TestBed.runInInjectionContext(() => adminGuard(route, target))).toBeTrue();
  });

  it('retains new admin pages and scoped history after login', () => {
    const id = '12345678-1234-1234-1234-123456789abc';
    for (const url of [
      '/admin/coach-topics', '/admin/gamification', '/admin/analytics', '/admin/audit-logs',
      '/admin/sessions/' + id, '/admin/users/' + id, '/admin/sessions?userId=' + id,
    ]) {
      expect(adminReturnUrl(url)).toBe(url);
    }
    expect(adminReturnUrl('/admin/sessions?userId=' + id + '&next=//example.com')).toBeNull();
  });

  it('rejects arbitrary and external login return URLs', () => {
    for (const url of ['//example.com/admin', '/admin/../dashboard', '/onboarding']) {
      expect(adminReturnUrl(url)).toBeNull();
    }
  });
});
