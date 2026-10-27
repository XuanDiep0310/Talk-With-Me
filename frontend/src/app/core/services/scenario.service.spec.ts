/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ScenarioService, evaluatePronunciation, getIpaPhonetic } from './scenario.service';
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
        expect(res.totalCount).toBe(1);
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
      categories: [
        { category: 'DAILY_LIFE', nameVi: 'Đời sống hằng ngày', totalCount: 1, completedCount: 0 },
      ],
      totalCount: 1,
      completedCount: 0,
      totalProgressPct: 0,
      xpReward: 100,
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
        isSkipped: false,
      })
      .subscribe((res) => {
        expect(res.attemptId).toBe('att-1');
      });

    const req = httpMock.expectOne(`${environment.apiUrl}/scenarios/scen-123/drills`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.chunkId).toBe('chunk-1');
    req.flush({
      attemptId: 'att-1',
      chunkId: 'chunk-1',
      scenarioId: 'scen-123',
      isSkipped: false,
      practicedChunks: ['chunk-1'],
      message: 'Recorded',
    });
  });

  it('should get roleplay evaluation', () => {
    service.getRoleplayEvaluation('sess-456').subscribe((res) => {
      expect(res.passed).toBeTrue();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/roleplays/sess-456/evaluation`);
    expect(req.request.method).toBe('GET');
    req.flush({
      sessionId: 'sess-456',
      scenarioId: 'scen-123',
      scenarioTitle: 'Shopping',
      status: 'FEEDBACK_READY',
      passed: true,
      overallScore: 85,
      requirements: [],
      chunksUsedWell: [],
      chunksToImprove: [],
      strengths: [],
      improvements: [],
      nextPractice: null,
      evaluatedAt: null,
    });
  });

  it('should evaluate chunk pronunciation with word matching and score', () => {
    const res = evaluatePronunciation("I'm looking for", "I am looking for milk");
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.isMatch).toBeTrue();
    expect(res.words.length).toBe(3);
  });

  it('should generate phonetic IPA transcription for chunk words', () => {
    const ipa = getIpaPhonetic("I'm looking for");
    expect(ipa).toContain('aɪm');
    expect(ipa).toContain('fɔːr');
  });
});
