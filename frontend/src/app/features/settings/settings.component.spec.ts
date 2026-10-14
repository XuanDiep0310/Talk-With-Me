/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { AppStateService } from '../../core/services/app-state.service';
import { ToastService } from '../../core/services/toast.service';
import { signal, WritableSignal } from '@angular/core';
import { of, throwError } from 'rxjs';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let mockAuthService: {
    isAuthenticated: jasmine.Spy;
    logout: jasmine.Spy;
  };
  let mockUserService: jasmine.SpyObj<UserService>;
  let mockAppState: {
    settings: WritableSignal<{
      notifications: boolean;
      dailyReminder: boolean;
      aiVoice: string;
      aiSpeed: string;
      theme: string;
    }>;
    updateSettings: jasmine.Spy;
    go: jasmine.Spy;
  };
  let mockToast: jasmine.SpyObj<ToastService>;

  const initialSettings = {
    notificationsEnabled: true,
    dailyReminderEnabled: false,
    aiVoice: 'male' as const,
    speechSpeed: 'fast' as const,
    theme: 'dark' as const,
    timezone: 'Asia/Ho_Chi_Minh',
  };

  beforeEach(async () => {
    mockAuthService = {
      isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(true),
      logout: jasmine.createSpy('logout').and.returnValue(Promise.resolve()),
    };

    mockUserService = jasmine.createSpyObj<UserService>('UserService', [
      'getSettings',
      'updateSettings',
    ]);
    mockUserService.getSettings.and.returnValue(of(initialSettings));
    mockUserService.updateSettings.and.returnValue(of(initialSettings));

    mockAppState = {
      settings: signal({
        notifications: true,
        dailyReminder: false,
        aiVoice: 'male',
        aiSpeed: 'fast',
        theme: 'dark',
      }),
      updateSettings: jasmine.createSpy('updateSettings'),
      go: jasmine.createSpy('go'),
    };

    mockToast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        { provide: AppStateService, useValue: mockAppState },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads remote settings on init when authenticated', () => {
    expect(mockUserService.getSettings).toHaveBeenCalled();
    expect(component.notifications()).toBeTrue();
    expect(component.dailyReminder()).toBeFalse();
    expect(component.aiVoice()).toBe('male');
    expect(component.aiSpeed()).toBe('fast');
    expect(component.theme()).toBe('dark');
  });

  it('toggles notifications and persists changes', () => {
    component.toggleNotifications();

    expect(component.notifications()).toBeFalse();
    expect(mockAppState.updateSettings).toHaveBeenCalledWith({ notifications: false });
    expect(mockUserService.updateSettings).toHaveBeenCalledWith({ notificationsEnabled: false });
    expect(mockToast.success).toHaveBeenCalledWith('Đã lưu thay đổi.');
  });

  it('toggles daily reminder and persists changes', () => {
    component.toggleDailyReminder();

    expect(component.dailyReminder()).toBeTrue();
    expect(mockAppState.updateSettings).toHaveBeenCalledWith({ dailyReminder: true });
    expect(mockUserService.updateSettings).toHaveBeenCalledWith({ dailyReminderEnabled: true });
    expect(mockToast.success).toHaveBeenCalledWith('Đã lưu thay đổi.');
  });

  it('updates AI voice selection', () => {
    const event = { target: { value: 'female' } } as unknown as Event;
    component.updateAiVoice(event);

    expect(component.aiVoice()).toBe('female');
    expect(mockAppState.updateSettings).toHaveBeenCalledWith({ aiVoice: 'female' });
    expect(mockUserService.updateSettings).toHaveBeenCalledWith({ aiVoice: 'female' });
  });

  it('updates AI speech speed', () => {
    const event = { target: { value: 'normal' } } as unknown as Event;
    component.updateAiSpeed(event);

    expect(component.aiSpeed()).toBe('normal');
    expect(mockAppState.updateSettings).toHaveBeenCalledWith({ aiSpeed: 'normal' });
    expect(mockUserService.updateSettings).toHaveBeenCalledWith({ speechSpeed: 'normal' });
  });

  it('updates theme selection', () => {
    component.setTheme('light');

    expect(component.theme()).toBe('light');
    expect(mockAppState.updateSettings).toHaveBeenCalledWith({ theme: 'light' });
    expect(mockUserService.updateSettings).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('shows toast error when saving settings to server fails', () => {
    mockUserService.updateSettings.and.returnValue(throwError(() => new Error('Save error')));

    component.toggleNotifications();

    expect(mockToast.error).toHaveBeenCalledWith('Không thể lưu cài đặt lên máy chủ.');
  });

  it('calls authService.logout on logout button click', async () => {
    await component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });
});
