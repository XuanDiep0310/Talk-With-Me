/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ScenarioService } from './scenario.service';
import { environment } from '../../../environments/environment';

describe('ScenarioService', () => {
  let service: ScenarioService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ScenarioService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ScenarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should query scenarios with category and search filter', () => {
    service
      .getScenarios({ category: 'DAILY_LIFE', level: 'A2', q: 'supermarket' })
      .subscribe((res) => {
        expect(res.totalScenarios).toBe(1);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/scenarios` &&
        r.params.get('category') === 'DAILY_LIFE' &&
        r.params.get('level') === 'A2' &&
        r.params.get('q') === 'supermarket'
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      categories: {
        DAILY_LIFE: { labelVi: 'Đời sống hằng ngày', total: 1, completed: 0 },
      },
      totalScenarios: 1,
      completedScenarios: 0,
      completionRatePercent: 0,
      scenarios: [],
    });
  });

  it('should start roleplay session for scenario', () => {
    service.startRoleplay('scen-123').subscribe((res) => {
      expect(res.sessionId).toBe('sess-456');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/scenarios/scen-123/roleplays`);
    expect(req.request.method).toBe('POST');
    req.flush({
      sessionId: 'sess-456',
      scenarioId: 'scen-123',
      status: 'CREATED',
      openingMessage: 'Hello!',
      chunks: [],
    });
  });

  it('should record reflex drill attempt', () => {
    service
      .recordDrill('scen-123', {
        chunkId: 'chunk-1',
        action: 'NEXT',
        spokenText: 'Hello world',
      })
      .subscribe((res) => {
        expect(res.success).toBeTrue();
      });

    const req = httpMock.expectOne(`${environment.apiUrl}/scenarios/scen-123/drills`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.action).toBe('NEXT');
    req.flush({
      success: true,
      action: 'NEXT',
      chunkId: 'chunk-1',
      completedChunksCount: 1,
      totalChunksCount: 4,
    });
  });

  it('should get roleplay evaluation', () => {
    service.getRoleplayEvaluation('sess-456').subscribe((res) => {
      expect(res.allMandatoryPassed).toBeTrue();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/roleplays/sess-456/evaluation`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'eval-1',
      sessionId: 'sess-456',
      scenarioId: 'scen-123',
      status: 'COMPLETED',
      allMandatoryPassed: true,
      scenarioCompleted: true,
      overallScore: 85,
      requirements: [],
      chunksUsedWell: [],
      chunksToImprove: [],
      strengths: [],
      improvements: [],
      nextPracticeSuggestions: [],
    });
  });
});
