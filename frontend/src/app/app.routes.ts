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
    path: 'voice',
    loadComponent: () =>
      import('./features/voice-demo/voice-demo.component').then(
        (m) => m.VoiceDemoComponent
      )
  },
  {
    path: '**',
    redirectTo: 'health'
  }
];

