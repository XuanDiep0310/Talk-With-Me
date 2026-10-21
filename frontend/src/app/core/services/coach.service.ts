import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CoachTopic {
  id: string;
  category: string;
  title: string;
  description: string;
  minLevel: string;
  targetSkills: string[];
  isActive: boolean;
  score?: number;
}

export interface CoachTopicGroup {
  category: string;
  topics: CoachTopic[];
}

export interface CoachTopicsResponse {
  recommended: CoachTopic[];
  groups: CoachTopicGroup[];
  totalTopics: number;
}

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  speaker: 'USER' | 'AI';
  userId?: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  isFinal: boolean;
  seq: number;
  createdAt?: string;
}

export interface CoachSession {
  id: string;
  type: string;
  userId: string;
  topicId?: string;
  topic?: CoachTopic;
  level: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  spokenSeconds: number;
  endReason?: string;
  initialMessage?: string;
  transcripts: TranscriptSegment[];
}

export interface EndSessionResponse {
  id: string;
  status: string;
  endedAt?: string;
  durationSeconds: number;
  spokenSeconds: number;
  endReason?: string;
}

export interface WsTicketResponse {
  ticket: string;
  expiresIn: number;
}

export interface SkillScore {
  skillName: string;
  label: string;
  score: number | null;
  isReference: boolean;
  naReason?: string | null;
  components?: Record<string, any>;
}

export interface SessionFeedback {
  sessionId: string;
  status: 'PENDING' | 'FEEDBACK_READY' | 'INSUFFICIENT_DATA' | 'FAILED';
  formulaVersion?: string;
  overallScore: number | null;
  partial: boolean;
  retryable: boolean;
  errorMessage?: string | null;
  skills: SkillScore[];
  strengths: string[];
  improvements: string[];
  nextPractice?: string | null;
  generatedAt?: string | null;
}

export interface FeedbackStatusResponse {
  sessionId: string;
  status: string;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CoachService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getTopics(q?: string): Observable<CoachTopicsResponse> {
    let params = new HttpParams();
    if (q && q.trim()) {
      params = params.set('q', q.trim());
    }
    return this.http.get<CoachTopicsResponse>(`${this.apiUrl}/coach/topics`, { params });
  }

  createSession(topicId?: string): Observable<CoachSession> {
    return this.http.post<CoachSession>(`${this.apiUrl}/coach/sessions`, {
      topicId: topicId || null,
    });
  }

  getSession(sessionId: string): Observable<CoachSession> {
    return this.http.get<CoachSession>(`${this.apiUrl}/coach/sessions/${sessionId}`);
  }

  addTranscript(
    sessionId: string,
    segment: {
      id: string;
      speaker: 'USER' | 'AI';
      text: string;
      startMs?: number;
      endMs?: number;
      confidence?: number;
      isFinal?: boolean;
    }
  ): Observable<TranscriptSegment> {
    return this.http.post<TranscriptSegment>(
      `${this.apiUrl}/coach/sessions/${sessionId}/transcript`,
      segment
    );
  }

  listTranscripts(sessionId: string, afterSeq = 0): Observable<TranscriptSegment[]> {
    const params = new HttpParams().set('afterSeq', afterSeq.toString());
    return this.http.get<TranscriptSegment[]>(
      `${this.apiUrl}/coach/sessions/${sessionId}/transcript`,
      { params }
    );
  }

  endSession(sessionId: string, reason = 'USER_REQUESTED'): Observable<EndSessionResponse> {
    return this.http.post<EndSessionResponse>(
      `${this.apiUrl}/coach/sessions/${sessionId}/end`,
      { reason }
    );
  }

  getFeedback(sessionId: string): Observable<SessionFeedback> {
    return this.http.get<SessionFeedback>(
      `${this.apiUrl}/coach/sessions/${sessionId}/feedback`
    );
  }

  retryFeedback(sessionId: string): Observable<SessionFeedback> {
    return this.http.post<SessionFeedback>(
      `${this.apiUrl}/coach/sessions/${sessionId}/feedback/retry`,
      {}
    );
  }

  getWsTicket(): Observable<WsTicketResponse> {
    return this.http.post<WsTicketResponse>(`${this.apiUrl}/ws-tickets`, {});
  }

  translate(text: string, targetLang = 'vi'): Observable<{ originalText: string; translatedText: string }> {
    return this.http.post<{ originalText: string; translatedText: string }>(
      `${this.apiUrl}/coach/translate`,
      { text, targetLang }
    );
  }

  getSuggestions(sessionId: string): Observable<{ sessionId: string; level: string; suggestions: { text: string; translation: string }[] }> {
    return this.http.get<{ sessionId: string; level: string; suggestions: { text: string; translation: string }[] }>(
      `${this.apiUrl}/coach/sessions/${sessionId}/suggestions`
    );
  }
}

