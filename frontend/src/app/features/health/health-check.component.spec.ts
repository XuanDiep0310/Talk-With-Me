import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HealthCheckComponent } from './health-check.component';
import { HealthApiService } from '../../core/services/health-api.service';
import { OverallSystemHealth } from '../../core/models/health.model';

describe('HealthCheckComponent', () => {
  let component: HealthCheckComponent;
  let fixture: ComponentFixture<HealthCheckComponent>;
  let mockHealthService: jasmine.SpyObj<HealthApiService>;

  const mockOverview: OverallSystemHealth = {
    app: {
      app_name: 'Talk-With-Me API',
      version: '0.1.0',
      environment: 'test',
      status: 'healthy',
      timestamp: '2026-09-17T00:00:00Z'
    },
    database: {
      service: 'postgresql',
      status: 'healthy',
      latency_ms: 1.5,
      details: 'Database connection active',
      timestamp: '2026-09-17T00:00:00Z'
    },
    redis: {
      service: 'redis',
      status: 'healthy',
      latency_ms: 0.9,
      details: 'Redis connection active',
      timestamp: '2026-09-17T00:00:00Z'
    },
    isLoading: false,
    error: null,
    lastChecked: new Date()
  };

  beforeEach(async () => {
    mockHealthService = jasmine.createSpyObj('HealthApiService', ['getSystemOverview']);
    mockHealthService.getSystemOverview.and.returnValue(of(mockOverview));

    await TestBed.configureTestingModule({
      imports: [HealthCheckComponent],
      providers: [
        { provide: HealthApiService, useValue: mockHealthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HealthCheckComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load system health', () => {
    expect(component).toBeTruthy();
    expect(mockHealthService.getSystemOverview).toHaveBeenCalled();
    expect(component.isAllHealthy()).toBeTrue();
    expect(component.state().app?.app_name).toBe('Talk-With-Me API');
  });

  it('should render service cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('TalkWithMe System Health');
    expect(compiled.querySelectorAll('.card').length).toBe(3);
  });
});
