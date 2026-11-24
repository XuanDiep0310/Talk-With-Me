import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { components } from '../../core/api/openapi';

type Schemas = components['schemas'];
export type AdminAccount = Schemas['AdminAccountSummary'];
export type AccountUpdate = Schemas['AdminAccountUpdate'];
export type AdminOverview = Schemas['AdminOverview'];

@Injectable({ providedIn: 'root' })
export class AdminConsoleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

  listAccounts(q: string, cursor?: string) {
    let params = new HttpParams().set('q', q.trim());
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<Schemas['AdminAccountPage']>(`${this.base}/users`, { params });
  }

  updateAccount(id: string, body: AccountUpdate) {
    return this.http.patch<void>(`${this.base}/users/${id}`, body);
  }

  listCoachTopics(filters: Record<string, string>) {
    return this.http.get<Schemas['AdminCoachTopic'][]>(`${this.base}/coach-topics`, { params: this.params(filters) });
  }

  createCoachTopic(body: Schemas['AdminCoachTopicInput']) {
    return this.http.post<Schemas['AdminCoachTopic']>(`${this.base}/coach-topics`, body);
  }

  updateCoachTopic(id: string, body: Schemas['AdminCoachTopicUpdate']) {
    return this.http.patch<Schemas['AdminCoachTopic']>(`${this.base}/coach-topics/${id}`, body);
  }

  draftCoachTopic(idea: string) {
    return this.http.post<Schemas['CoachTopicDraft']>(`${this.base}/coach-topics/generate`, { idea });
  }

  xpRules() {
    return this.http.get<Schemas['AdminXpRule'][]>(`${this.base}/gamification/xp-rules`);
  }

  updateXpRule(key: string, body: Schemas['AdminXpRuleUpdate']) {
    return this.http.patch<Schemas['AdminXpRule']>(`${this.base}/gamification/xp-rules/${key}`, body);
  }

  missions() {
    return this.http.get<Schemas['AdminMission'][]>(`${this.base}/gamification/missions`);
  }

  updateMission(key: string, body: Schemas['AdminMissionUpdate']) {
    return this.http.patch<Schemas['AdminMission']>(`${this.base}/gamification/missions/${key}`, body);
  }

  badges() {
    return this.http.get<Schemas['AdminBadge'][]>(`${this.base}/gamification/badges`);
  }

  xpTransactions(filters: Record<string, string>) {
    return this.http.get<Schemas['AdminXpPage']>(`${this.base}/gamification/transactions`, { params: this.params(filters) });
  }

  sessions(filters: Record<string, string>) {
    return this.http.get<Schemas['AdminSessionPage']>(`${this.base}/sessions`, { params: this.params(filters) });
  }

  session(id: string) {
    return this.http.get<Schemas['AdminSessionDetail']>(`${this.base}/sessions/${id}`);
  }

  transcript(id: string, cursor?: string) {
    return this.http.get<Schemas['AdminTranscriptPage']>(`${this.base}/sessions/${id}/transcript`, {
      params: this.params({ cursor: cursor ?? '' }),
    });
  }

  retryFeedback(id: string) {
    return this.http.post<Schemas['SessionFeedbackResponse']>(`${this.base}/sessions/${id}/retry-feedback`, null);
  }

  updateQaLabels(id: string, body: Schemas['AdminQaLabels']) {
    return this.http.patch<Schemas['AdminQaLabels']>(`${this.base}/sessions/${id}/qa-labels`, body);
  }

  account(id: string) {
    return this.http.get<Schemas['AdminAccountDetail']>(`${this.base}/users/${id}`);
  }

  placements(id: string, cursor?: string) {
    return this.http.get<Schemas['AdminPlacementPage']>(`${this.base}/users/${id}/placements`, {
      params: this.params({ cursor: cursor ?? '' }),
    });
  }

  forceLogout(id: string) {
    return this.http.post<void>(`${this.base}/users/${id}/force-logout`, null);
  }

  analytics(period: Schemas['AdminAnalytics']['range']) {
    return this.http.get<Schemas['AdminAnalytics']>(`${this.base}/analytics/overview`, {
      params: this.params({ range: period }),
    });
  }

  auditLogs(filters: Record<string, string>) {
    return this.http.get<Schemas['AdminAuditPage']>(`${this.base}/audit-logs`, { params: this.params(filters) });
  }

  private params(filters: Record<string, string>): HttpParams {
    let params = new HttpParams();
    for (const [name, value] of Object.entries(filters)) {
      if (value.trim()) params = params.set(name, value.trim());
    }
    return params;
  }

  overview() {
    return this.http.get<AdminOverview>(`${this.base}/overview`);
  }
}
