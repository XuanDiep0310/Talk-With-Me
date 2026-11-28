import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ScenarioCategory = string;
export type ScenarioStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ChunkFunctionalTag = 'OPENING' | 'REQUEST' | 'CLARIFY' | 'AGREE_DECLINE' | 'CLOSING';

export interface ScenarioSummary {
  id: string;
  slug: string;
  category: ScenarioCategory;
  titleVi: string;
  titleEn: string;
  level: string;
  estimatedDurationMinutes: number;
  userRole: string;
  aiRole: string;
  goals: string[];
  sortOrder: number;
  status: ScenarioStatus;
  highestScore: number | null;
  xpReward: number;
  chunksCount: number;
}

export interface ScenarioCategorySummary {
  category: string;
  nameVi: string;
  totalCount: number;
  completedCount: number;
}

export interface ScenarioLibraryResponse {
  scenarios: ScenarioSummary[];
  totalCount: number;
  completedCount: number;
  totalProgressPct: number;
  categories: ScenarioCategorySummary[];
  xpReward: number;
}

export interface ScenarioRequirement {
  id: string;
  description: string;
  type: string;
  expectedChunkFunction?: string | null;
  isMandatory: boolean;
  sortOrder: number;
}

export interface ScenarioChunk {
  id: string;
  scenarioId?: string;
  functionTag: ChunkFunctionalTag;
  text: string;
  meaningVi: string;
  ipa?: string;
  audioUrl?: string | null;
  exampleSentence: string;
  exampleSentenceIpa?: string;
  acceptedVariations: string[];
  distractorsEn: string[];
  distractorsVi: string[];
  sortOrder: number;
}

export interface ScenarioDetail {
  id: string;
  slug: string;
  category: ScenarioCategory;
  titleVi: string;
  titleEn: string;
  level: string;
  estimatedDurationMinutes: number;
  context: string;
  userRole: string;
  aiRole: string;
  goals: string[];
  sortOrder: number;
  status: ScenarioStatus;
  highestScore: number | null;
  xpReward: number;
  requirements: ScenarioRequirement[];
  chunks: ScenarioChunk[];
  practicedChunks: string[];
}

export interface ScenarioChunksResponse {
  scenarioId: string;
  scenarioTitle: string;
  chunks: ScenarioChunk[];
}

export interface RecordDrillRequest {
  chunkId: string;
  isSkipped?: boolean;
  accuracyScore?: number;
  fluencyScore?: number;
  prosodyScore?: number;
  phonemeErrors?: Record<string, unknown>[];
}

export interface RecordDrillResponse {
  attemptId: string;
  chunkId: string;
  scenarioId: string;
  isSkipped: boolean;
  practicedChunks: string[];
  message: string;
}

export interface RoleplaySessionResponse {
  sessionId: string;
  scenarioId: string;
  status: string;
  openingMessage: string;
  chunks: ScenarioChunk[];
}

export interface RoleplayEndResponse {
  id: string;
  status: string;
  endedAt: string | null;
  durationSeconds: number;
  spokenSeconds: number;
  endReason?: string | null;
}

export interface RequirementEvaluationItem {
  requirementId: string;
  description: string;
  isMandatory: boolean;
  status: 'PASS' | 'FAIL';
  evidence: string | null;
  reason: string;
}

export interface ChunkUsedWellItem {
  chunkId: string;
  text: string;
  functionTag: string;
  matchedUtterance: string;
  matchType: string;
}

export interface ChunkToImproveItem {
  chunkId: string;
  text: string;
  functionTag: string;
  meaningVi: string;
  reason: string;
}

export interface RoleplayEvaluationResponse {
  sessionId: string;
  scenarioId: string;
  scenarioTitle: string;
  status: 'PENDING' | 'FEEDBACK_READY' | 'INSUFFICIENT_DATA' | 'FAILED';
  passed: boolean;
  overallScore: number | null;
  requirements: RequirementEvaluationItem[];
  chunksUsedWell: ChunkUsedWellItem[];
  chunksToImprove: ChunkToImproveItem[];
  strengths: string[];
  improvements: string[];
  nextPractice: string | null;
  evaluatedAt: string | null;
}

export interface ChunkBankItem {
  id: string;
  chunkId: string;
  status: 'NEEDS_PRACTICE' | 'MASTERED';
  lastReviewedAt: string;
  chunkText: string;
  meaningVi: string;
  scenarioTitle: string;
}

