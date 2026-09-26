import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { AppUser } from '../../core/models/app.models';

export type Phase = "intro" | "mic-check" | "test" | "result" | "manual" | "interests" | "goals" | "weaknesses";
export type RecordState = "idle" | "countdown" | "recording" | "processing" | "done";

export interface TestPrompt {
  id: number;
  level: string;
  aiSays: string;
  aiVietnamese: string;
  tip: string;
  duration: number;
  mockTranscript: string;
  mockFeedback: { fluency: number; note: string };
}

export const PROMPTS: TestPrompt[] = [
  {
    id: 1, level: "A1",
    aiSays: "Hi! What is your name and where are you from?",
    aiVietnamese: "Xin chào! Tên bạn là gì và bạn đến từ đâu?",
    tip: "Hãy trả lời đơn giản: \"My name is... I am from...\"",
    duration: 20,
    mockTranscript: "My name is Minh. I am from Vietnam, from Hanoi.",
    mockFeedback: { fluency: 65, note: "Câu ngắn, rõ ràng — tốt cho A1!" }
  },
  {
    id: 2, level: "A2",
    aiSays: "Can you tell me about your daily routine? What do you do every morning?",
    aiVietnamese: "Bạn có thể kể về lịch trình hằng ngày? Buổi sáng bạn thường làm gì?",
    tip: "Dùng thì hiện tại đơn: \"I wake up... I eat... I go to...\"",
    duration: 30,
    mockTranscript: "Every morning I wake up at six o'clock. I eat breakfast and then I go to work by motorbike.",
    mockFeedback: { fluency: 68, note: "Biết dùng thì hiện tại đơn — trình độ A2!" }
  },
  {
    id: 3, level: "B1",
    aiSays: "Tell me about a memorable trip or place you have visited. What did you like about it?",
    aiVietnamese: "Hãy kể về một chuyến đi hoặc địa điểm đáng nhớ. Bạn thích gì ở nơi đó?",
    tip: "Kể theo trình tự: đi đâu, làm gì, cảm nhận. Dùng quá khứ đơn.",
    duration: 40,
    mockTranscript: "Last year I visited Da Nang with my family. We went to the beach every day and the food was amazing. I especially loved the seafood there. It was really a wonderful experience.",
    mockFeedback: { fluency: 72, note: "Nói được câu phức — rõ ràng trình độ B1!" }
  },
  {
    id: 4, level: "B2",
    aiSays: "Do you think technology has made people more or less connected to each other? Why?",
    aiVietnamese: "Bạn có nghĩ công nghệ khiến mọi người kết nối nhiều hơn hay ít hơn? Tại sao?",
    tip: "Đưa ra quan điểm và lý do: \"I think... because... For example...\"",
    duration: 45,
    mockTranscript: "I think technology has made people more connected in some ways, but less connected personally. We can communicate instantly across the world, however, face-to-face interactions have decreased significantly. For example, many families now sit together but look at their phones.",
    mockFeedback: { fluency: 78, note: "Lập luận rõ ràng, từ nối tốt — B2!" }
  },
  {
    id: 5, level: "C1",
    aiSays: "Some argue that artificial intelligence will fundamentally change the nature of work. What's your perspective on this, and how do you think society should respond?",
    aiVietnamese: "Nhiều người cho rằng AI sẽ thay đổi căn bản bản chất của công việc. Quan điểm của bạn và xã hội nên phản ứng thế nào?",
    tip: "Trình bày nhiều góc nhìn, dùng từ học thuật và kết cấu rõ ràng.",
    duration: 60,
    mockTranscript: "This is undoubtedly one of the most profound questions of our era. While AI will inevitably automate routine tasks, I believe it will simultaneously create new categories of work that we haven't yet imagined. Society should respond by investing heavily in reskilling programs and reimagining our educational systems to prioritize creativity, critical thinking, and emotional intelligence — capabilities that remain distinctly human.",
    mockFeedback: { fluency: 85, note: "Từ vựng phong phú, lập luận sâu sắc — C1!" }
  }
];

