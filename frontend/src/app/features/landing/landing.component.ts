import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

interface Feature {
  icon: string;
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
    <div class="min-h-screen flex flex-col" style="background: #fff">
      <!-- Top Nav -->
      <nav class="flex items-center justify-between px-6 py-4 border-b" style="border-color: #E2F0F9">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: #286FB4">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <span class="font-800 text-lg" style="color: #286FB4; font-weight: 800">TalkWithMe</span>
        </div>
        <div class="flex items-center gap-3">
          <button class="btn-secondary" (click)="appState.go('login')">Đăng nhập</button>
          <button class="btn-primary" (click)="appState.go('register')">Bắt đầu miễn phí</button>
        </div>
      </nav>

      <!-- Hero Section -->
      <section
        class="relative overflow-hidden px-6 py-20 text-center"
        style="background: linear-gradient(135deg, #E2F0F9 0%, #fff 60%)"
      >
        <div class="max-w-3xl mx-auto">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-600 mb-6" style="background: #E2F0F9; color: #286FB4; font-weight: 600">
            🎉 Hơn 50.000 người học đang nói tiếng Anh tự tin hơn
          </div>
          <h1 class="text-4xl md:text-5xl font-800 leading-tight mb-6" style="color: #1e293b; font-weight: 800">
            Nói tiếng Anh tự tin<br />
            <span style="color: #286FB4">mỗi ngày chỉ 15 phút</span>
          </h1>
          <p class="text-lg mb-10" style="color: #475569">
            AI Coach cá nhân hóa luyện kỹ năng giao tiếp thực tế — phân tích phát âm, tốc độ, từ vựng và phản hồi tức thì.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              class="btn-primary text-base px-8 py-4"
              style="border-radius: 14px; font-size: 16px"
              (click)="appState.go('register')"
            >
              🎙️ Bắt đầu nói ngay — Miễn phí
            </button>
            <button
              class="btn-secondary text-base px-8 py-4"
              style="border-radius: 14px; font-size: 16px"
              (click)="appState.go('login')"
            >
              Xem demo
            </button>
          </div>
          <p class="text-sm mt-4" style="color: #94a3b8">Không cần thẻ ngân hàng · Bắt đầu trong 2 phút</p>
        </div>

