import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'health',
    pathMatch: 'full'
  },
  {
    path: 'health',
    loadComponent: () =>
      import('./features/health/health-check.component').then(
        (m) => m.HealthCheckComponent
      )
  },
  {
    path: '**',
    redirectTo: 'health'
  }
];
