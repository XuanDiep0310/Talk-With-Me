import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

interface Feature {
  id: string;
  title: string;
  desc: string;
}

interface Testimonial {
  name: string;
  role: string;
  text: string;
  avatar: string;
  level: string;
}

interface Stat {
  val: string;
  label: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col bg-white">
      <!-- Top Nav -->
      <nav class="flex items-center justify-between px-6 sm:px-12 py-4 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-md z-30">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr from-blue-700 to-blue-500 text-white shadow-md shadow-blue-500/20">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <span class="font-extrabold text-xl tracking-tight text-slate-900">TalkWithMe</span>
        </div>
        <div class="flex items-center gap-3">
          <button class="btn-secondary text-sm px-4 py-2" (click)="appState.go('login')">Đăng nhập</button>
          <button class="btn-primary text-sm px-5 py-2" (click)="appState.go('register')">Bắt đầu miễn phí</button>
        </div>
      </nav>

      <!-- Hero Section -->
      <section
        class="relative overflow-hidden px-6 sm:px-12 pt-16 pb-24 text-center bg-gradient-to-b from-blue-50/70 via-indigo-50/30 to-white"
      >
        <div class="max-w-3xl mx-auto relative z-10">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold text-blue-700 bg-blue-100/70 border border-blue-200/60 mb-6 shadow-2xs">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Hơn 50.000 người học đang nói tiếng Anh tự tin hơn
          </div>
          <h1 class="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.15] mb-6">
            Nói tiếng Anh tự tin<br />
            <span class="bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">mỗi ngày chỉ 15 phút</span>
          </h1>
          <p class="text-base sm:text-lg text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            AI Coach Alex cá nhân hóa luyện phản xạ giao tiếp 1-1: không ngắt lời sửa lỗi liên tục, đo lường 5 chỉ số CEFR và tạo động lực mỗi ngày.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              class="btn-primary text-base px-8 py-3.5 rounded-xl shadow-lg shadow-blue-600/25 cursor-pointer w-full sm:w-auto"
              (click)="appState.go('register')"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
              <span>Bắt đầu nói ngay — Miễn phí</span>
            </button>
            <button
              class="btn-secondary text-base px-7 py-3.5 rounded-xl cursor-pointer w-full sm:w-auto"
              (click)="appState.go('login')"
            >
              Xem bản dùng thử
            </button>
          </div>
          <p class="text-xs text-slate-400 mt-4 font-medium">Không cần thẻ ngân hàng · Khởi đầu trong 2 phút</p>
        </div>

        <!-- Interactive AI Session Simulation Card -->
        <div class="mt-14 max-w-lg mx-auto card p-6 text-left shadow-xl shadow-blue-500/10 border border-slate-200/80 relative">
          <div class="flex items-center gap-3.5 mb-4 pb-3 border-b border-slate-100">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-xs">
              AI
            </div>
            <div>
              <div class="text-sm font-bold text-slate-900">Coach Alex</div>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span class="text-xs text-emerald-600 font-semibold">Đang trò chuyện</span>
              </div>
            </div>
            <div class="ml-auto text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
              02:34
            </div>
          </div>

