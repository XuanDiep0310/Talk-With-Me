import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingService, OptionItem } from '../../core/services/onboarding.service';
import { AppStateService } from '../../core/services/app-state.service';
import { ToastService } from '../../core/services/toast.service';

type Phase = 'intro' | 'mic-check' | 'test' | 'result' | 'manual' | 'interests' | 'goals' | 'weaknesses';
type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
type RecordState = 'idle' | 'recording' | 'processing' | 'done';

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

const LEVEL_DETAILS: Record<Level, { title: string; description: string; emoji: string }> = {
  A1: { title: 'A1 — Mới bắt đầu', description: 'Biết một vài từ cơ bản, đang tập nói câu hoàn chỉnh.', emoji: '🌱' },
  A2: { title: 'A2 — Sơ cấp', description: 'Nói được câu đơn giản về các chủ đề quen thuộc.', emoji: '🌿' },
  B1: { title: 'B1 — Trung cấp', description: 'Giao tiếp được trong các tình huống thông thường.', emoji: '🌳' },
  B2: { title: 'B2 — Trung cao cấp', description: 'Nói khá lưu loát và giải thích được quan điểm.', emoji: '🚀' },
  C1: { title: 'C1 — Cao cấp', description: 'Giao tiếp tự nhiên trong môi trường chuyên nghiệp.', emoji: '⭐' }
};

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-screen flex items-center justify-center p-6" style="background:#F0F6FB">
      <section class="w-full max-w-xl card p-8" style="box-shadow:0 12px 40px rgba(40,111,180,.08)">
        <header class="flex items-center justify-between mb-7">
          <div class="flex items-center gap-2">
            <span class="w-9 h-9 rounded-xl flex items-center justify-center text-white" style="background:#286FB4">🎙️</span>
            <strong style="color:#286FB4">TalkWithMe</strong>
          </div>

          <!-- D-08 Mock Switch for Dev -->
          <label class="flex items-center gap-2 text-xs font-500 cursor-pointer" style="color:#64748b" title="D-08: Công tắc mock cho mic và Voice Test">
            <input type="checkbox" [checked]="useMock()" (change)="toggleMock()" class="rounded text-sky-600 focus:ring-0 cursor-pointer" />
            <span>Dev Mock Mode</span>
          </label>
        </header>

        <!-- Stepper (1 to 5) -->
        <div class="mb-6">
          <div class="flex justify-between text-xs mb-2" style="color:#64748b">
            <span>Bước {{ currentStep() }} / 5</span>
            <span class="font-600">{{ currentStepLabel() }}</span>
          </div>
          <div class="h-2 rounded-full" style="background:#E2F0F9">
            <div class="h-2 rounded-full transition-all duration-300" [style.width.%]="currentStep() * 20" style="background:#286FB4"></div>
          </div>
        </div>

        @switch (phase()) {
          @case ('intro') {
            <div class="text-center py-3">
              <div class="text-5xl mb-4">🎯</div>
              <h1 class="text-2xl font-800 mb-3" style="color:#1e293b">Bắt đầu hành trình tiếng Anh</h1>
              <p class="text-sm mb-8" style="color:#64748b">
                Làm bài kiểm tra giọng nói ngắn (Placement Test) để hệ thống tự động xác định trình độ, hoặc tự chọn Level phù hợp với bạn.
              </p>
              <div class="flex flex-col gap-3">
                <button class="btn-primary py-3.5 justify-center cursor-pointer" (click)="goToMicCheck()">
                  🎙️ Voice Test để xác định level
                </button>
                <button class="btn-secondary py-3 justify-center cursor-pointer" (click)="goToManualLevel()">
                  Bỏ qua, tôi tự chọn level
                </button>
              </div>
            </div>
          }

          @case ('mic-check') {
            <h1 class="text-2xl font-800 mb-2" style="color:#1e293b">Kiểm tra micro</h1>
            <p class="text-sm mb-6" style="color:#64748b">
              {{ useMock() ? 'Đang bật chế độ giả lập micro cho nhà phát triển.' : 'Kiểm tra tín hiệu microphone trên thiết bị của bạn.' }}
            </p>
            <div class="rounded-2xl p-6 text-center mb-6" style="background:#E2F0F9">
              <div class="text-4xl mb-3">{{ micReady() ? '✅' : '🎙️' }}</div>
              <strong style="color:#1e293b">{{ micReady() ? 'Micro đã sẵn sàng' : 'Sẵn sàng kiểm tra' }}</strong>
              <p class="text-sm mt-2" style="color:#64748b">
                {{ micReady() ? 'Thiết bị hoạt động tốt. Hãy sẵn sàng cho bài kiểm tra.' : 'Nhấn nút kiểm tra micro bên dưới để tiếp tục.' }}
              </p>
            </div>
            <div class="flex gap-3">
              <button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button>
              <button class="btn-primary flex-1 justify-center cursor-pointer" [disabled]="loading()" (click)="checkMic()">
                {{ micReady() ? (loading() ? 'Đang tạo bài test...' : 'Bắt đầu Voice Test →') : 'Kiểm tra micro' }}
              </button>
            </div>
          }

          @case ('test') {
            <div class="flex items-center justify-between mb-2">
              <h1 class="text-2xl font-800" style="color:#1e293b">Voice Test</h1>
              <span class="text-xs px-2.5 py-1 rounded-full font-600" style="background:#E2F0F9;color:#286FB4">
                Câu {{ currentQuestionIndex() + 1 }} / {{ testQuestions().length || 1 }}
              </span>
            </div>
            <p class="text-sm mb-5" style="color:#64748b">Lắng nghe hoặc đọc câu hỏi và nói câu trả lời của bạn.</p>

            <div class="rounded-2xl p-5 mb-5" style="background:#E2F0F9">
              <div class="text-xs mb-2 font-700" style="color:#286FB4">CÂU HỎI</div>
              <strong class="text-base" style="color:#1e293b">{{ currentQuestionText() }}</strong>
            </div>

            @if (recordState() === 'idle') {
              <button class="btn-primary w-full justify-center py-3.5 cursor-pointer text-base" (click)="startRecording()">
                🎙️ Nhấn để bắt đầu nói
              </button>
            }
            @if (recordState() === 'recording') {
              <div class="text-center py-5 border rounded-2xl mb-4" style="border-color:#fecdd3;background:#fff1f2">
                <div class="text-4xl animate-pulse mb-2">🔴</div>
                <p class="font-600 mb-1" style="color:#e11d48">Đang lắng nghe câu trả lời của bạn...</p>
                <p class="text-xs mb-4" style="color:#94a3b8">Nói rõ ràng và bấm nút hoàn tất khi xong.</p>
                <button class="btn-primary py-2.5 px-6 cursor-pointer" (click)="stopRecordingAndSubmit()">
                  Hoàn tất câu trả lời ⏹️
                </button>
              </div>
            }
            @if (recordState() === 'processing') {
              <div class="text-center py-8">
                <div class="inline-block animate-spin text-3xl mb-3">⚙️</div>
                <p class="font-600" style="color:#286FB4">Đang xử lý âm thanh & đánh giá câu trả lời...</p>
              </div>
            }
            @if (recordState() === 'done') {
              <div class="p-4 rounded-xl mb-4 border" style="background:#f8fafc;border-color:#e2e8f0">
                <div class="text-xs mb-1 font-600" style="color:#64748b">Transcript nhận dạng được:</div>
                <p class="text-sm italic" style="color:#1e293b">“{{ lastTranscript() }}”</p>
              </div>
              <button class="btn-primary w-full justify-center py-3.5 cursor-pointer text-base" [disabled]="loading()" (click)="nextQuestionOrFinish()">
                {{ loading() ? 'Đang hoàn tất...' : (hasMoreQuestions() ? 'Câu hỏi tiếp theo →' : 'Xem kết quả đánh giá →') }}
              </button>
            }

            <button class="mt-4 text-sm cursor-pointer block" style="color:#286FB4" (click)="back()">← Quay lại</button>
          }

          @case ('result') {
            <div class="text-center py-2">
              <div class="text-5xl mb-3">{{ levelDetails[assessedLevel()].emoji }}</div>
              <h1 class="text-2xl font-800 mb-2" style="color:#1e293b">Level đề xuất: {{ assessedLevel() }}</h1>
              <p class="text-sm mb-4" style="color:#64748b">
                {{ levelDetails[assessedLevel()].description }}
              </p>
              @if (isInsufficientData()) {
                <div class="p-3.5 rounded-xl mb-5 text-left text-xs" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a">
                  ⚠️ <strong>Dữ liệu chưa đủ:</strong> Bạn nói khá ngắn hoặc âm lượng nhỏ, hệ thống gán tạm mức A1 và gắn cờ cần đánh giá lại trong các buổi luyện sau.
                </div>
              }
              <div class="space-y-3">
                <button class="btn-primary w-full justify-center py-3.5 cursor-pointer text-base" [disabled]="loading()" (click)="chooseAssessedLevel()">
                  {{ loading() ? 'Đang lưu...' : 'Dùng level đề xuất (' + assessedLevel() + ') →' }}
                </button>
                <button class="btn-secondary w-full justify-center py-3 cursor-pointer" (click)="phase.set('manual')">
                  Tự chọn level khác
                </button>
              </div>
            </div>
          }

          @case ('manual') {
            <h1 class="text-2xl font-800 mb-2" style="color:#1e293b">Tự chọn level</h1>
            <p class="text-sm mb-5" style="color:#64748b">Chọn mức độ phù hợp nhất với sự tự tin của bạn hiện tại.</p>
            <div class="space-y-2.5 mb-5">
              @for (lvl of levels; track lvl) {
                <button
                  type="button"
                  class="w-full p-4 rounded-xl border text-left flex items-center gap-3 cursor-pointer transition-all"
                  [attr.aria-pressed]="selectedLevel() === lvl"
                  [style.borderColor]="selectedLevel() === lvl ? '#286FB4' : '#E2F0F9'"
                  [style.background]="selectedLevel() === lvl ? '#E2F0F9' : '#fff'"
                  (click)="selectedLevel.set(lvl)"
                >
                  <span class="text-2xl">{{ levelDetails[lvl].emoji }}</span>
                  <span class="flex-1">
                    <strong style="color:#1e293b">{{ levelDetails[lvl].title }}</strong>
                    <span class="block text-xs mt-0.5" style="color:#64748b">{{ levelDetails[lvl].description }}</span>
                  </span>
                  <span class="font-800 text-sky-600 text-lg">{{ selectedLevel() === lvl ? '✓' : '' }}</span>
                </button>
              }
            </div>
            @if (error()) { <p class="text-sm mb-3" style="color:#dc2626">{{ error() }}</p> }
            <div class="flex gap-3">
              <button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button>
              <button class="btn-primary flex-1 justify-center cursor-pointer" [disabled]="loading()" (click)="saveManualLevel()">
                {{ loading() ? 'Đang lưu...' : 'Tiếp tục →' }}
              </button>
            </div>
          }

          @case ('interests') {
            <h1 class="text-2xl font-800 mb-2" style="color:#1e293b">Bạn quan tâm chủ đề nào?</h1>
            <p class="text-sm mb-5" style="color:#64748b">Chọn ít nhất một sở thích để gợi ý bài học phù hợp.</p>
            <div class="flex flex-wrap gap-2.5 mb-5">
              @for (item of interestOptions(); track item.key) {
                <button
                  type="button"
                  class="px-4 py-2.5 rounded-xl border text-sm font-500 cursor-pointer transition-all"
                  [attr.aria-pressed]="selectedInterests().includes(item.key)"
                  [style.background]="selectedInterests().includes(item.key) ? '#286FB4' : '#fff'"
                  [style.color]="selectedInterests().includes(item.key) ? '#fff' : '#475569'"
                  [style.borderColor]="selectedInterests().includes(item.key) ? '#286FB4' : '#E2F0F9'"
                  (click)="toggleSelection(selectedInterests, item.key)"
                >
                  {{ item.label }} {{ selectedInterests().includes(item.key) ? '✓' : '' }}
                </button>
              }
            </div>
            @if (error()) { <p class="text-sm mb-3" style="color:#dc2626">{{ error() }}</p> }
            <div class="flex gap-3">
              <button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button>
              <button class="btn-primary flex-1 justify-center cursor-pointer" (click)="continueWithInterests()">Tiếp tục →</button>
            </div>
          }

          @case ('goals') {
            <h1 class="text-2xl font-800 mb-2" style="color:#1e293b">Mục tiêu học tập</h1>
            <p class="text-sm mb-5" style="color:#64748b">Chọn ít nhất một mục tiêu bạn muốn đạt được.</p>
            <div class="space-y-2.5 mb-5">
              @for (item of goalOptions(); track item.key) {
                <button
                  type="button"
                  class="w-full p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between"
                  [attr.aria-pressed]="selectedGoals().includes(item.key)"
                  [style.borderColor]="selectedGoals().includes(item.key) ? '#286FB4' : '#E2F0F9'"
                  [style.background]="selectedGoals().includes(item.key) ? '#E2F0F9' : '#fff'"
                  (click)="toggleSelection(selectedGoals, item.key)"
                >
                  <span class="font-500" style="color:#1e293b">{{ item.label }}</span>
                  <span class="font-800 text-sky-600">{{ selectedGoals().includes(item.key) ? '✓' : '' }}</span>
                </button>
              }
            </div>
            @if (error()) { <p class="text-sm mb-3" style="color:#dc2626">{{ error() }}</p> }
            <div class="flex gap-3">
              <button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button>
              <button class="btn-primary flex-1 justify-center cursor-pointer" (click)="continueWithGoals()">Tiếp tục →</button>
            </div>
          }

          @case ('weaknesses') {
            <h1 class="text-2xl font-800 mb-2" style="color:#1e293b">Kỹ năng muốn cải thiện</h1>
            <p class="text-sm mb-5" style="color:#64748b">Chọn ít nhất một kỹ năng cần luyện tập thêm.</p>
            <div class="space-y-2.5 mb-5">
              @for (item of weakPointOptions(); track item.key) {
                <button
                  type="button"
                  class="w-full p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between"
                  [attr.aria-pressed]="selectedWeakPoints().includes(item.key)"
                  [style.borderColor]="selectedWeakPoints().includes(item.key) ? '#286FB4' : '#E2F0F9'"
                  [style.background]="selectedWeakPoints().includes(item.key) ? '#E2F0F9' : '#fff'"
                  (click)="toggleSelection(selectedWeakPoints, item.key)"
                >
                  <span class="font-500" style="color:#1e293b">{{ item.label }}</span>
                  <span class="font-800 text-sky-600">{{ selectedWeakPoints().includes(item.key) ? '✓' : '' }}</span>
                </button>
              }
            </div>
            @if (error()) { <p class="text-sm mb-3" style="color:#dc2626">{{ error() }}</p> }
            <div class="flex gap-3">
              <button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="back()">Quay lại</button>
              <button class="btn-primary flex-1 justify-center cursor-pointer" [disabled]="loading()" (click)="submitAllAndComplete()">
                {{ loading() ? 'Đang hoàn tất...' : 'Hoàn tất & Vào Dashboard 🎉' }}
              </button>
            </div>
          }
        }
      </section>
    </main>
  `
})
export class OnboardingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly appState = inject(AppStateService);
  private readonly toast = inject(ToastService);
  private assessmentTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly phase = signal<Phase>('intro');
  readonly recordState = signal<RecordState>('idle');
  readonly micReady = signal(false);
  readonly useMock = signal(true); // D-08: mock mode switch
  readonly loading = signal(false);
  readonly error = signal('');

  // Catalog options from API
  readonly interestOptions = signal<OptionItem[]>([]);
  readonly goalOptions = signal<OptionItem[]>([]);
  readonly weakPointOptions = signal<OptionItem[]>([]);
  readonly testQuestions = signal<string[]>([]);

  // User selections
  readonly selectedLevel = signal<Level | ''>('');
  readonly assessedLevel = signal<Level>('B1');
  readonly isInsufficientData = signal(false);
  readonly selectedInterests = signal<string[]>([]);
  readonly selectedGoals = signal<string[]>([]);
  readonly selectedWeakPoints = signal<string[]>([]);

  // Test state
  readonly placementTestId = signal<string | null>(null);
  readonly currentQuestionIndex = signal(0);
  readonly lastTranscript = signal('');

  readonly levels = LEVELS;
  readonly levelDetails = LEVEL_DETAILS;

  // Stepper logic: unified 5 steps
  readonly currentStep = computed(() => {
    switch (this.phase()) {
      case 'intro':
      case 'mic-check':
        return 1;
      case 'test':
      case 'result':
      case 'manual':
        return 2;
      case 'interests':
        return 3;
      case 'goals':
        return 4;
      case 'weaknesses':
        return 5;
    }
  });

  readonly currentStepLabel = computed(() => {
    switch (this.phase()) {
      case 'intro':
        return 'Bắt đầu';
      case 'mic-check':
        return 'Kiểm tra micro';
      case 'test':
        return 'Voice Test';
      case 'result':
        return 'Kết quả level';
      case 'manual':
        return 'Chọn level';
      case 'interests':
        return 'Sở thích';
      case 'goals':
        return 'Mục tiêu';
      case 'weaknesses':
        return 'Kỹ năng cải thiện';
    }
  });

  readonly currentQuestionText = computed(() => {
    const list = this.testQuestions();
    const idx = this.currentQuestionIndex();
    return list[idx] || 'Tell me about a memorable trip. What did you like about it?';
  });

  readonly hasMoreQuestions = computed(() => {
    const total = this.testQuestions().length;
    return this.currentQuestionIndex() < (total > 0 ? total - 1 : 0);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.assessmentTimeout) {
        clearTimeout(this.assessmentTimeout);
      }
    });
  }

  ngOnInit(): void {
    this.loadCatalogOptions();
  }

  toggleMock(): void {
    this.useMock.update(val => !val);
  }

  loadCatalogOptions(): void {
    this.onboardingService.getOptions().subscribe({
      next: (opts) => {
        this.interestOptions.set(opts.interests);
        this.goalOptions.set(opts.goals);
        this.weakPointOptions.set(opts.weakPoints);
        this.testQuestions.set(opts.placementQuestions);
      },
      error: () => {
        // Fallback default catalog if server temporarily unreachable
        this.interestOptions.set([
          { key: 'travel', label: 'Du lịch' },
          { key: 'technology', label: 'Công nghệ' },
          { key: 'food', label: 'Ẩm thực' },
          { key: 'business', label: 'Kinh doanh' },
          { key: 'sports', label: 'Thể thao' },
          { key: 'music', label: 'Âm nhạc' },
          { key: 'movies_tv', label: 'Phim & TV' },
          { key: 'science', label: 'Khoa học' },
        ]);
        this.goalOptions.set([
          { key: 'daily_conversation', label: 'Giao tiếp hằng ngày tự nhiên' },
          { key: 'work_presentation', label: 'Thuyết trình công việc' },
          { key: 'job_interview', label: 'Phỏng vấn xin việc' },
          { key: 'study_abroad', label: 'Học tập ở nước ngoài' },
          { key: 'travel_solo', label: 'Du lịch tự túc' },
        ]);
        this.weakPointOptions.set([
          { key: 'pronunciation', label: 'Phát âm' },
          { key: 'response_speed', label: 'Tốc độ phản hồi' },
          { key: 'grammar', label: 'Ngữ pháp' },
          { key: 'vocabulary', label: 'Từ vựng' },
          { key: 'listening', label: 'Nghe hiểu' },
        ]);
      }
    });
  }

  toggleSelection(selection: ReturnType<typeof signal<string[]>>, key: string): void {
    selection.update(items => items.includes(key) ? items.filter(v => v !== key) : [...items, key]);
    this.error.set('');
  }

  goToMicCheck(): void {
    this.phase.set('mic-check');
  }

  goToManualLevel(): void {
    this.phase.set('manual');
  }

  checkMic(): void {
    if (this.micReady()) {
      // Start test session on server
      this.initPlacementTest();
      return;
    }

    if (this.useMock()) {
      this.micReady.set(true);
      this.toast.info('Micro đã sẵn sàng (chế độ mô phỏng).');
    } else {
      // Real mic permission request
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            this.micReady.set(true);
            stream.getTracks().forEach(t => t.stop());
            this.toast.success('Micro thật đã được cấp quyền!');
          })
          .catch(() => {
            this.micReady.set(false);
            this.toast.error('Không thể truy cập microphone. Vui lòng cấp quyền hoặc bật chế độ Mock.');
          });
      } else {
        this.micReady.set(true);
      }
    }
  }

  initPlacementTest(): void {
    this.loading.set(true);
    this.onboardingService.createPlacementTest().subscribe({
      next: (resp) => {
        this.loading.set(false);
        this.placementTestId.set(resp.id);
        if (resp.questions?.length) {
          this.testQuestions.set(resp.questions);
        }
        this.currentQuestionIndex.set(0);
        this.recordState.set('idle');
        this.phase.set('test');
      },
      error: () => {
        this.loading.set(false);
        // Fallback for offline dev
        this.placementTestId.set('mock-test-id');
        this.currentQuestionIndex.set(0);
        this.recordState.set('idle');
        this.phase.set('test');
      }
    });
  }

  startRecording(): void {
    this.recordState.set('recording');
  }

  stopRecordingAndSubmit(): void {
    this.recordState.set('processing');

    const testId = this.placementTestId();
    const qIndex = this.currentQuestionIndex();
    const clientUuid = crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${qIndex}`;

    const sampleTranscript = 'I really enjoy traveling because it gives me a chance to experience different cultures and taste amazing local food.';

    if (testId && testId !== 'mock-test-id') {
      this.onboardingService.submitAnswer(testId, {
        requestId: clientUuid,
        questionIndex: qIndex,
        transcript: sampleTranscript,
        sttConfidence: 0.92,
        speakingDurationSeconds: 12.5,
        responseLatencySeconds: 1.8,
      }).subscribe({
        next: (ans) => {
          this.lastTranscript.set(ans.transcript || sampleTranscript);
          this.recordState.set('done');
        },
        error: () => {
          this.lastTranscript.set(sampleTranscript);
          this.recordState.set('done');
        }
      });
    } else {
      this.assessmentTimeout = setTimeout(() => {
        this.lastTranscript.set(sampleTranscript);
        this.recordState.set('done');
        this.assessmentTimeout = null;
      }, 700);
    }
  }

  nextQuestionOrFinish(): void {
    if (this.hasMoreQuestions()) {
      this.currentQuestionIndex.update(i => i + 1);
      this.recordState.set('idle');
    } else {
      this.finishPlacementTest();
    }
  }

  finishPlacementTest(): void {
    const testId = this.placementTestId();
    if (!testId || testId === 'mock-test-id') {
      this.assessedLevel.set('B1');
      this.selectedLevel.set('B1');
      this.phase.set('result');
      return;
    }

    this.loading.set(true);
    this.onboardingService.completePlacementTest(testId).subscribe({
      next: (res) => {
        this.loading.set(false);
        const lvl = (LEVELS.includes(res.estimatedLevel as Level) ? res.estimatedLevel : 'B1') as Level;
        this.assessedLevel.set(lvl);
        this.selectedLevel.set(lvl);
        this.isInsufficientData.set(res.isInsufficientData);
        this.phase.set('result');
      },
      error: () => {
        this.loading.set(false);
        this.assessedLevel.set('B1');
        this.selectedLevel.set('B1');
        this.phase.set('result');
      }
    });
  }

  chooseAssessedLevel(): void {
    this.loading.set(true);
    this.onboardingService.setLevel({
      level: this.assessedLevel(),
      source: 'PLACEMENT'
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.selectedLevel.set(this.assessedLevel());
        this.phase.set('interests');
      },
      error: () => {
        this.loading.set(false);
        this.selectedLevel.set(this.assessedLevel());
        this.phase.set('interests');
      }
    });
  }

  saveManualLevel(): void {
    const lvl = this.selectedLevel();
    if (!lvl) {
      this.error.set('Vui lòng chọn một level để tiếp tục.');
      return;
    }
    this.error.set('');
    this.loading.set(true);

    this.onboardingService.setLevel({
      level: lvl,
      source: 'SELF'
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.phase.set('interests');
      },
      error: () => {
        this.loading.set(false);
        this.phase.set('interests');
      }
    });
  }

  continueWithInterests(): void {
    if (!this.selectedInterests().length) {
      this.error.set('Vui lòng chọn ít nhất một sở thích.');
      return;
    }
    this.error.set('');
    this.phase.set('goals');
  }

  continueWithGoals(): void {
    if (!this.selectedGoals().length) {
      this.error.set('Vui lòng chọn ít nhất một mục tiêu.');
      return;
    }
    this.error.set('');
    this.phase.set('weaknesses');
  }

  submitAllAndComplete(): void {
    if (!this.selectedWeakPoints().length) {
      this.error.set('Vui lòng chọn ít nhất một kỹ năng cần cải thiện.');
      return;
    }
    this.error.set('');
    this.loading.set(true);

    // 1. Save preferences
    this.onboardingService.updatePreferences({
      interests: this.selectedInterests(),
      goals: this.selectedGoals(),
      weakPoints: this.selectedWeakPoints(),
    }).subscribe({
      next: () => {
        // 2. Complete onboarding
        this.onboardingService.completeOnboarding().subscribe({
          next: () => {
            this.loading.set(false);
            this.toast.success('Chào mừng bạn đến với TalkWithMe!');
            // Reload user state
            this.authService.loadCurrentUser().then(() => {
              void this.router.navigateByUrl('/dashboard');
            });
          },
          error: (err) => {
            this.loading.set(false);
            this.toast.error(err?.error?.message || 'Không thể hoàn tất onboarding. Vui lòng thử lại.');
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message || 'Không thể lưu tùy chọn.');
      }
    });
  }

  back(): void {
    this.error.set('');
    const prevMap: Record<Phase, Phase> = {
      intro: 'intro',
      'mic-check': 'intro',
      test: 'mic-check',
      result: 'test',
      manual: 'intro',
      interests: this.placementTestId() ? 'result' : 'manual',
      goals: 'interests',
      weaknesses: 'goals'
    };
    this.phase.set(prevMap[this.phase()]);
  }
}
