import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Ensures user is authenticated.
 * If user hasn't completed onboarding, redirects to /onboarding (unless already heading there).
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const user = authService.currentUser();
  const isOnboarded = !!user?.onboardingCompletedAt;

  if (!isOnboarded) {
    return router.createUrlTree(['/onboarding']);
  }

  return true;
};

/**
 * Guard for /onboarding route:
 * - If not authenticated, redirects to /login.
 * - If already onboarded, redirects to /dashboard.
 */
export const onboardingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const user = authService.currentUser();
  const isOnboarded = !!user?.onboardingCompletedAt;

  if (isOnboarded) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
