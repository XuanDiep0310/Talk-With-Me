import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AppHealth, ServiceHealth, OverallSystemHealth } from '../models/health.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HealthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getAppHealth(): Observable<AppHealth> {
    return this.http.get<AppHealth>(`${this.baseUrl}/health`);
  }

  getDatabaseHealth(): Observable<ServiceHealth> {
    return this.http.get<ServiceHealth>(`${this.baseUrl}/health/database`);
  }

  getRedisHealth(): Observable<ServiceHealth> {
    return this.http.get<ServiceHealth>(`${this.baseUrl}/health/redis`);
  }

  getSystemOverview(): Observable<OverallSystemHealth> {
    return forkJoin({
      app: this.getAppHealth().pipe(
        catchError(() =>
          of({
            app_name: 'Talk-With-Me API',
            version: 'Unknown',
            environment: 'Unknown',
            status: 'unhealthy' as const,
            timestamp: new Date().toISOString()
          })
        )
      ),
      database: this.getDatabaseHealth().pipe(
        catchError((err) =>
          of({
            service: 'postgresql',
            status: 'unhealthy' as const,
            details: err.message || 'Unable to connect to database',
            timestamp: new Date().toISOString()
          })
        )
      ),
      redis: this.getRedisHealth().pipe(
        catchError((err) =>
          of({
            service: 'redis',
            status: 'unhealthy' as const,
            details: err.message || 'Unable to connect to redis',
            timestamp: new Date().toISOString()
          })
        )
      )
    }).pipe(
      map(({ app, database, redis }) => ({
        app,
        database,
        redis,
        isLoading: false,
        error: null,
        lastChecked: new Date()
      }))
    );
  }
}
