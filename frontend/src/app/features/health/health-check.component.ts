import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthApiService } from '../../core/services/health-api.service';
import { OverallSystemHealth } from '../../core/models/health.model';

@Component({
  selector: 'app-health-check',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './health-check.component.html',
  styleUrls: ['./health-check.component.scss']
})
export class HealthCheckComponent implements OnInit {
  private readonly healthService = inject(HealthApiService);

  readonly state = signal<OverallSystemHealth>({
    app: null,
    database: null,
    redis: null,
    isLoading: true,
    error: null,
    lastChecked: undefined
  });

  ngOnInit(): void {
    this.refreshHealth();
  }

  refreshHealth(): void {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));
    this.healthService.getSystemOverview().subscribe({
      next: (overview) => {
        this.state.set(overview);
      },
      error: (err) => {
        this.state.update((s) => ({
          ...s,
          isLoading: false,
          error: err.message || 'Failed to fetch system health status.'
        }));
      }
    });
  }

  isAllHealthy(): boolean {
    const s = this.state();
    return (
      s.app?.status === 'healthy' &&
      s.database?.status === 'healthy' &&
      s.redis?.status === 'healthy'
    );
  }
}
