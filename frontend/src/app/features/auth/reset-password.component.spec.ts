/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockToast: jasmine.SpyObj<ToastService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const createComponentWithToken = async (token: string | null) => {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', ['resetPassword']);
    mockToast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    mockRouter = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    const mockActivatedRoute = {
      snapshot: {
        queryParamMap: convertToParamMap(token ? { token } : {}),
      },
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToast },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('When token is missing in URL', () => {
    beforeEach(async () => {
      await createComponentWithToken(null);
    });

    it('shows token missing warning and prevents password reset', () => {
      expect(component.tokenMissing()).toBeTrue();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Liên kết không hợp lệ');
    });

    it('navigates to login on button click', () => {
      component.goToLogin();
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/login');
    });
  });

  describe('When token is present in URL', () => {
    beforeEach(async () => {
      await createComponentWithToken('valid-reset-token-123');
    });

    it('displays password reset form', () => {
      expect(component.tokenMissing()).toBeFalse();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('h1')?.textContent).toContain('Đặt lại mật khẩu');
    });

    it('toggles password visibility', () => {
      expect(component.showNewPass()).toBeFalse();
      component.toggleShowNewPass();
      expect(component.showNewPass()).toBeTrue();

      expect(component.showConfirmPass()).toBeFalse();
      component.toggleShowConfirmPass();
      expect(component.showConfirmPass()).toBeTrue();
    });

    it('validates password length < 6', async () => {
      component.newPassword.set('123');
      component.confirmPassword.set('123');

      await component.handleReset();

      expect(mockToast.error).toHaveBeenCalledWith('Mật khẩu cần ít nhất 6 ký tự.');
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('validates weak password pattern', async () => {
      component.newPassword.set('123456');
      component.confirmPassword.set('123456');

      await component.handleReset();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Mật khẩu quá đơn giản hoặc dễ đoán (như 123456). Vui lòng chọn mật khẩu mạnh hơn.'
      );
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('validates password confirmation mismatch', async () => {
      component.newPassword.set('StrongPass123!');
      component.confirmPassword.set('DifferentPass123!');

      await component.handleReset();

      expect(mockToast.error).toHaveBeenCalledWith('Mật khẩu xác nhận không khớp.');
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('successfully resets password and shows success screen', async () => {
      component.newPassword.set('SecurePassword123!');
      component.confirmPassword.set('SecurePassword123!');
      mockAuthService.resetPassword.and.returnValue(Promise.resolve());

      await component.handleReset();

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('valid-reset-token-123', 'SecurePassword123!');
      expect(component.success()).toBeTrue();
      expect(mockToast.success).toHaveBeenCalledWith('Đặt lại mật khẩu thành công!');
    });

    it('handles reset password server error', async () => {
      component.newPassword.set('SecurePassword123!');
      component.confirmPassword.set('SecurePassword123!');
      mockAuthService.resetPassword.and.returnValue(Promise.reject({
        status: 400,
        error: { code: 'INVALID_TOKEN', message: 'Token không hợp lệ hoặc đã hết hạn.' },
      }));

      await component.handleReset();

      expect(mockToast.error).toHaveBeenCalled();
      expect(component.success()).toBeFalse();
    });
  });
});
