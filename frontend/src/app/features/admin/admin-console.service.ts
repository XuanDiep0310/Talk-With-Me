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