export const LEVEL_LABELS: Record<string, { label: string; desc: string; emoji: string; color: string }> = {
  A1: { label: "A1 — Mới bắt đầu", desc: "Biết một vài từ cơ bản, chưa nói được câu hoàn chỉnh.", emoji: "🌱", color: "#22c55e" },
  A2: { label: "A2 — Sơ cấp", desc: "Nói được câu đơn giản về bản thân, gia đình, mua sắm.", emoji: "🌿", color: "#84cc16" },
  B1: { label: "B1 — Trung cấp", desc: "Giao tiếp được trong các tình huống thông thường.", emoji: "🌳", color: "#f59e0b" },
  B2: { label: "B2 — Trung cao cấp", desc: "Nói tương đối lưu loát, hiểu phim/podcast không phụ đề.", emoji: "🚀", color: "#f97316" },
  C1: { label: "C1 — Cao cấp", desc: "Giao tiếp tự nhiên, hiệu quả trong môi trường chuyên nghiệp.", emoji: "⭐", color: "#DF4C73" },
};

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center p-6" style="background: #F0F6FB">
      <div class="w-full max-w-xl card p-8 relative" style="box-shadow: 0 12px 40px rgba(40,111,180,0.08)">
        
        <!-- Header logo -->
        <div class="flex items-center gap-2 mb-8">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: #286FB4">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2.5">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <span class="font-800 text-lg" style="color: #286FB4; font-weight: 800">TalkWithMe</span>
        </div>

        @switch (phase()) {
          @case ("intro") {
            <div class="text-center py-4">
              <div class="text-5xl mb-4">🎯</div>
              <h1 class="text-2xl font-800 mb-3" style="font-weight: 800; color: #1e293b">Đánh giá trình độ tiếng Anh của bạn</h1>
              <p class="text-sm mb-8" style="color: #64748b">
                Bài kiểm tra ngắn 3–5 câu hỏi giúp AI Coach hiểu rõ khả năng nói của bạn để xây dựng lộ trình học phù hợp nhất.
              </p>

              <div class="space-y-3 mb-8 text-left max-w-md mx-auto">
                <div class="flex items-center gap-3 p-3 rounded-xl" style="background: #E2F0F9">
                  <span class="text-xl">🎙️</span>
                  <span class="text-sm font-500" style="color: #286FB4; font-weight: 500">Nói trực tiếp micro (hoặc nhập văn bản)</span>
                </div>
                <div class="flex items-center gap-3 p-3 rounded-xl" style="background: #E2F0F9">
                  <span class="text-xl">⚡</span>
                  <span class="text-sm font-500" style="color: #286FB4; font-weight: 500">Nhận kết quả level A1 – C1 ngay tức thì</span>
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <button class="btn-primary py-3.5 text-base justify-center cursor-pointer" (click)="phase.set('test')">
                  🎙️ Bắt đầu bài test phát âm
                </button>
                <button class="btn-secondary py-3 text-sm justify-center cursor-pointer" (click)="phase.set('manual')">
                  Tôi muốn tự chọn level
                </button>
              </div>
            </div>
          }

          @case ("test") {
            <div>
              <div class="flex items-center justify-between mb-6">
                <span class="text-xs font-700 uppercase tracking-wider" style="color: #286FB4; font-weight: 700">
                  Câu {{ promptIdx() + 1 }} / {{ prompts.length }} · Level {{ currentPrompt().level }}
                </span>
                <span class="badge" style="background: #E2F0F9; color: #286FB4">Level Test</span>
              </div>

              <div class="rounded-2xl p-4 mb-6" style="background: #E2F0F9">
                <div class="font-600 text-base mb-1" style="color: #286FB4; font-weight: 600">
                  🤖 {{ currentPrompt().aiSays }}
                </div>
                <div class="text-xs" style="color: #64748b">{{ currentPrompt().aiVietnamese }}</div>
              </div>

              <div class="text-xs p-3 rounded-xl mb-6" style="background: #FFF5E5; color: #b45309">
                💡 {{ currentPrompt().tip }}
              </div>

              @if (recordState() === 'idle') {
                <div class="text-center py-6">
                  <button class="btn-primary px-8 py-4 text-base rounded-2xl cursor-pointer" (click)="startSimulatedRecord()">
                    🎙️ Nhấn để bắt đầu trả lời
                  </button>
                </div>
              }

              @if (recordState() === 'recording') {
                <div class="text-center py-6">
                  <div class="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center mx-auto mb-3 animate-pulse">
                    🎙️
                  </div>
                  <div class="text-sm font-600 text-rose-600 mb-2">Đang ghi âm...</div>
                  <button class="btn-secondary text-xs cursor-pointer" (click)="finishPromptRecording()">Hoàn thành câu trả lời</button>
                </div>
              }

              @if (recordState() === 'done') {
                <div class="space-y-4">
                  <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div class="text-xs font-600 text-slate-500 mb-1">Văn bản đã nhận diện:</div>
                    <div class="text-sm italic text-slate-800">"{{ currentPrompt().mockTranscript }}"</div>
                  </div>
                  <button class="btn-primary w-full justify-center py-3 cursor-pointer" (click)="nextPrompt()">
                    {{ promptIdx() < prompts.length - 1 ? "Câu tiếp theo →" : "Xem kết quả Level →" }}
                  </button>
                </div>
              }
            </div>
          }

          @case ("manual") {
            <div>
              <h2 class="text-xl font-800 mb-2" style="font-weight: 800; color: #1e293b">Tự chọn trình độ của bạn</h2>
              <p class="text-sm mb-6" style="color: #64748b">Chọn mức độ phù hợp nhất với khả năng giao tiếp hiện tại của bạn.</p>

              <div class="space-y-3 mb-6">
                @for (item of levelList; track item.key) {
                  <button
                    class="w-full p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer"
                    [style.borderColor]="selectedManualLevel() === item.key ? '#286FB4' : '#E2F0F9'"
                    [style.background]="selectedManualLevel() === item.key ? '#E2F0F9' : '#fff'"
                    (click)="selectedManualLevel.set(item.key)"
                  >
                    <span class="text-2xl">{{ item.value.emoji }}</span>
                    <div>
                      <div class="font-700 text-sm" style="color: #1e293b; font-weight: 700">{{ item.value.label }}</div>
                      <div class="text-xs mt-0.5" style="color: #64748b">{{ item.value.desc }}</div>
                    </div>
                  </button>
                }
              </div>

              <button class="btn-primary w-full justify-center py-3 cursor-pointer" (click)="phase.set('interests')">
                Tiếp tục (Chọn sở thích) →
              </button>
            </div>
          }

          @case ("interests") {
            <div>
              <h2 class="text-xl font-800 mb-2" style="font-weight: 800; color: #1e293b">Sở thích của bạn là gì?</h2>
              <p class="text-sm mb-6" style="color: #64748b">AI Coach sẽ tạo các bài học theo đúng chủ đề bạn quan tâm.</p>

              <div class="flex flex-wrap gap-2.5 mb-8">
                @for (item of allInterests; track item) {
                  <button
                    class="px-4 py-2 rounded-xl text-sm font-500 border transition-all cursor-pointer"
                    [style.background]="isInterestSelected(item) ? '#286FB4' : '#fff'"
                    [style.color]="isInterestSelected(item) ? '#fff' : '#475569'"
                    [style.borderColor]="isInterestSelected(item) ? '#286FB4' : '#E2F0F9'"
                    (click)="toggleInterest(item)"
                  >
                    {{ item }}
                  </button>
                }
              </div>

              <button class="btn-primary w-full justify-center py-3 cursor-pointer" (click)="phase.set('goals')">
                Tiếp tục (Mục tiêu học tập) →
              </button>
            </div>
          }

          @case ("goals") {
            <div>
              <h2 class="text-xl font-800 mb-2" style="font-weight: 800; color: #1e293b">Mục tiêu học tập chính</h2>
              <p class="text-sm mb-6" style="color: #64748b">Bạn muốn đạt được điều gì nhất khi sử dụng TalkWithMe?</p>

              <div class="space-y-2.5 mb-8">
                @for (g of allGoals; track g) {
                  <button
                    class="w-full p-3.5 rounded-xl border text-left text-sm font-500 flex items-center justify-between cursor-pointer"
                    [style.borderColor]="isGoalSelected(g) ? '#286FB4' : '#E2F0F9'"
                    [style.background]="isGoalSelected(g) ? '#E2F0F9' : '#fff'"
                    (click)="toggleGoal(g)"
                  >
                    <span>{{ g }}</span>
                    @if (isGoalSelected(g)) { <span class="text-sky-600 font-bold">✓</span> }
                  </button>
                }
              </div>

              <button class="btn-primary w-full justify-center py-3 cursor-pointer" (click)="completeOnboarding()">
                Hoàn tất & Đến Dashboard 🎉
              </button>
            </div>
          }
        }

      </div>
    </div>
  `
})
export class OnboardingComponent {
  readonly appState = inject(AppStateService);

  readonly phase = signal<Phase>("intro");
  readonly promptIdx = signal(0);
  readonly recordState = signal<RecordState>("idle");
  readonly selectedManualLevel = signal("B1");
  readonly selectedInterests = signal<string[]>(["Du lịch", "Công nghệ"]);
  readonly selectedGoals = signal<string[]>(["Giao tiếp hằng ngày tự nhiên"]);

  readonly prompts = PROMPTS;
  readonly levelLabels = LEVEL_LABELS;
  readonly allInterests = ["Du lịch", "Công nghệ", "Ẩm thực", "Kinh doanh", "Thể thao", "Âm nhạc", "Phim & TV", "Khoa học"];
  readonly allGoals = ["Giao tiếp hằng ngày tự nhiên", "Thuyết trình công việc", "Phỏng vấn xin việc", "Học tập ở nước ngoài", "Du lịch tự túc"];

  readonly levelList = Object.entries(LEVEL_LABELS).map(([key, value]) => ({ key, value }));

  readonly currentPrompt = computed(() => this.prompts[this.promptIdx()]);

  isInterestSelected(item: string): boolean {
    return this.selectedInterests().includes(item);
  }

  toggleInterest(item: string): void {
    this.selectedInterests.update(list =>
      list.includes(item) ? list.filter(i => i !== item) : [...list, item]
    );
  }

  isGoalSelected(item: string): boolean {
    return this.selectedGoals().includes(item);
  }

  toggleGoal(item: string): void {
    this.selectedGoals.update(list =>
      list.includes(item) ? list.filter(i => i !== item) : [...list, item]
    );
  }

  startSimulatedRecord(): void {
    this.recordState.set("recording");
  }

  finishPromptRecording(): void {
    this.recordState.set("done");
  }

  nextPrompt(): void {
    if (this.promptIdx() < this.prompts.length - 1) {
      this.promptIdx.update(i => i + 1);
      this.recordState.set("idle");
    } else {
      this.phase.set("interests");
    }
  }

  completeOnboarding(): void {
    const finalUser: AppUser = {
      name: "Minh Anh",
      email: "minhanh@gmail.com",
      level: this.selectedManualLevel(),
      xp: 3420,
      streak: 1,
      avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=80&h=80&fit=crop&auto=format",
      interests: this.selectedInterests(),
      goals: this.selectedGoals(),
      weaknesses: ["Phát âm", "Tốc độ phản hồi"]
    };
    this.appState.login(finalUser);
  }
}
