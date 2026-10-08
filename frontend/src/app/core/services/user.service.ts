import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { MeResponse, SettingsResponse } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly BASE = environment.apiUrl;

  updateMe(req: { fullName?: string; avatarUrl?: string }): Observable<MeResponse> {
    return this.http.patch<MeResponse>(`${this.BASE}/me`, req);
  }

  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ avatarUrl: string }>(`${this.BASE}/me/avatar`, form);
  }

  getSettings(): Observable<SettingsResponse> {
    return this.http.get<SettingsResponse>(`${this.BASE}/me/settings`);
  }

  updateSettings(patch: Partial<SettingsResponse>): Observable<SettingsResponse> {
    return this.http.patch<SettingsResponse>(`${this.BASE}/me/settings`, patch);
  }

  changePassword(req: { oldPassword: string; newPassword: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.BASE}/me/change-password`, req);
  }
}
