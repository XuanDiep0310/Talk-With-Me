import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-slide-in"
          [ngClass]="{
            'bg-emerald-50/95 border-emerald-200 text-emerald-950 shadow-emerald-500/10': toast.type === 'success',
            'bg-rose-50/95 border-rose-200 text-rose-950 shadow-rose-500/10': toast.type === 'error',
            'bg-sky-50/95 border-sky-200 text-sky-950 shadow-sky-500/10': toast.type === 'info'
          }"
        >
          <!-- Icon -->
          <div class="shrink-0 mt-0.5">
            @if (toast.type === 'success') {
              <div class="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                ✓
              </div>
            } @else if (toast.type === 'error') {
              <div class="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                ✕
              </div>
            } @else {
              <div class="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                ℹ
              </div>
            }
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold tracking-wide uppercase opacity-70 mb-0.5">
              @if (toast.type === 'success') {
                Thành công
              } @else if (toast.type === 'error') {
                Thông báo lỗi
              } @else {
                Thông tin
              }
            </div>
            <div class="text-sm font-500 leading-snug break-words">
              {{ toast.message }}
            </div>
          </div>

          <!-- Dismiss button -->
          <button
            type="button"
            class="shrink-0 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-1 -mr-1 -mt-1 rounded-lg"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Đóng"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-12px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    .animate-slide-in {
      animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
