import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PronunciationAssessResponse } from './scenario.service';

export interface OptionItem {
  key: string;
  label: string;
}

export interface ScriptedPlacementPrompt {
  id: string;
  targetBand: string;
  text: string;
  translation: string;
  ipa: string;
  focusPhonemes: string[];
}

export interface OnboardingOptionsResponse {
  interests: OptionItem[];
  goals: OptionItem[];
  weakPoints: OptionItem[];
  cefrLevels: string[];
  placementQuestions: string[];
  scriptedPrompts: ScriptedPlacementPrompt[];
}

export interface UpdatePreferencesRequest {
  interests: string[];
  goals: string[];
  weakPoints: string[];
}

export interface PreferencesResponse {
  interests: string[];
  goals: string[];
  weakPoints: string[];
}

export interface PlacementTestResponse {
  id: string;
  userId: string;
  status: string;
  currentStage?: number;
  questions: string[];
  scriptedPrompts?: ScriptedPlacementPrompt[];
  createdAt: string;
  initialTier?: number;
  initialTierLabel?: string;
  initialQuestion?: string;
  initialQuestionTranslation?: string;
}

export interface SubmitAnswerRequest {
  requestId: string;
  stage?: number;
  promptId?: string;
  questionIndex: number;
  transcript?: string;
  sttConfidence?: number;
  speakingDurationSeconds?: number;
  responseLatencySeconds?: number;
}

export interface AnswerResponse {
  id: string;
  testId: string;
  requestId: string;
  stage: number;
  promptId?: string | null;
  questionIndex: number;
  transcript: string | null;
  wordCount: number | null;
  createdAt: string;
  currentTier?: number;
  currentTierLabel?: string;
  nextQuestion?: string | null;
  nextQuestionIndex?: number | null;
  nextTier?: number | null;
  nextTierLabel?: string | null;
  nextQuestionTranslation?: string | null;
  isConverged?: boolean;
  canFinishEarly?: boolean;
  totalAnswered?: number;
  currentEstimatedLevel?: string;
  pronunciation?: PronunciationAssessResponse | null;
  nextStage?: number;
  stage1Completed?: boolean;
}

export interface PlacementCompleteResponse {
  testId: string;
  estimatedLevel: string;
  isInsufficientData: boolean;
  needsReassessment: boolean;
  score: number;
  continuousBand?: number;
  dimensionScores?: Record<string, number | null>;
  limitingDimensions?: string[];
  explanationVi?: string;
}

export interface SetLevelRequest {
  level: string;
  source: 'PLACEMENT' | 'SELF' | 'DEFAULT';
}

export interface LevelResponse {
  cefrLevel: string;
  levelSource: string;
  needsReassessment: boolean;
}

export interface OnboardingCompleteResponse {
  onboardingCompletedAt: string;
  cefrLevel: string;
  levelSource: string;
  needsReassessment: boolean;
  interests: string[];
  goals: string[];
  weakPoints: string[];
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);
  private readonly BASE = environment.apiUrl;

  getOptions(): Observable<OnboardingOptionsResponse> {
    return this.http.get<OnboardingOptionsResponse>(`${this.BASE}/onboarding/options`);
  }

  updatePreferences(req: UpdatePreferencesRequest): Observable<PreferencesResponse> {
    return this.http.put<PreferencesResponse>(`${this.BASE}/me/preferences`, req);
  }

  createPlacementTest(): Observable<PlacementTestResponse> {
    return this.http.post<PlacementTestResponse>(`${this.BASE}/placement-tests`, {});
  }

  submitAnswer(testId: string, req: SubmitAnswerRequest): Observable<AnswerResponse> {
    return this.http.post<AnswerResponse>(`${this.BASE}/placement-tests/${testId}/answers`, req);
  }

  submitAudioAnswer(
    testId: string,
    payload: {
      audioWav: Blob;
      requestId: string;
      stage: 1 | 2;
      questionIndex: number;
      promptId?: string;
      responseLatencySeconds?: number;
    }
  ): Observable<AnswerResponse> {
    const form = new FormData();
    form.append('audio', payload.audioWav, 'answer.wav');
    form.append('request_id', payload.requestId);
    form.append('stage', String(payload.stage));
    form.append('question_index', String(payload.questionIndex));
    if (payload.promptId) form.append('prompt_id', payload.promptId);
    if (payload.responseLatencySeconds !== undefined) {
      form.append('response_latency_seconds', String(payload.responseLatencySeconds));
    }
    return this.http.post<AnswerResponse>(`${this.BASE}/placement-tests/${testId}/audio-answers`, form);
  }

  completePlacementTest(testId: string): Observable<PlacementCompleteResponse> {
    return this.http.post<PlacementCompleteResponse>(`${this.BASE}/placement-tests/${testId}/complete`, {});
  }

  setLevel(req: SetLevelRequest): Observable<LevelResponse> {
    return this.http.put<LevelResponse>(`${this.BASE}/me/level`, req);
  }

  completeOnboarding(): Observable<OnboardingCompleteResponse> {
    return this.http.post<OnboardingCompleteResponse>(`${this.BASE}/me/onboarding/complete`, {});
  }

  translate(text: string, targetLang = 'vi'): Observable<{ originalText: string; translatedText: string }> {
    return this.http.post<{ originalText: string; translatedText: string }>(
      `${this.BASE}/coach/translate`,
      { text, targetLang }
    );
  }
}
