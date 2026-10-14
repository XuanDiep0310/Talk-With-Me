/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../core/services/auth.service';
import { AppStateService } from '../../core/services/app-state.service';
import { ToastService } from '../../core/services/toast.service';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockAppState: jasmine.SpyObj<AppStateService>;
  let mockToast: jasmine.SpyObj<ToastService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', [
      'register',
      'loginWithGoogle',
    ]);
    mockAppState = jasmine.createSpyObj<AppStateService>('AppStateService', ['go']);
    mockToast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    mockRouter = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AppStateService, useValue: mockAppState },
        { provide: ToastService, useValue: mockToast },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders register title and default state', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Tạo tài khoản');
    expect(component.name()).toBe('');
    expect(component.email()).toBe('');
    expect(component.password()).toBe('');
    expect(component.agree()).toBeFalse();
    expect(component.valid()).toBeFalse();
  });

  describe('Password strength & weak password checks', () => {
    it('detects common weak passwords', () => {
      component.password.set('123456');
      expect(component.isWeakPassword()).toBeTrue();
      expect(component.passwordStrengthText()).toBe('Quá yếu (dễ đoán)');

      component.password.set('password');
      expect(component.isWeakPassword()).toBeTrue();

      component.password.set('111111');
      expect(component.isWeakPassword()).toBeTrue();

      component.password.set('StrongPass99!');
      expect(component.isWeakPassword()).toBeFalse();
    });

    it('calculates password strength levels according to length', () => {
      component.password.set('');
      expect(component.passwordStrengthText()).toBe('Nhập mật khẩu');

      component.password.set('abc');
      expect(component.passwordStrengthText()).toBe('Quá ngắn');

      component.password.set('abc123x');
      expect(component.passwordStrengthText()).toBe('Trung bình');

      component.password.set('abc123xyz8');
      expect(component.passwordStrengthText()).toBe('Mạnh');

      component.password.set('VeryStrongPassword2026!');
      expect(component.passwordStrengthText()).toBe('Rất mạnh');
    });

    it('returns correct passwordBars indicators', () => {
      component.password.set('');
      expect(component.passwordBars().length).toBe(4);

      component.password.set('StrongPass99!');
      const bars = component.passwordBars();
      expect(bars.length).toBe(4);
      expect(bars[0].color).not.toBe('#E2F0F9');
    });
  });

  describe('Form validity and submission', () => {
    it('validates required fields, email format, and terms acceptance', () => {
      // 1. All empty -> invalid
      expect(component.valid()).toBeFalse();

      // 2. Name too short
      component.name.set('A');
      component.email.set('test@example.com');
      component.password.set('Password123!');
      component.agree.set(true);
      expect(component.valid()).toBeFalse();

      // 3. Email invalid
      component.name.set('Nguyen Van A');
      component.email.set('invalid-email-format');
      expect(component.valid()).toBeFalse();

      // 4. Password too weak
      component.email.set('test@example.com');
      component.password.set('123456');
      expect(component.valid()).toBeFalse();

      // 5. Terms not accepted
      component.password.set('StrongPass123!');
      component.agree.set(false);
      expect(component.valid()).toBeFalse();

      // 6. All valid
      component.agree.set(true);
      expect(component.valid()).toBeTrue();
    });

    it('does not call authService.register if invalid on handleRegister', async () => {
      await component.handleRegister();
      expect(component.submitted()).toBeTrue();
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('submits registration successfully when form is valid', async () => {
      component.name.set('Nguyen Van A');
      component.email.set('test@example.com');
      component.password.set('Password123!');
      component.agree.set(true);
      mockAuthService.register.and.returnValue(Promise.resolve());

      await component.handleRegister();

      expect(mockAuthService.register).toHaveBeenCalledWith({
        fullName: 'Nguyen Van A',
        email: 'test@example.com',
        password: 'Password123!',
        termsAccepted: true,
      });
      expect(mockToast.success).toHaveBeenCalledWith('Đăng ký tài khoản thành công!');
      expect(component.loading()).toBeFalse();
    });

    it('handles register error from API', async () => {
      component.name.set('Nguyen Van A');
      component.email.set('existing@example.com');
      component.password.set('Password123!');
      component.agree.set(true);
      mockAuthService.register.and.returnValue(Promise.reject(new HttpErrorResponse({
        status: 400,
        error: { code: 'EMAIL_ALREADY_EXISTS' },
      })));

      await component.handleRegister();

      expect(mockToast.error).toHaveBeenCalled();
      expect(component.apiError()).toBe('Email này đã có tài khoản.');
      expect(component.loading()).toBeFalse();
    });
  });

  it('toggles password visibility and terms agreement', () => {
    expect(component.showPass()).toBeFalse();
    component.toggleShowPass();
    expect(component.showPass()).toBeTrue();

    expect(component.agree()).toBeFalse();
    component.toggleAgree();
    expect(component.agree()).toBeTrue();
  });
});
