/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { environment } from '../../../environments/environment';
import type { MeResponse, SettingsResponse } from './auth.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  const BASE = environment.apiUrl;

  const mockUser: MeResponse = {
    id: 'user-001',
    email: 'user@example.com',
    fullName: 'Nguyen Van A',
    avatarUrl: '/uploads/avatars/user-001.png',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockSettings: SettingsResponse = {
    notificationsEnabled: true,
    dailyReminderEnabled: true,
    aiVoice: 'female',
    speechSpeed: 'normal',
    theme: 'system',
    timezone: 'Asia/Ho_Chi_Minh',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('updateMe sends PATCH to /me with partial profile data', () => {
    service.updateMe({ fullName: 'Nguyen Van B' }).subscribe((res) => {
      expect(res.fullName).toBe('Nguyen Van B');
    });

    const req = httpMock.expectOne(`${BASE}/me`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ fullName: 'Nguyen Van B' });
    req.flush({ ...mockUser, fullName: 'Nguyen Van B' });
  });

  it('uploadAvatar sends multipart POST to /me/avatar', () => {
    const file = new File(['dummy-image-content'], 'avatar.png', { type: 'image/png' });

    service.uploadAvatar(file).subscribe((res) => {
      expect(res.avatarUrl).toContain('/uploads/avatars/user-001.png');
    });

    const req = httpMock.expectOne(`${BASE}/me/avatar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush({ avatarUrl: '/uploads/avatars/user-001.png?t=123456' });
  });

  it('getSettings sends GET to /me/settings', () => {
    service.getSettings().subscribe((res) => {
      expect(res).toEqual(mockSettings);
    });

    const req = httpMock.expectOne(`${BASE}/me/settings`);
    expect(req.request.method).toBe('GET');
    req.flush(mockSettings);
  });

  it('updateSettings sends PATCH to /me/settings with partial updates', () => {
    service.updateSettings({ aiVoice: 'male', speechSpeed: 'fast' }).subscribe((res) => {
      expect(res.aiVoice).toBe('male');
      expect(res.speechSpeed).toBe('fast');
    });

    const req = httpMock.expectOne(`${BASE}/me/settings`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ aiVoice: 'male', speechSpeed: 'fast' });
    req.flush({ ...mockSettings, aiVoice: 'male', speechSpeed: 'fast' });
  });

  it('changePassword sends POST to /me/change-password with old and new password', () => {
    service.changePassword({ oldPassword: 'OldPass123!', newPassword: 'NewPass123!' }).subscribe((res) => {
      expect(res.message).toBe('Mật khẩu đã được thay đổi');
    });

    const req = httpMock.expectOne(`${BASE}/me/change-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ oldPassword: 'OldPass123!', newPassword: 'NewPass123!' });
    req.flush({ message: 'Mật khẩu đã được thay đổi' });
  });
});
