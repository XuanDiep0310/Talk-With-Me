import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { User } from '../../core/models/app.models';
import { MOCK_PROFILE_GOALS, MOCK_PROFILE_INTERESTS, MOCK_USER } from '../../core/data/mock-data';

type Phase = 'intro' | 'mic-check' | 'test' | 'result' | 'manual' | 'interests' | 'goals' | 'weaknesses';
type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
type RecordState = 'idle' | 'recording' | 'processing' | 'done';

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const WEAKNESSES = ['Phát âm', 'Tốc độ phản hồi', 'Ngữ pháp', 'Từ vựng', 'Nghe hiểu'];
const LEVEL_DETAILS: Record<Level, { title: string; description: string; emoji: string }> = {
  A1: { title: 'A1 — Mới bắt đầu', description: 'Biết một vài từ cơ bản, đang tập nói câu hoàn chỉnh.', emoji: '🌱' },
  A2: { title: 'A2 — Sơ cấp', description: 'Nói được câu đơn giản về các chủ đề quen thuộc.', emoji: '🌿' },
  B1: { title: 'B1 — Trung cấp', description: 'Giao tiếp được trong các tình huống thông thường.', emoji: '🌳' },
  B2: { title: 'B2 — Trung cao cấp', description: 'Nói khá lưu loát và giải thích được quan điểm.', emoji: '🚀' },
  C1: { title: 'C1 — Cao cấp', description: 'Giao tiếp tự nhiên trong môi trường chuyên nghiệp.', emoji: '⭐' }
};
const TEST_LEVEL: Level = 'B1';

