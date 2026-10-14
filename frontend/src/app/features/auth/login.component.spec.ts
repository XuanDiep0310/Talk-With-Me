/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { AppStateService } from '../../core/services/app-state.service';
import { ToastService } from '../../core/services/toast.service';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockAppState: jasmine.SpyObj<AppStateService>;
  let mockToast: jasmine.SpyObj<ToastService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj<AuthService>('AuthService', [
      'login',
      'forgotPassword',
      'loginWithGoogle',
    ]);
    mockAppState = jasmine.createSpyObj<AppStateService>('AppStateService', ['go']);
    mockToast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);
    mockRouter = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AppStateService, useValue: mockAppState },
        { provide: ToastService, useValue: mockToast },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders login heading and initial state correctly', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Đăng nhập');
    expect(component.forgotMode()).toBeFalse();
    expect(component.loading()).toBeFalse();
    expect(component.showPass()).toBeFalse();
  });

  it('navigates to register or landing via appState', () => {
    const el = fixture.nativeElement as HTMLElement;
    const registerBtn = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Đăng ký miễn phí'));
    registerBtn?.click();
    expect(mockAppState.go).toHaveBeenCalledWith('register');
  });

  it('toggles password visibility', () => {
    expect(component.showPass()).toBeFalse();
    component.toggleShowPass();
    expect(component.showPass()).toBeTrue();
    component.toggleShowPass();
    expect(component.showPass()).toBeFalse();
  });

  it('toggles remember me checkbox', () => {
    expect(component.rememberMe()).toBeFalse();
    component.toggleRememberMe();
    expect(component.rememberMe()).toBeTrue();
  });

  describe('Form validation on login', () => {
    it('shows toast error when email is invalid format', async () => {
      component.email.set('invalid-email');
      component.password.set('123456');

      await component.handleLogin();

      expect(mockToast.error).toHaveBeenCalledWith('Vui lòng nhập email hợp lệ và mật khẩu ít nhất 6 ký tự.');
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('shows toast error when password length < 6', async () => {
      component.email.set('test@example.com');
      component.password.set('12345');

      await component.handleLogin();

      expect(mockToast.error).toHaveBeenCalledWith('Vui lòng nhập email hợp lệ và mật khẩu ít nhất 6 ký tự.');
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('calls authService.login when credentials are valid and displays success toast', async () => {
      component.email.set('test@example.com');
      component.password.set('Password123!');
      component.rememberMe.set(true);
      mockAuthService.login.and.returnValue(Promise.resolve());

      await component.handleLogin();

      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
        rememberMe: true,
      });
      expect(mockToast.success).toHaveBeenCalledWith('Đăng nhập thành công!');
      expect(component.loading()).toBeFalse();
    });

    it('handles login failure and displays error toast and error signal', async () => {
      component.email.set('wrong@example.com');
      component.password.set('WrongPass123!');
      mockAuthService.login.and.returnValue(Promise.reject(new HttpErrorResponse({
        status: 400,
        error: { code: 'INVALID_CREDENTIALS' },
      })));

      await component.handleLogin();

      expect(mockToast.error).toHaveBeenCalled();
      expect(component.loading()).toBeFalse();
    });
  });

  describe('Forgot password mode', () => {
    beforeEach(() => {
      component.forgotMode.set(true);
      fixture.detectChanges();
    });

    it('renders forgot password title', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('h1')?.textContent).toContain('Quên mật khẩu');
    });

    it('shows error if email is empty when requesting reset link', async () => {
      component.email.set('');
      await component.handleForgot();
      expect(mockToast.error).toHaveBeenCalledWith('Vui lòng nhập email.');
      expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
    });

    it('calls authService.forgotPassword and marks forgotSent = true', async () => {
      component.email.set('test@example.com');
      mockAuthService.forgotPassword.and.returnValue(Promise.resolve());

      await component.handleForgot();

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(component.forgotSent()).toBeTrue();
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('resets forgot password state when returning to login', () => {
      component.forgotSent.set(true);
      component.resetForgotState();
      expect(component.forgotMode()).toBeFalse();
      expect(component.forgotSent()).toBeFalse();
    });
  });
});
