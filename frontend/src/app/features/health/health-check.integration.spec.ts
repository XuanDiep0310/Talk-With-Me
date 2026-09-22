import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HealthCheckComponent } from './health-check.component';
import { HealthApiService } from '../../core/services/health-api.service';
import { environment } from '../../../environments/environment';

describe('HealthCheckComponent (Integration with HttpClient)', () => {
  let fixture: ComponentFixture<HealthCheckComponent>;
  let component: HealthCheckComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthCheckComponent],
      providers: [
        HealthApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HealthCheckComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should initialize, trigger HTTP requests and update UI with live healthy data', fakeAsync(() => {
    fixture.detectChanges(); // triggers ngOnInit -> refreshHealth()

    // Expect 3 concurrent HTTP calls to backend endpoints
    const reqApp = httpMock.expectOne(`${environment.apiUrl}/health`);
    const reqDb = httpMock.expectOne(`${environment.apiUrl}/health/database`);
    const reqRedis = httpMock.expectOne(`${environment.apiUrl}/health/redis`);

    expect(reqApp.request.method).toBe('GET');
    expect(reqDb.request.method).toBe('GET');
    expect(reqRedis.request.method).toBe('GET');

    // Simulate backend responses
    reqApp.flush({
      app_name: 'Talk-With-Me API',
      version: '0.1.0',
      environment: 'development',
      status: 'healthy',
      timestamp: new Date().toISOString()
    });

    reqDb.flush({
      service: 'postgresql',
      status: 'healthy',
      latency_ms: 1.82,
      details: 'Database connection active',
      timestamp: new Date().toISOString()
    });

    reqRedis.flush({
      service: 'redis',
      status: 'healthy',
      latency_ms: 0.64,
      details: 'Redis connection active',
      timestamp: new Date().toISOString()
    });

    tick();
    fixture.detectChanges();

    expect(component.isAllHealthy()).toBeTrue();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.status-banner')?.textContent).toContain('All Systems Operational');
    expect(compiled.querySelectorAll('.card').length).toBe(3);
    expect(compiled.querySelectorAll('.badge-healthy').length).toBe(3);
  }));

  it('should gracefully handle partial backend degradation (e.g. Redis down)', fakeAsync(() => {
    fixture.detectChanges();

    const reqApp = httpMock.expectOne(`${environment.apiUrl}/health`);
    const reqDb = httpMock.expectOne(`${environment.apiUrl}/health/database`);
    const reqRedis = httpMock.expectOne(`${environment.apiUrl}/health/redis`);

    reqApp.flush({
      app_name: 'Talk-With-Me API',
      version: '0.1.0',
      environment: 'development',
      status: 'healthy',
      timestamp: new Date().toISOString()
    });

    reqDb.flush({
      service: 'postgresql',
      status: 'healthy',
      latency_ms: 2.1,
      details: 'Database connection active',
      timestamp: new Date().toISOString()
    });

    // Simulate 503 Redis failure
    reqRedis.flush(
      {
        service: 'redis',
        status: 'unhealthy',
        latency_ms: 50.0,
        details: 'Redis connection refused',
        timestamp: new Date().toISOString()
      },
      { status: 503, statusText: 'Service Unavailable' }
    );

    tick();
    fixture.detectChanges();

    expect(component.isAllHealthy()).toBeFalse();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.status-banner')?.textContent).toContain('Partial Outage / Degradation Detected');
  }));
});
