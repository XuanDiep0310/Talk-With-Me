import { Routes } from '@angular/router';

export const routes: Routes = [
  // Standalone pages without app layout shell
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent)
  },
  {
    path: 'landing',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then((m) => m.OnboardingComponent)
  },
  {
    path: 'ai-coach-session',
    loadComponent: () =>
      import('./features/ai-coach/ai-coach-session.component').then((m) => m.AiCoachSessionComponent)
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
    redirectTo: ''
  }
];

