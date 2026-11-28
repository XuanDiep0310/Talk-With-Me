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

  it('should post WAV audio and reference text for syllable pronunciation assessment', () => {
    const wavBlob = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' });
    service.assessPronunciation(wavBlob, 'How long have you been working there', 'scripted').subscribe((res) => {
      expect(res.displayScore).toBe(86);
      expect(res.words[0].syllables.length).toBe(2);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/pronunciation/assess`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    const form = req.request.body as FormData;
    expect(form.get('reference_text')).toBe('How long have you been working there');
    expect(form.get('mode')).toBe('scripted');
    req.flush({
      transcript: 'How long have you been working there',
      referenceText: 'How long have you been working there',
      mode: 'scripted',
      provider: 'azure_sdk',
      displayScore: 86,
      accuracyScore: 88,
      fluencyScore: 85,
      prosodyScore: 82,
      completenessScore: 100,
      ipa: 'wɜːrkɪŋ',
      words: [
        {
          word: 'working',
          accuracyScore: 72,
          errorType: 'None',
          ipa: 'wɜːrkɪŋ',
          status: 'fair',
          syllables: [
            { text: 'wor', accuracyScore: 48, status: 'poor' },
            { text: 'king', accuracyScore: 95, status: 'good' },
          ],
          phonemes: [],
        },
      ],
      coachingTipVi: 'Lưu ý âm /ɜːr/.',
      passed: true,
    });
  });

  it('should record reflex drill with acoustic scores and phoneme errors', () => {
    service
      .recordDrill('scen-123', {
        chunkId: 'chunk-2',
        isSkipped: false,
        accuracyScore: 84,
        fluencyScore: 86,
        prosodyScore: 80,
        phonemeErrors: [{ word: 'working', ipa: 'ɜːr', accuracyScore: 42 }],
      })
      .subscribe((res) => {
        expect(res.chunkId).toBe('chunk-2');
      });

    const req = httpMock.expectOne(`${environment.apiUrl}/scenarios/scen-123/drills`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.accuracyScore).toBe(84);
    req.flush({
      attemptId: 'att-2',
      chunkId: 'chunk-2',
      scenarioId: 'scen-123',
      isSkipped: false,
      practicedChunks: ['chunk-2'],
      message: 'Recorded',
    });
  });
});