        <!-- Interactive AI Session Preview Card -->
        <div class="mt-16 max-w-md mx-auto card p-5 text-left" style="box-shadow: 0 8px 32px rgba(40,111,180,0.12)">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: #286FB4">
              <span class="text-white font-700" style="font-weight: 700">AI</span>
            </div>
            <div>
              <div class="text-sm font-600" style="font-weight: 600; color: #1e293b">AI Coach</div>
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full inline-block" style="background: #22c55e"></span>
                <span class="text-xs" style="color: #22c55e">Đang hoạt động</span>
              </div>
            </div>
            <div class="ml-auto text-sm font-700" style="color: #286FB4; font-weight: 700">02:34</div>
          </div>
          <div class="rounded-xl p-3 mb-3 text-sm" style="background: #E2F0F9; color: #286FB4">
            <span class="font-600" style="font-weight: 600">AI:</span> "Tell me about a place you'd love to visit someday."
            <div class="text-xs mt-1" style="color: #64748b">Hãy kể về một nơi bạn muốn đến thăm.</div>
          </div>
          <div class="rounded-xl p-3 text-sm" style="background: #F0FDF4; color: #166534">
            <span class="font-600" style="font-weight: 600">Bạn:</span> "I would love to visit Japan because..."
            <div class="flex items-center gap-1 mt-1">
              @for (height of waveHeights; track $index) {
                <div class="wave-bar" [style.height.px]="height"></div>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- Features (Lazy deferrable view) -->
      @defer (on viewport) {
        <section class="px-6 py-16" style="background: #F8FAFC">
          <div class="max-w-4xl mx-auto">
            <h2 class="text-3xl font-800 text-center mb-12" style="color: #1e293b; font-weight: 800">
              Tại sao chọn TalkWithMe?
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              @for (f of features; track f.title) {
                <div class="card p-6 flex gap-4">
                  <div class="text-3xl">{{ f.icon }}</div>
                  <div>
                    <div class="font-700 mb-1" style="color: #1e293b; font-weight: 700">{{ f.title }}</div>
                    <div class="text-sm" style="color: #64748b">{{ f.desc }}</div>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      } @placeholder {
        <div class="py-16 text-center text-slate-400">Loading features...</div>
      }

      <!-- Stats counter -->
      <section class="px-6 py-12" style="background: #286FB4">
        <div class="max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center text-white">
          @for (s of stats; track s.label) {
            <div>
              <div class="text-3xl font-800" style="font-weight: 800">{{ s.val }}</div>
              <div class="text-sm opacity-80 mt-1">{{ s.label }}</div>
            </div>
          }
        </div>
      </section>

      <!-- Testimonials -->
      @defer (on viewport) {
        <section class="px-6 py-16">
          <div class="max-w-4xl mx-auto">
            <h2 class="text-3xl font-800 text-center mb-12" style="color: #1e293b; font-weight: 800">Người học nói gì?</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              @for (t of testimonials; track t.name) {
                <div class="card p-6">
                  <div class="flex items-center gap-3 mb-4">
                    <img [src]="t.avatar" [alt]="t.name" class="w-11 h-11 rounded-full object-cover" />
                    <div>
                      <div class="font-600 text-sm" style="font-weight: 600; color: #1e293b">{{ t.name }}</div>
                      <div class="text-xs" style="color: #64748b">{{ t.role }}</div>
                    </div>
                    <span class="ml-auto badge" style="background: #E2F0F9; color: #286FB4">{{ t.level }}</span>
                  </div>
                  <p class="text-sm leading-relaxed" style="color: #475569">"{{ t.text }}"</p>
                  <div class="flex gap-1 mt-3">
                    @for (star of stars; track $index) {
                      <span style="color: #f59e0b; font-size: 14px">★</span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      } @placeholder {
        <div class="py-16 text-center text-slate-400">Loading reviews...</div>
      }

      <!-- Bottom Call To Action -->
      <section class="px-6 py-16 text-center" style="background: #E2F0F9">
        <div class="max-w-xl mx-auto">
          <h2 class="text-3xl font-800 mb-4" style="color: #1e293b; font-weight: 800">Sẵn sàng nói tiếng Anh tự tin?</h2>
          <p class="mb-8" style="color: #475569">Tham gia miễn phí ngay hôm nay và bắt đầu hành trình giao tiếp thực sự.</p>
          <button class="btn-primary text-base px-10 py-4" style="border-radius: 14px; font-size: 16px" (click)="appState.go('register')">
            🎙️ Bắt đầu nói ngay
          </button>
        </div>
      </section>

      <!-- Footer -->
      <footer class="px-6 py-8 text-center border-t" style="border-color: #E2F0F9">
        <div class="flex items-center justify-center gap-2 mb-3">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #286FB4">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <span class="font-700" style="color: #286FB4; font-weight: 700">TalkWithMe</span>
        </div>
        <p class="text-sm" style="color: #94a3b8">© 2025 TalkWithMe. Học tiếng Anh — Nói thật tự nhiên.</p>
      </footer>
    </div>
  `
})
export class LandingComponent {
  readonly appState = inject(AppStateService);

  readonly waveHeights = [8, 18, 28, 16, 10];
  readonly stars = [1, 2, 3, 4, 5];

  readonly features: Feature[] = [
    { icon: "🎙️", title: "AI Coach giọng nói", desc: "Luyện nói trực tiếp với AI, nhận phản hồi tức thì về phát âm và ngữ pháp." },
    { icon: "🎭", title: "Tình huống thực tế", desc: "Hàng trăm kịch bản từ đời sống, công việc đến du lịch." },
    { icon: "👥", title: "Phòng cộng đồng", desc: "Luyện nói cùng người học khác trong phòng voice 3–5 người." },
    { icon: "📊", title: "Phân tích chi tiết", desc: "Theo dõi 5 chỉ số kỹ năng: Fluency, Listening, Vocabulary, Tốc độ và Phát âm." }
  ];

  readonly testimonials: Testimonial[] = [
    { name: "Nguyễn Văn Tuấn", role: "Kỹ sư phần mềm", text: "Sau 2 tháng dùng TalkWithMe, mình tự tin họp với khách hàng nước ngoài rồi!", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&auto=format", level: "B2" },
    { name: "Trần Thị Hoa", role: "Sinh viên đại học", text: "Live Transcript giúp mình nhìn lại từng câu mình nói, tiến bộ rõ rệt.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&auto=format", level: "A2→B1" },
    { name: "Lê Minh Khoa", role: "Nhân viên kinh doanh", text: "Chỉ 15 phút mỗi ngày, streak 30 ngày, điểm Fluency tăng từ 52 lên 78!", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&auto=format", level: "B1" }
  ];

  readonly stats: Stat[] = [
    { val: "50K+", label: "Người học" },
    { val: "92%", label: "Cải thiện sau 30 ngày" },
    { val: "4.9★", label: "Đánh giá" }
  ];
}
