import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminReturnUrl } from '../utils/admin-route';

export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.currentUser();
  if (!user) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: adminReturnUrl(state.url) ?? '/admin' }
    });
  }
  return user.role === 'ADMIN' || router.createUrlTree(['/dashboard']);
};
