/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { AppStateService } from '../../core/services/app-state.service';
import { ToastService } from '../../core/services/toast.service';
import { signal, WritableSignal } from '@angular/core';
import { of, throwError } from 'rxjs';
import type { MeResponse } from '../../core/services/auth.service';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let mockAuthService: {
    currentUser: WritableSignal<MeResponse | null>;
    loadCurrentUser: jasmine.Spy;
    logout: jasmine.Spy;
  };
  let mockUserService: jasmine.SpyObj<UserService>;
  let mockAppState: {
    appUser: WritableSignal<{ name: string; email: string; level: string }>;
    totalXp: WritableSignal<number>;
    currentStreak: WritableSignal<number>;
  };
  let mockToast: jasmine.SpyObj<ToastService>;

  const initialUser = {
    id: 'user-001',
    email: 'test@example.com',
    fullName: 'Nguyen Van A',
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    mockAuthService = {
      currentUser: signal(initialUser),
      loadCurrentUser: jasmine.createSpy('loadCurrentUser').and.returnValue(Promise.resolve()),
      logout: jasmine.createSpy('logout').and.returnValue(Promise.resolve()),
    };

    mockUserService = jasmine.createSpyObj<UserService>('UserService', [
      'updateMe',
      'uploadAvatar',
      'changePassword',
    ]);

    mockAppState = {
      appUser: signal({ name: 'Nguyen Van A', email: 'test@example.com', level: 'B1' }),
      totalXp: signal(1250),
      currentStreak: signal(5),
    };

    mockToast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        { provide: AppStateService, useValue: mockAppState },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders profile with user display name, email, and initials', () => {
    expect(component.displayName()).toBe('Nguyen Van A');
    expect(component.displayEmail()).toBe('test@example.com');
    expect(component.userInitial()).toBe('A');
    expect(component.avatarUrl()).toBeNull();
  });

  describe('Edit Profile Name', () => {
    it('enters edit mode and populates draftName', () => {
      expect(component.editing()).toBeFalse();
      component.startEdit();
      expect(component.editing()).toBeTrue();
      expect(component.draftName()).toBe('Nguyen Van A');
    });

    it('cancels edit mode', () => {
      component.startEdit();
      component.cancelEdit();
      expect(component.editing()).toBeFalse();
    });

    it('saves updated profile name and updates currentUser', () => {
      component.startEdit();
      component.draftName.set('Nguyen Van B');

      const updatedUser = { ...initialUser, fullName: 'Nguyen Van B' };
      mockUserService.updateMe.and.returnValue(of(updatedUser));

      component.saveProfile();

      expect(mockUserService.updateMe).toHaveBeenCalledWith({ fullName: 'Nguyen Van B' });
      expect(mockAuthService.currentUser()?.fullName).toBe('Nguyen Van B');
      expect(component.editing()).toBeFalse();
      expect(mockToast.success).toHaveBeenCalledWith('Hồ sơ đã được cập nhật thành công!');
    });

    it('handles save error from API', () => {
      component.startEdit();
      component.draftName.set('Nguyen Van B');
      mockUserService.updateMe.and.returnValue(throwError(() => ({ status: 400, error: { message: 'Invalid name' } })));

      component.saveProfile();

      expect(mockToast.error).toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });
  });

  describe('Upload Avatar', () => {
    it('rejects files larger than 2 MB', async () => {
      const largeBlob = new Blob(['x'.repeat(2.5 * 1024 * 1024)], { type: 'image/png' });
      const event = {
        target: {
          files: [largeBlob as File],
        },
      } as unknown as Event;

      await component.onFileSelected(event);

      expect(mockToast.error).toHaveBeenCalledWith('Ảnh đại diện không được vượt quá 2 MB.');
      expect(mockUserService.uploadAvatar).not.toHaveBeenCalled();
    });

    it('uploads valid image file and updates user avatar', async () => {
      const validFile = new File(['content'], 'avatar.png', { type: 'image/png' });
      const event = {
        target: {
          files: [validFile],
        },
      } as unknown as Event;

      mockUserService.uploadAvatar.and.returnValue(of({ avatarUrl: '/uploads/avatars/new.png' }));

      await component.onFileSelected(event);

      expect(mockUserService.uploadAvatar).toHaveBeenCalledWith(validFile);
      expect(mockToast.success).toHaveBeenCalledWith('Ảnh đại diện đã được cập nhật thành công!');
      expect(mockAuthService.loadCurrentUser).toHaveBeenCalled();
    });
  });

  describe('Change Password', () => {
    it('validates password length and complexity', () => {
      component.oldPassword = 'OldPass123!';
      component.newPassword.set('123');
      component.confirmNewPassword = '123';

      component.handleChangePassword();
      expect(mockToast.error).toHaveBeenCalledWith('Mật khẩu mới phải có ít nhất 6 ký tự.');

      component.newPassword.set('123456');
      component.confirmNewPassword = '123456';
      component.handleChangePassword();
      expect(mockToast.error).toHaveBeenCalledWith(
        'Mật khẩu quá đơn giản hoặc dễ đoán (như 123456, 111111...). Vui lòng chọn mật khẩu mạnh hơn.'
      );
    });

    it('rejects if new password is identical to old password', () => {
      component.oldPassword = 'SamePassword123!';
      component.newPassword.set('SamePassword123!');
      component.confirmNewPassword = 'SamePassword123!';

      component.handleChangePassword();
      expect(mockToast.error).toHaveBeenCalledWith('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
    });

    it('rejects if confirmation password does not match', () => {
      component.oldPassword = 'OldPassword123!';
      component.newPassword.set('NewPassword123!');
      component.confirmNewPassword = 'Different123!';

      component.handleChangePassword();
      expect(mockToast.error).toHaveBeenCalledWith('Mật khẩu xác nhận không khớp.');
    });

    it('successfully changes password and resets inputs', () => {
      component.oldPassword = 'OldPassword123!';
      component.newPassword.set('NewSecurePassword123!');
      component.confirmNewPassword = 'NewSecurePassword123!';

      mockUserService.changePassword.and.returnValue(of({ message: 'Success' }));

      component.handleChangePassword();

      expect(mockUserService.changePassword).toHaveBeenCalledWith({
        oldPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword123!',
      });
      expect(mockToast.success).toHaveBeenCalledWith('Mật khẩu đã được thay đổi thành công!');
      expect(component.oldPassword).toBe('');
      expect(component.newPassword()).toBe('');
      expect(component.confirmNewPassword).toBe('');
    });
  });

  it('triggers logout on button click', async () => {
    await component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });
});