@Component({
  selector: 'app-onboarding', standalone: true, imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-screen flex items-center justify-center p-6" style="background:#F0F6FB">
      <section class="w-full max-w-xl card p-8" style="box-shadow:0 12px 40px rgba(40,111,180,.08)">
        <header class="flex items-center gap-2 mb-7">
          <span class="w-9 h-9 rounded-xl flex items-center justify-center text-white" style="background:#286FB4">🎙️</span>
          <strong style="color:#286FB4">TalkWithMe</strong>
        </header>
        @if (phase() !== 'intro') {
          <div class="mb-6">
            <div class="flex justify-between text-xs mb-2" style="color:#64748b"><span>Bước {{ stepNumber() }} / 5</span><span>{{ stepLabel() }}</span></div>
            <div class="h-2 rounded-full" style="background:#E2F0F9"><div class="h-2 rounded-full transition-all" [style.width.%]="stepNumber() * 20" style="background:#286FB4"></div></div>
          </div>
        }
        @switch (phase()) {
          @case ('intro') {
            <div class="text-center py-3">
              <div class="text-5xl mb-4">🎯</div><h1 class="text-2xl font-800 mb-3">Bắt đầu hành trình tiếng Anh</h1>
              <p class="text-sm mb-8" style="color:#64748b">Kiểm tra nhanh thiết bị, chọn level và cho chúng tôi biết cách hỗ trợ bạn tốt nhất.</p>
              <div class="flex flex-col gap-3">
                <button class="btn-primary py-3.5 justify-center cursor-pointer" (click)="phase.set('mic-check')">🎙️ Voice Test để đánh giá level</button>
                <button class="btn-secondary py-3 justify-center cursor-pointer" (click)="phase.set('manual')">Tự chọn level</button>
              </div>
            </div>
          }
          @case ('mic-check') {
            <h1 class="text-2xl font-800 mb-2">Kiểm tra micro</h1><p class="text-sm mb-6" style="color:#64748b">Đây là bước mô phỏng, không cần cấp quyền hay kết nối micro thật.</p>
            <div class="rounded-2xl p-6 text-center mb-6" style="background:#E2F0F9"><div class="text-4xl mb-3">{{ micReady() ? '✅' : '🎙️' }}</div><strong>{{ micReady() ? 'Micro mô phỏng đã sẵn sàng' : 'Sẵn sàng kiểm tra' }}</strong><p class="text-sm mt-2" style="color:#64748b">{{ micReady() ? 'Bạn có thể bắt đầu bài đánh giá.' : 'Nhấn kiểm tra để tiếp tục.' }}</p></div>
            <div class="flex gap-3"><button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button><button class="btn-primary flex-1 justify-center cursor-pointer" (click)="checkMic()">{{ micReady() ? 'Bắt đầu Voice Test →' : 'Kiểm tra micro' }}</button></div>
          }
          @case ('test') {
            <h1 class="text-2xl font-800 mb-2">Voice Test mô phỏng</h1><p class="text-sm mb-5" style="color:#64748b">Hãy thử nói theo câu hỏi. Bài test không thu âm thật.</p>
            <div class="rounded-2xl p-5 mb-5" style="background:#E2F0F9"><div class="text-xs mb-2" style="color:#286FB4">CÂU HỎI</div><strong>Tell me about a memorable trip. What did you like about it?</strong><p class="text-sm mt-2" style="color:#64748b">Hãy kể về một chuyến đi đáng nhớ và điều bạn thích.</p></div>
            @if (recordState() === 'idle') { <button class="btn-primary w-full justify-center py-3 cursor-pointer" (click)="startTest()">🎙️ Bắt đầu test</button> }
            @if (recordState() === 'recording') { <div class="text-center py-4"><div class="text-4xl animate-pulse">🔴</div><p class="my-3">Đang kiểm tra câu trả lời mô phỏng…</p><button class="btn-secondary cursor-pointer" (click)="finishTest()">Hoàn tất câu trả lời</button></div> }
            @if (recordState() === 'processing') { <div class="text-center py-6"><span class="animate-pulse">Đang đánh giá câu trả lời…</span></div> }
            @if (recordState() === 'done') { <div class="p-4 rounded-xl mb-4" style="background:#f8fafc"><div class="text-xs mb-1" style="color:#64748b">Câu trả lời mẫu</div><p class="text-sm">“Last year I visited Da Nang with my family. We went to the beach and enjoyed the local food.”</p></div><button class="btn-primary w-full justify-center py-3 cursor-pointer" (click)="phase.set('result')">Xem kết quả →</button> }
            <button class="mt-4 text-sm cursor-pointer" style="color:#286FB4" (click)="back()">← Quay lại</button>
          }
          @case ('result') {
            <div class="text-center"><div class="text-5xl mb-3">🌳</div><h1 class="text-2xl font-800 mb-2">Level đề xuất: {{ assessedLevel() }}</h1><p class="text-sm mb-6" style="color:#64748b">Dựa trên kết quả mô phỏng, đây là điểm bắt đầu phù hợp. Bạn có thể đổi sang tự chọn level.</p>
              <button class="btn-primary w-full justify-center py-3 mb-3 cursor-pointer" (click)="chooseAssessedLevel()">Dùng level {{ assessedLevel() }} →</button><button class="btn-secondary w-full justify-center py-3 cursor-pointer" (click)="phase.set('manual')">Chọn level khác</button>
            </div>
          }
          @case ('manual') {
            <h1 class="text-2xl font-800 mb-2">Tự chọn level</h1><p class="text-sm mb-5" style="color:#64748b">Chọn mức phù hợp nhất với khả năng hiện tại.</p>
            <div class="space-y-2 mb-3">@for (level of levels; track level) { <button type="button" class="w-full p-4 rounded-xl border text-left flex gap-3 cursor-pointer" [attr.aria-pressed]="selectedLevel() === level" [style.borderColor]="selectedLevel() === level ? '#286FB4' : '#E2F0F9'" [style.background]="selectedLevel() === level ? '#E2F0F9' : '#fff'" (click)="selectedLevel.set(level)"><span class="text-2xl">{{ levelDetails[level].emoji }}</span><span><strong>{{ levelDetails[level].title }}</strong><span class="block text-xs mt-1" style="color:#64748b">{{ levelDetails[level].description }}</span></span><span class="ml-auto">{{ selectedLevel() === level ? '✓' : '' }}</span></button> }</div>
            @if (error()) { <p class="text-sm mb-3" style="color:#dc2626">{{ error() }}</p> }
            <div class="flex gap-3"><button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button><button class="btn-primary flex-1 justify-center cursor-pointer" (click)="continueFromLevel()">Tiếp tục →</button></div>
          }
          @case ('interests') {
            <h1 class="text-2xl font-800 mb-2">Bạn quan tâm chủ đề nào?</h1><p class="text-sm mb-5" style="color:#64748b">Chọn ít nhất một sở thích để cá nhân hóa bài học.</p>
            <div class="flex flex-wrap gap-2 mb-3">@for (item of interests; track item) { <button type="button" class="px-4 py-2 rounded-xl border text-sm cursor-pointer" [attr.aria-pressed]="selectedInterests().includes(item)" [style.background]="selectedInterests().includes(item) ? '#286FB4' : '#fff'" [style.color]="selectedInterests().includes(item) ? '#fff' : '#475569'" [style.borderColor]="selectedInterests().includes(item) ? '#286FB4' : '#E2F0F9'" (click)="toggle(selectedInterests, item)">{{ item }} {{ selectedInterests().includes(item) ? '✓' : '' }}</button> }</div>
            @if (error()) { <p class="text-sm mb-3" style="color:#dc2626">{{ error() }}</p> }<div class="flex gap-3"><button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button><button class="btn-primary flex-1 justify-center cursor-pointer" (click)="continueWithInterests()">Tiếp tục →</button></div>
          }
          @case ('goals') {
            <h1 class="text-2xl font-800 mb-2">Mục tiêu học tập</h1><p class="text-sm mb-5" style="color:#64748b">Chọn ít nhất một mục tiêu bạn muốn đạt được.</p>
            <div class="space-y-2 mb-3">@for (item of goals; track item) { <button type="button" class="w-full p-3.5 rounded-xl border text-left cursor-pointer" [attr.aria-pressed]="selectedGoals().includes(item)" [style.borderColor]="selectedGoals().includes(item) ? '#286FB4' : '#E2F0F9'" [style.background]="selectedGoals().includes(item) ? '#E2F0F9' : '#fff'" (click)="toggle(selectedGoals, item)">{{ item }} <span class="float-right">{{ selectedGoals().includes(item) ? '✓' : '' }}</span></button> }</div>
            @if (error()) { <p class="text-sm mb-3" style="color:#dc2626">{{ error() }}</p> }<div class="flex gap-3"><button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button><button class="btn-primary flex-1 justify-center cursor-pointer" (click)="continueWithGoals()">Tiếp tục →</button></div>
          }
          @case ('weaknesses') {
            <h1 class="text-2xl font-800 mb-2">Kỹ năng muốn cải thiện</h1><p class="text-sm mb-5" style="color:#64748b">Chọn ít nhất một điểm cần luyện tập để chúng tôi gợi ý bài học phù hợp.</p>
            <div class="space-y-2 mb-3">@for (item of weaknesses; track item) { <button type="button" class="w-full p-3.5 rounded-xl border text-left cursor-pointer" [attr.aria-pressed]="selectedWeaknesses().includes(item)" [style.borderColor]="selectedWeaknesses().includes(item) ? '#286FB4' : '#E2F0F9'" [style.background]="selectedWeaknesses().includes(item) ? '#E2F0F9' : '#fff'" (click)="toggle(selectedWeaknesses, item)">{{ item }} <span class="float-right">{{ selectedWeaknesses().includes(item) ? '✓' : '' }}</span></button> }</div>
            @if (error()) { <p class="text-sm mb-3" style="color:#dc2626">{{ error() }}</p> }<div class="flex gap-3"><button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button><button class="btn-primary flex-1 justify-center cursor-pointer" (click)="completeOnboarding()">Hoàn tất & đến Dashboard 🎉</button></div>
          }
        }
      </section>
    </main>`
})
export class OnboardingComponent {
  private readonly appState = inject(AppStateService);
  readonly phase = signal<Phase>('intro');
  readonly recordState = signal<RecordState>('idle');
  readonly micReady = signal(false);
  readonly selectedLevel = signal<Level | ''>('');
  readonly assessedLevel = signal<Level>(TEST_LEVEL);
  readonly selectedInterests = signal<string[]>([]);
  readonly selectedGoals = signal<string[]>([]);
  readonly selectedWeaknesses = signal<string[]>([]);
  readonly error = signal('');
  readonly levels = LEVELS;
  readonly levelDetails = LEVEL_DETAILS;
  readonly interests = MOCK_PROFILE_INTERESTS;
  readonly goals = MOCK_PROFILE_GOALS;
  readonly weaknesses = WEAKNESSES;
  readonly stepNumber = computed(() => ({ intro: 1, 'mic-check': 1, test: 1, result: 1, manual: 1, interests: 2, goals: 3, weaknesses: 4 } satisfies Record<Phase, number>)[this.phase()]);
  readonly stepLabel = computed(() => ({ intro: 'Bắt đầu', 'mic-check': 'Kiểm tra micro', test: 'Voice Test', result: 'Kết quả level', manual: 'Chọn level', interests: 'Sở thích', goals: 'Mục tiêu', weaknesses: 'Kỹ năng cần cải thiện' } satisfies Record<Phase, string>)[this.phase()]);

  constructor() {
    const user = this.appState.user() ?? MOCK_USER;
    if (LEVELS.includes(user.level as Level)) this.selectedLevel.set(user.level as Level);
    this.selectedInterests.set(user.interests.filter(item => this.interests.includes(item)));
    this.selectedGoals.set(user.goals.filter(item => this.goals.includes(item)));
    this.selectedWeaknesses.set(user.weaknesses.filter(item => this.weaknesses.includes(item)));
  }

  toggle(selection: ReturnType<typeof signal<string[]>>, item: string): void {
    selection.update(items => items.includes(item) ? items.filter(value => value !== item) : [...items, item]);
    this.error.set('');
  }

  checkMic(): void { if (this.micReady()) { this.phase.set('test'); return; } this.micReady.set(true); }
  startTest(): void { this.recordState.set('recording'); }
  finishTest(): void {
    this.recordState.set('processing');
    setTimeout(() => { this.assessedLevel.set(TEST_LEVEL); this.selectedLevel.set(TEST_LEVEL); this.recordState.set('done'); }, 900);
  }
  chooseAssessedLevel(): void { this.selectedLevel.set(this.assessedLevel()); this.phase.set('interests'); }
  continueFromLevel(): void {
    if (!this.selectedLevel()) { this.error.set('Vui lòng chọn một level để tiếp tục.'); return; }
    this.error.set(''); this.phase.set('interests');
  }
  continueWithInterests(): void {
    if (!this.selectedInterests().length) { this.error.set('Vui lòng chọn ít nhất một sở thích.'); return; }
    this.error.set(''); this.phase.set('goals');
  }
  continueWithGoals(): void {
    if (!this.selectedGoals().length) { this.error.set('Vui lòng chọn ít nhất một mục tiêu.'); return; }
    this.error.set(''); this.phase.set('weaknesses');
  }
  back(): void {
    this.error.set('');
    const previous: Record<Phase, Phase> = { intro: 'intro', 'mic-check': 'intro', test: 'mic-check', result: 'test', manual: 'intro', interests: this.micReady() ? 'result' : 'manual', goals: 'interests', weaknesses: 'goals' };
    this.phase.set(previous[this.phase()]);
  }
  completeOnboarding(): void {
    if (!this.selectedLevel()) { this.error.set('Vui lòng chọn level.'); return; }
    if (!this.selectedInterests().length) { this.phase.set('interests'); this.error.set('Vui lòng chọn ít nhất một sở thích.'); return; }
    if (!this.selectedGoals().length) { this.phase.set('goals'); this.error.set('Vui lòng chọn ít nhất một mục tiêu.'); return; }
    if (!this.selectedWeaknesses().length) { this.error.set('Vui lòng chọn ít nhất một kỹ năng cần cải thiện.'); return; }
    const current = this.appState.user() ?? MOCK_USER;
    const updatedUser: User = { ...current, level: this.selectedLevel(), interests: [...this.selectedInterests()], goals: [...this.selectedGoals()], weaknesses: [...this.selectedWeaknesses()] };
    this.appState.setUser(updatedUser);
    this.appState.go('dashboard');
  }
}