export interface ChunkBankResponse {
  items: ChunkBankItem[];
  totalCount: number;
  needsPracticeCount: number;
  masteredCount: number;
}

export interface SyllableScore {
  text: string;
  accuracyScore: number;
  status: 'good' | 'fair' | 'poor';
}

export interface PhonemeScore {
  ipa: string;
  accuracyScore: number;
  heardAs?: string | null;
}

export interface WordPronunciationDetail {
  word: string;
  accuracyScore: number;
  errorType: string;
  ipa: string;
  status: 'good' | 'fair' | 'poor';
  syllables: SyllableScore[];
  phonemes: PhonemeScore[];
}

export interface PronunciationAssessResponse {
  transcript: string;
  referenceText: string;
  mode: 'scripted' | 'shadowing';
  provider: string;
  displayScore: number | null;
  accuracyScore: number | null;
  fluencyScore: number | null;
  prosodyScore: number | null;
  completenessScore: number | null;
  ipa: string;
  words: WordPronunciationDetail[];
  coachingTipVi: string;
  passed: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ScenarioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getScenarios(filter?: {
    category?: string;
    level?: string;
    status?: string;
    q?: string;
  }): Observable<ScenarioLibraryResponse> {
    let params = new HttpParams();
    if (filter?.category && filter.category !== 'all') params = params.set('category', filter.category);
    if (filter?.level && filter.level !== 'all' && filter.level !== 'Tất cả') params = params.set('level', filter.level);
    if (filter?.status && filter.status !== 'all') params = params.set('status', filter.status);
    if (filter?.q) params = params.set('q', filter.q);
    return this.http.get<ScenarioLibraryResponse>(`${this.baseUrl}/scenarios`, { params });
  }

  getScenario(idOrSlug: string): Observable<ScenarioDetail> {
    return this.http.get<ScenarioDetail>(`${this.baseUrl}/scenarios/${idOrSlug}`);
  }

  getScenarioChunks(id: string): Observable<ScenarioChunksResponse> {
    return this.http.get<ScenarioChunksResponse>(`${this.baseUrl}/scenarios/${id}/chunks`);
  }

  assessPronunciation(
    audioWav: Blob,
    referenceText: string,
    mode: 'scripted' | 'shadowing' = 'scripted'
  ): Observable<PronunciationAssessResponse> {
    const form = new FormData();
    form.append('audio', audioWav, 'speech.wav');
    form.append('reference_text', referenceText);
    form.append('mode', mode);
    return this.http.post<PronunciationAssessResponse>(`${this.baseUrl}/pronunciation/assess`, form);
  }

  recordDrill(scenarioId: string, req: RecordDrillRequest): Observable<RecordDrillResponse> {
    return this.http.post<RecordDrillResponse>(`${this.baseUrl}/scenarios/${scenarioId}/drills`, req);
  }

  startRoleplay(scenarioId: string): Observable<RoleplaySessionResponse> {
    return this.http.post<RoleplaySessionResponse>(`${this.baseUrl}/scenarios/${scenarioId}/roleplays`, {});
  }

  addRoleplayTranscript(
    sessionId: string,
    data: {
      id: string;
      speaker: 'USER' | 'AI';
      text: string;
      startMs?: number;
      endMs?: number;
      confidence?: number;
      isFinal?: boolean;
    }
  ): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/roleplays/${sessionId}/transcript`, data);
  }

  endRoleplay(sessionId: string, reason = 'USER_REQUESTED'): Observable<RoleplayEndResponse> {
    return this.http.post<RoleplayEndResponse>(`${this.baseUrl}/roleplays/${sessionId}/end`, { reason });
  }

  getRoleplayEvaluation(sessionId: string): Observable<RoleplayEvaluationResponse> {
    return this.http.get<RoleplayEvaluationResponse>(`${this.baseUrl}/roleplays/${sessionId}/evaluation`);
  }

  getChunkBank(status?: string): Observable<ChunkBankResponse> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ChunkBankResponse>(`${this.baseUrl}/me/chunk-bank`, { params });
  }

  playChunkAudio(text: string, audioUrl?: string | null, slow = false): void {
    const rate = slow ? 0.65 : 0.95;
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.playbackRate = slow ? 0.65 : 1.0;
      audio.play().catch(() => this.fallbackSpeak(text, rate));
    } else {
      this.fallbackSpeak(text, rate);
    }
  }

  private fallbackSpeak(text: string, rate = 0.95): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
    }
  }
}
