import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OptionItem {
  key: string;
  label: string;
}

export interface OnboardingOptionsResponse {
  interests: OptionItem[];
  goals: OptionItem[];
  weakPoints: OptionItem[];
  cefrLevels: string[];
  placementQuestions: string[];
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
  questions: string[];
  createdAt: string;
  initialTier?: number;
  initialTierLabel?: string;
  initialQuestion?: string;
  initialQuestionTranslation?: string;
}

export interface SubmitAnswerRequest {
  requestId: string;
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
}

export interface PlacementCompleteResponse {
  testId: string;
  estimatedLevel: string;
  isInsufficientData: boolean;
  needsReassessment: boolean;
  score: number;
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