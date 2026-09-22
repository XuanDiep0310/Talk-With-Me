import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HealthApiService } from './health-api.service';
import { environment } from '../../../environments/environment';

describe('HealthApiService', () => {
  let service: HealthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HealthApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(HealthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch app health correctly', () => {
    const mockAppHealth = {
      app_name: 'Talk-With-Me API',
      version: '0.1.0',
      environment: 'test',
      status: 'healthy' as const,
      timestamp: '2026-09-17T00:00:00Z'
    };

    service.getAppHealth().subscribe((res) => {
      expect(res).toEqual(mockAppHealth);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/health`);
    expect(req.request.method).toBe('GET');
    req.flush(mockAppHealth);
  });

  it('should fetch database health correctly', () => {
    const mockDbHealth = {
      service: 'postgresql',
      status: 'healthy' as const,
      latency_ms: 1.25,
      details: 'Database connection active',
      timestamp: '2026-09-17T00:00:00Z'
    };

    service.getDatabaseHealth().subscribe((res) => {
      expect(res).toEqual(mockDbHealth);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/health/database`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDbHealth);
  });

  it('should fetch redis health correctly', () => {
    const mockRedisHealth = {
      service: 'redis',
      status: 'healthy' as const,
      latency_ms: 0.85,
      details: 'Redis connection active',
      timestamp: '2026-09-17T00:00:00Z'
    };

    service.getRedisHealth().subscribe((res) => {
      expect(res).toEqual(mockRedisHealth);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/health/redis`);
    expect(req.request.method).toBe('GET');
    req.flush(mockRedisHealth);
  });
});
