import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

export interface FaqItem {
  q: string;
  a: string;
}

export interface QuickGuide {
  emoji: string;
  title: string;
  steps: string[];
}

export const FAQS: FaqItem[] = [
  {
    q: "AI Coach hoạt động như thế nào?",
    a: "AI Coach sử dụng công nghệ nhận diện giọng nói và xử lý ngôn ngữ tự nhiên để luyện tập cùng bạn theo thời gian thực. Sau mỗi buổi, AI phân tích và đưa ra báo cáo chi tiết về 5 kỹ năng."
  },
  {
    q: "Tôi cần thiết bị gì để sử dụng?",
    a: "Bạn cần micro (micro laptop, tai nghe có mic, hoặc micro rời) và kết nối internet ổn định. Trình duyệt Chrome hoặc Edge cho kết quả tốt nhất."
  },
  {
    q: "Tại sao micro của tôi không hoạt động?",
    a: "1) Kiểm tra quyền truy cập micro trong cài đặt trình duyệt. 2) Vào biểu tượng ổ khóa trên thanh địa chỉ → chọn Allow microphone. 3) Thử tải lại trang."
  },
  {
    q: "Điểm giao tiếp được tính như thế nào?",
    a: "Điểm giao tiếp tổng hợp là trung bình cộng của 5 chỉ số: Fluency (nói trơn tru), Listening (nghe hiểu), Vocabulary (từ vựng), Tốc độ P.H (phản hồi nhanh) và Phát âm."
  },
  {
    q: "Streak là gì và tại sao quan trọng?",
    a: "Streak là chuỗi ngày học liên tiếp. Mỗi ngày học ít nhất 1 buổi là streak được tính. Streak giúp hình thành thói quen và bạn nhận thêm XP bonus."
  }
];

export const QUICK_GUIDES: QuickGuide[] = [
  { emoji: "🎙️", title: "Bắt đầu buổi AI Coach", steps: ["Vào trang AI Coach", "Chọn chủ đề phù hợp", "Nhấn 'Bắt đầu nói'", "Cho phép quyền micro", "Luyện nói tự nhiên!"] },
  { emoji: "🎭", title: "Luyện tình huống Roleplay", steps: ["Vào Thư viện tình huống", "Chọn tình huống phù hợp trình độ", "Đọc bối cảnh và mẫu câu", "Nhấn 'Bắt đầu roleplay'", "Hoàn thành các nhiệm vụ"] },
  { emoji: "👥", title: "Tham gia phòng cộng đồng", steps: ["Vào Phòng cộng đồng", "Lọc theo level và chủ đề", "Nhấn 'Tham gia' phòng phù hợp", "Cho phép quyền micro", "Lắng nghe và tham gia trò chuyện!"] }
];

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">Trợ giúp & Hỗ trợ</h1>
        <p class="text-sm mt-1" style="color: #64748b">Tìm câu trả lời nhanh hoặc liên hệ đội ngũ hỗ trợ.</p>
      </div>

      <!-- Quick search header -->
      <div class="card p-6 text-center" style="background: linear-gradient(135deg, #E2F0F9, #fff)">
        <div class="text-4xl mb-3">🔍</div>
        <h2 class="font-700 mb-3" style="font-weight: 700; color: #1e293b">Bạn cần giúp gì?</h2>
        <input class="input-field max-w-md mx-auto" placeholder="VD: Micro không hoạt động, cách tính điểm..." />
      </div>

      <!-- Quick Guides -->
      <div>
        <h2 class="font-700 text-base mb-4" style="font-weight: 700; color: #1e293b">📖 Hướng dẫn nhanh</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          @for (g of quickGuides; track g.title; let i = $index) {
            <div>
              <button
                class="card p-5 w-full text-left hover:shadow-md transition-shadow cursor-pointer"
                (click)="toggleGuide(i)"
              >
                <div class="text-3xl mb-3">{{ g.emoji }}</div>
                <div class="font-700 text-sm mb-1" style="font-weight: 700; color: #1e293b">{{ g.title }}</div>
                <div class="text-xs" style="color: #94a3b8">Nhấn để xem hướng dẫn →</div>
              </button>
              @if (openGuide() === i) {
                <div class="card p-4 mt-2" style="background: #E2F0F9">
                  <ol class="space-y-2">
                    @for (step of g.steps; track step; let j = $index) {
                      <li class="flex items-center gap-2 text-sm" style="color: #374151">
                        <span class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-700 shrink-0" style="background: #286FB4; color: #fff; font-weight: 700">{{ j + 1 }}</span>
                        {{ step }}
                      </li>
                    }
                  </ol>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- FAQ Section (Deferrable) -->
      @defer (on viewport) {
        <div>
          <h2 class="font-700 text-base mb-4" style="font-weight: 700; color: #1e293b">❓ Câu hỏi thường gặp</h2>
          <div class="space-y-2">
            @for (faq of faqs; track faq.q; let i = $index) {
              <div class="card overflow-hidden">
                <button
                  class="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                  (click)="toggleFaq(i)"
                >
                  <span class="font-600 text-sm pr-4" style="font-weight: 600; color: #1e293b">{{ faq.q }}</span>
                  <svg class="shrink-0 transition-transform" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2" [style.transform]="openFaq() === i ? 'rotate(180deg)' : 'none'">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                @if (openFaq() === i) {
                  <div class="px-5 pb-5 pt-0 text-sm border-t" style="color: #374151; border-color: #E2F0F9">
                    <div class="pt-4">{{ faq.a }}</div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      } @placeholder {
        <div class="card p-6 text-center text-slate-400">Loading FAQs...</div>
      }
    </div>
  `
})
export class HelpComponent {
  readonly appState = inject(AppStateService);

  readonly openFaq = signal<number | null>(null);
  readonly openGuide = signal<number | null>(null);

  readonly faqs = FAQS;
  readonly quickGuides = QUICK_GUIDES;

  toggleFaq(index: number): void {
    this.openFaq.update(cur => cur === index ? null : index);
  }

  toggleGuide(index: number): void {
    this.openGuide.update(cur => cur === index ? null : index);
  }
}