          <div class="space-y-3">
            <div class="rounded-2xl p-4 text-sm bg-blue-50/80 border border-blue-100 text-slate-800">
              <span class="font-bold text-blue-700">Alex:</span> "Tell me about a memorable trip you've ever taken!"
              <div class="text-xs mt-1 text-slate-500">Hãy kể về một chuyến đi đáng nhớ mà bạn từng trải nghiệm!</div>
            </div>
            <div class="rounded-2xl p-4 text-sm bg-emerald-50/80 border border-emerald-100 text-slate-800">
              <span class="font-bold text-emerald-700">Bạn:</span> "I went to Da Nang last summer, the beach was breathtaking..."
              <div class="flex items-center gap-1.5 mt-2">
                @for (height of waveHeights; track $index) {
                  <div class="wave-bar bg-emerald-600" [style.height.px]="height"></div>
                }
                <span class="text-[11px] font-bold text-emerald-600 ml-2">Phát âm: 88%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Stats Bar -->
      <section class="px-6 py-10 bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
        <div class="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          @for (s of stats; track s.label) {
            <div>
              <div class="text-3xl sm:text-4xl font-black tracking-tight">{{ s.val }}</div>
              <div class="text-xs sm:text-sm text-blue-100 mt-1 font-medium">{{ s.label }}</div>
            </div>
          }
        </div>
      </section>

      <!-- Features (Lazy deferrable view) -->
      @defer (on viewport) {
        <section class="px-6 sm:px-12 py-20 bg-slate-50/60">
          <div class="max-w-5xl mx-auto">
            <div class="text-center max-w-2xl mx-auto mb-14">
              <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Học nói tiếng Anh theo cách tự nhiên nhất
              </h2>
              <p class="text-sm sm:text-base text-slate-500 mt-3">
                Triết lý Communication-First tập trung vào xây dựng phản xạ và sự tự tin, không làm nản lòng bằng việc ngắt lời sửa lỗi liên tục.
              </p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              @for (f of features; track f.title) {
                <div class="card p-6 flex gap-4 hover:border-blue-200 transition-colors">
                  <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    @switch (f.id) {
                      @case ('coach') {
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                      }
                      @case ('scenarios') {
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      }
                      @case ('gamification') {
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                          <circle cx="12" cy="8" r="6" />
                          <path d="M18 4H6v7a6 6 0 0 0 12 0V4z" />
                        </svg>
                      }
                      @case ('analytics') {
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      }
                    }
                  </div>
                  <div>
                    <div class="font-bold text-base text-slate-900 mb-1">{{ f.title }}</div>
                    <div class="text-sm text-slate-500 leading-relaxed">{{ f.desc }}</div>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      } @placeholder {
        <div class="py-16 text-center text-slate-400">Đang tải tính năng...</div>
      }

      <!-- Testimonials -->
      @defer (on viewport) {
        <section class="px-6 sm:px-12 py-20 bg-white">
          <div class="max-w-5xl mx-auto">
            <div class="text-center max-w-2xl mx-auto mb-14">
              <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Người học nói gì về TalkWithMe?</h2>
              <p class="text-sm sm:text-base text-slate-500 mt-2">Hàng chục ngàn học viên đã cải thiện độ lưu loát và tự tin nói tiếng Anh.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              @for (t of testimonials; track t.name) {
                <div class="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div class="flex items-center gap-3.5 mb-4">
                      <img [src]="t.avatar" [alt]="t.name" class="w-11 h-11 rounded-full object-cover ring-2 ring-blue-100" />
                      <div class="min-w-0">
                        <div class="font-bold text-sm text-slate-900 truncate">{{ t.name }}</div>
                        <div class="text-xs text-slate-400">{{ t.role }}</div>
                      </div>
                      <span class="ml-auto badge text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">{{ t.level }}</span>
                    </div>
                    <p class="text-sm leading-relaxed text-slate-600">"{{ t.text }}"</p>
                  </div>
                  <div class="flex gap-1 mt-4 text-amber-400">
                    @for (star of stars; track $index) {
                      <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      } @placeholder {
        <div class="py-16 text-center text-slate-400">Đang tải đánh giá...</div>
      }

      <!-- Bottom Call To Action -->
      <section class="px-6 py-20 text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-t border-slate-100">
        <div class="max-w-xl mx-auto">
          <h2 class="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Sẵn sàng nói tiếng Anh tự tin?</h2>
          <p class="text-sm sm:text-base text-slate-600 mb-8 leading-relaxed">Tham gia hoàn toàn miễn phí ngay hôm nay và bắt đầu hành trình phản xạ tiếng Anh thực thụ.</p>
          <button class="btn-primary text-base px-9 py-4 rounded-xl shadow-lg shadow-blue-600/20 cursor-pointer" (click)="appState.go('register')">
            Bắt đầu nói ngay hôm nay
          </button>
        </div>
      </section>

      <!-- Footer -->
      <footer class="px-6 py-8 text-center border-t border-slate-100 bg-white">
        <div class="flex items-center justify-center gap-2.5 mb-2">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-600 text-white shadow-xs">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </div>
          <span class="font-extrabold text-slate-800">TalkWithMe</span>
        </div>
        <p class="text-xs text-slate-400">© 2026 TalkWithMe. Học tiếng Anh — Nói thật tự nhiên.</p>
      </footer>
    </div>
  `
})
export class LandingComponent {
  readonly appState = inject(AppStateService);

  readonly waveHeights = [8, 18, 28, 16, 10];
  readonly stars = [1, 2, 3, 4, 5];

  readonly features: Feature[] = [
    { id: 'coach', title: 'AI Coach giọng nói 1-1', desc: 'Luyện nói trực tiếp bằng giọng nói, nhận phản xạ tức thì từ Coach Alex mà không bị ngắt lời.' },
    { id: 'scenarios', title: '20 tình huống thực tế', desc: 'Kịch bản đời thực từ công sở, đời sống, du lịch đến giao tiếp xã hội theo phương pháp Chunking.' },
    { id: 'gamification', title: 'Streak, XP & Huy hiệu', desc: 'Hệ thống gamification thúc đẩy bạn giữ vững kỷ luật 15 phút mỗi ngày.' },
    { id: 'analytics', title: 'Chẩn đoán 5 trụ cột CEFR', desc: 'Phân tích đa chiều: Độ trôi chảy, Vốn từ, Ngữ pháp, Phát âm và Tương tác phản xạ.' }
  ];

  readonly testimonials: Testimonial[] = [
    { name: 'Nguyễn Văn Tuấn', role: 'Kỹ sư phần mềm', text: 'Sau 2 tháng luyện với Coach Alex, mình đã tự tin trao đổi trôi chảy trong các cuộc họp quốc tế mà không còn e ngại.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&auto=format', level: 'B2' },
    { name: 'Trần Thị Hoa', role: 'Sinh viên năm 3', text: 'Live transcript trực tiếp giúp mình nhận ra ngay những chỗ ngập ngừng và cải thiện phát âm một cách rõ rệt.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&auto=format', level: 'A2→B1' },
    { name: 'Lê Minh Khoa', role: 'Chuyên viên đối ngoại', text: 'Chỉ 15 phút mỗi ngày, streak 30 ngày, điểm Fluency tăng từ 52 lên 82 điểm!', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&auto=format', level: 'B1' }
  ];

  readonly stats: Stat[] = [
    { val: '50.000+', label: 'Học viên tích cực' },
    { val: '92%', label: 'Tự tin hơn sau 30 ngày' },
    { val: '4.9 / 5.0', label: 'Mức độ hài lòng' }
  ];
}
