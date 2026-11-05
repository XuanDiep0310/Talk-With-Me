import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardResponse,
  ProgressSummaryResponse,
  ProgressSkillsResponse,
  ProgressHistoryResponse,
  GamificationSummaryResponse,
  DailyMissionItem,
  BadgeItem,
  XpHistoryItem,
  NotificationItem,
} from '../models/gamification.models';

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly http = inject(HttpClient);
  private readonly BASE = environment.apiUrl;

  getDashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.BASE}/dashboard`);
  }

  getProgressSummary(): Observable<ProgressSummaryResponse> {
    return this.http.get<ProgressSummaryResponse>(`${this.BASE}/progress/summary`);
  }

  getProgressSkills(): Observable<ProgressSkillsResponse> {
    return this.http.get<ProgressSkillsResponse>(`${this.BASE}/progress/skills`);
  }

  getProgressHistory(cursor?: string | null, limit = 20, type?: string | null): Observable<ProgressHistoryResponse> {
    let params = new HttpParams().set('limit', limit);
    if (cursor) params = params.set('cursor', cursor);
    if (type) params = params.set('type', type);
    return this.http.get<ProgressHistoryResponse>(`${this.BASE}/progress/history`, { params });
  }

  getGamificationSummary(): Observable<GamificationSummaryResponse> {
    return this.http.get<GamificationSummaryResponse>(`${this.BASE}/gamification/summary`);
  }

  getTodayMissions(): Observable<{ missions: DailyMissionItem[] }> {
    return this.http.get<{ missions: DailyMissionItem[] }>(`${this.BASE}/missions/today`);
  }

  claimMission(missionId: string): Observable<{ success: boolean; xpAwarded: number; newTotalXp: number }> {
    return this.http.post<{ success: boolean; xpAwarded: number; newTotalXp: number }>(
      `${this.BASE}/missions/${missionId}/claim`,
      {}
    );
  }

  getBadges(): Observable<{ badges: BadgeItem[] }> {
    return this.http.get<{ badges: BadgeItem[] }>(`${this.BASE}/badges`);
  }

  getXpHistory(limit = 50): Observable<{ transactions: XpHistoryItem[] }> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<{ transactions: XpHistoryItem[] }>(`${this.BASE}/xp-history`, { params });
  }

  getNotifications(): Observable<{ notifications: NotificationItem[] }> {
    return this.http.get<{ notifications: NotificationItem[] }>(`${this.BASE}/notifications`);
  }

  markNotificationRead(notificationId: string): Observable<{ id: string; read: boolean }> {
    return this.http.patch<{ id: string; read: boolean }>(
      `${this.BASE}/notifications/${notificationId}/read`,
      {}
    );
  }

  markAllNotificationsRead(): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(`${this.BASE}/notifications/read-all`, {});
  }
}
