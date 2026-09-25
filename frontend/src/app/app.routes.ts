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
    path: 'scenario-roleplay',
    loadComponent: () =>
      import('./features/scenarios/scenario-roleplay.component').then((m) => m.ScenarioRoleplayComponent)
  },
  {
    path: 'community-room',
    loadComponent: () =>
      import('./features/community/community-room.component').then((m) => m.CommunityRoomComponent)
  },

  // Main application layout shell routes
  {
    path: '',
    loadComponent: () =>
      import('./shared/components/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'ai-coach',
        loadComponent: () =>
          import('./features/ai-coach/ai-coach.component').then((m) => m.AiCoachComponent)
      },
      {
        path: 'ai-coach-report',
        loadComponent: () =>
          import('./features/ai-coach/ai-coach-report.component').then((m) => m.AiCoachReportComponent)
      },
      {
        path: 'scenarios',
        loadComponent: () =>
          import('./features/scenarios/scenarios.component').then((m) => m.ScenariosComponent)
      },
      {
        path: 'scenario-detail',
        loadComponent: () =>
          import('./features/scenarios/scenario-detail.component').then((m) => m.ScenarioDetailComponent)
      },
      {
        path: 'scenario-result',
        loadComponent: () =>
          import('./features/scenarios/scenario-result.component').then((m) => m.ScenarioResultComponent)
      },
      {
        path: 'community',
        loadComponent: () =>
          import('./features/community/community.component').then((m) => m.CommunityComponent)
      },
      {
        path: 'progress',
        loadComponent: () =>
          import('./features/progress/progress.component').then((m) => m.ProgressComponent)
      },
      {
        path: 'achievements',
        loadComponent: () =>
          import('./features/achievements/achievements.component').then((m) => m.AchievementsComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent)
      },
      {
        path: 'help',
        loadComponent: () =>
          import('./features/help/help.component').then((m) => m.HelpComponent)
      },
      {
        path: 'health',
        loadComponent: () =>
          import('./features/health/health-check.component').then((m) => m.HealthCheckComponent)
      }
    ]
  },

  // Fallback wildcard
  {
    path: '**',
    redirectTo: ''
  }
];
