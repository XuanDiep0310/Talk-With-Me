import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ScenarioCategory = 'DAILY_LIFE' | 'SOCIAL' | 'TRAVEL_SHOPPING' | 'WORKPLACE';
export type ScenarioStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type ChunkFunctionalTag = 'OPENING' | 'REQUEST' | 'CLARIFY' | 'AGREE_DECLINE' | 'CLOSING';

export interface ScenarioSummary {
  id: string;
  slug: string;
  category: ScenarioCategory;
  titleVi: string;
  titleEn: string;
  level: string;
  estimatedMinutes: number;
  userRole: string;
  aiRole: string;
  status: ScenarioStatus;
  highestScore: number | null;
  sortOrder: number;
  xpReward: number;
}

export interface ScenarioCategorySummary {
  labelVi: string;
  total: number;
  completed: number;
}

export interface ScenarioLibraryResponse {
  categories: Record<string, ScenarioCategorySummary>;
  totalScenarios: number;
  completedScenarios: number;
  completionRatePercent: number;
  scenarios: ScenarioSummary[];
}

export interface ScenarioRequirement {
  id: string;
  scenarioId: string;
  descriptionVi: string;
  descriptionEn: string;
  requirementType: string;
  expectedFunctionalTag: string;
  isMandatory: boolean;
  sortOrder: number;
}

export interface ScenarioChunk {
  id: string;
  scenarioId: string;
  functionalTag: ChunkFunctionalTag;
  text: string;
  meaningVi: string;
  audioUrl: string | null;
  exampleSentence: string;
  acceptedVariations: string[];
  sortOrder: number;
}

export interface ScenarioDetail {
  id: string;
  slug: string;
  category: ScenarioCategory;
  titleVi: string;
  titleEn: string;
  level: string;
  estimatedMinutes: number;
  contextVi: string;
  contextEn: string;
  userRole: string;
  aiRole: string;
  goals: string[];
  status: ScenarioStatus;
  highestScore: number | null;
  requirements: ScenarioRequirement[];
  chunks: ScenarioChunk[];
  xpReward: number;
}

export interface ScenarioChunksResponse {
  scenarioId: string;
  chunks: ScenarioChunk[];
}

export interface RecordDrillRequest {
  chunkId: string;
  action: 'REPEAT' | 'NEXT' | 'SKIP';
  spokenText?: string;
}

export interface RecordDrillResponse {
  success: boolean;
  action: string;
  chunkId: string;
  completedChunksCount: number;
  totalChunksCount: number;
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
  passed: boolean;
  evidenceTranscript: string | null;
  feedback: string;
}

export interface ChunkUsedWellItem {
  chunkId: string;
  expectedText: string;
  userSpokenText: string;
  similarityScore: number;
  matchType: string;
}

export interface ChunkToImproveItem {
  chunkId: string;
  text: string;
  meaningVi: string;
  reason: string;
}

export interface SkillScoresBreakdown {
  pronunciation?: number | null;
  fluency?: number | null;
  vocabulary?: number | null;
  grammar?: number | null;
  coherence?: number | null;
}

export interface RoleplayEvaluationResponse {
  id: string;
  sessionId: string;
  scenarioId: string;
  status: 'PENDING' | 'COMPLETED' | 'INSUFFICIENT_DATA';
  allMandatoryPassed: boolean;
  scenarioCompleted: boolean;
  overallScore: number | null;
  requirements: RequirementEvaluationItem[];
  chunksUsedWell: ChunkUsedWellItem[];
  chunksToImprove: ChunkToImproveItem[];
  strengths: string[];
  improvements: string[];
  nextPracticeSuggestions: string[];
  skillScores?: SkillScoresBreakdown | null;
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

@Injectable({
  providedIn: 'root'
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
    if (filter?.category && filter.category !== 'all') {
      params = params.set('category', filter.category);
    }
    if (filter?.level && filter.level !== 'all' && filter.level !== 'Tất cả') {
      params = params.set('level', filter.level);
    }
    if (filter?.status && filter.status !== 'all') {
      params = params.set('status', filter.status);
    }
    if (filter?.q) {
      params = params.set('q', filter.q);
    }
    return this.http.get<ScenarioLibraryResponse>(`${this.baseUrl}/scenarios`, { params });
  }

  getScenario(idOrSlug: string): Observable<ScenarioDetail> {
    return this.http.get<ScenarioDetail>(`${this.baseUrl}/scenarios/${idOrSlug}`);
  }

  getScenarioChunks(id: string): Observable<ScenarioChunksResponse> {
    return this.http.get<ScenarioChunksResponse>(`${this.baseUrl}/scenarios/${id}/chunks`);
  }

  recordDrill(scenarioId: string, req: RecordDrillRequest): Observable<RecordDrillResponse> {
    return this.http.post<RecordDrillResponse>(`${this.baseUrl}/scenarios/${scenarioId}/drills`, req);
  }

  startRoleplay(scenarioId: string): Observable<RoleplaySessionResponse> {
    return this.http.post<RoleplaySessionResponse>(`${this.baseUrl}/scenarios/${scenarioId}/roleplays`, {});
  }

  addRoleplayTranscript(sessionId: string, data: {
    id: string;
    speaker: 'USER' | 'AI';
    text: string;
    startMs?: number;
    endMs?: number;
    confidence?: number;
    isFinal?: boolean;
  }): Observable<unknown> {
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
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ChunkBankResponse>(`${this.baseUrl}/me/chunk-bank`, { params });
  }

  playChunkAudio(text: string, audioUrl?: string | null): void {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => this.fallbackSpeak(text));
    } else {
      this.fallbackSpeak(text);
    }
  }

  private fallbackSpeak(text: string): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }
}
