import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import {
  CoachVoiceService,
  LiveTranscriptItem,
} from '../../core/services/coach-voice.service';
import { CoachService } from '../../core/services/coach.service';
import {
  ScenarioService,
  ScenarioDetail,
} from '../../core/services/scenario.service';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';

@Component({
  selector: 'app-scenario-roleplay',
  standalone: true,
  imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      tabindex="-1"
      class="fixed inset-0 flex flex-col z-50 select-none bg-slate-50 text-slate-800"
    >
      <!-- Top Studio Header -->
      <header
        class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 shrink-0 bg-white border-b border-slate-200/80 shadow-xs"
      >
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Quay lại"
            class="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer border-0"
            (click)="showEndModal.set(true)"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="min-w-0">
            <h1 class="font-extrabold text-base sm:text-lg truncate text-slate-900 tracking-tight">
              {{ scenario()?.titleVi || 'Roleplay Tình huống' }}
            </h1>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" [ngClass]="statusDotClass()"></span>
              <span class="text-xs text-slate-500 font-medium">{{ statusLabel() }}</span>
              <span class="text-xs text-slate-300 hidden sm:inline">•</span>
              <span class="text-xs text-[#286FB4] font-semibold hidden sm:inline">
                Bạn ({{ scenario()?.userRole }}) vs AI ({{ scenario()?.aiRole }})
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2.5 sm:gap-3">
          <!-- Session Timer -->
          <div class="inline-flex items-center gap-1.5 font-bold text-xs sm:text-sm font-mono text-[#286FB4] bg-sky-50 border border-sky-100 px-3 py-1.5 rounded-xl">
            <svg class="w-3.5 h-3.5 text-[#286FB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{{ timer() | formatTime }}</span>
          </div>

          <!-- Chunks Target Drawer Toggle -->
          <button
            type="button"
            class="text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer flex items-center gap-1.5 border"
            [ngClass]="
              showChunks()
                ? 'bg-sky-50 text-[#286FB4] border-sky-200 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            "
            (click)="toggleChunks()"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
            <span class="hidden sm:inline">Mẫu câu</span> ({{ scenario()?.chunks?.length || 0 }})
          </button>

          <!-- Complete Session button -->
          <button
            type="button"
            class="btn-primary text-xs font-bold py-2 px-3.5 sm:px-4 rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            (click)="showEndModal.set(true)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Hoàn thành</span>
          </button>
        </div>
      </header>

      <!-- Main Layout: Transcripts + Chunks Side Drawer -->
      <div class="flex-1 min-h-0 flex overflow-hidden relative">
        <!-- Conversation Area -->
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden max-w-3xl mx-auto w-full">
          <!-- Message transcript stream -->
          <div
            #transcriptContainer
            class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4"
          >
            <!-- Scenario Context Card at top of stream -->
            @if (scenario(); as s) {
              <div class="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs text-slate-700 space-y-1 mb-2">
                <div class="font-bold text-[#286FB4] text-sm flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-[#286FB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <span>Bối cảnh tình huống:</span>
                </div>
                <p class="leading-relaxed text-slate-700">{{ s.context }}</p>
                <div class="pt-1 text-slate-500 italic">
                  Hãy tự nhiên trả lời bằng tiếng Anh theo vai của bạn. Bấm biểu tượng loa ở mỗi câu để nghe lại.
                </div>
              </div>
            }

            @for (t of voiceService.liveTranscripts(); track t.id) {
              <div
                class="flex gap-3 my-2"
                [class.flex-row-reverse]="t.speaker === 'USER'"
              >
                <!-- Avatar icon -->
                <div
                  class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs text-white shadow-xs"
                  [style.background]="t.speaker === 'AI' ? '#286FB4' : '#10b981'"
                >
                  @if (t.speaker === 'AI') {
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  } @else {
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                </div>

                <!-- Speech Bubble -->
                <div
                  class="min-w-0 max-w-[85%] sm:max-w-lg rounded-2xl p-4 text-sm shadow-xs transition-all"
                  [ngClass]="
                    t.speaker === 'AI'
                      ? 'bg-white border border-slate-200/90 text-slate-800'
                      : 'bg-[#286FB4] text-white shadow-sm'
                  "
                >
                  <!-- Top Bar: Speaker + Actions -->
                  <div
                    class="flex items-center justify-between gap-4 text-[11px] mb-1.5"
                    [class.text-slate-400]="t.speaker === 'AI'"
                    [class.text-sky-100]="t.speaker === 'USER'"
                  >
                    <span class="font-bold">
                      {{ t.speaker === 'AI' ? (scenario()?.aiRole || 'AI Roleplay') : 'Bạn' }} • {{ t.time }}
                    </span>

                    <div class="flex items-center gap-1.5">
                      <!-- Translate Toggle Button -->
                      <button
                        type="button"
                        class="w-6 h-6 flex items-center justify-center rounded-full text-xs transition cursor-pointer border-0 bg-transparent"
                        [ngClass]="
                          t.speaker === 'AI'
                            ? (showTranslation()[t.id] ? 'bg-sky-100 text-[#286FB4]' : 'hover:bg-slate-100 text-slate-500')
                            : (showTranslation()[t.id] ? 'bg-white/30 text-white' : 'hover:bg-white/15 text-sky-100')
                        "
                        [title]="showTranslation()[t.id] ? 'Ẩn bản dịch' : 'Xem bản dịch tiếng Việt'"
                        (click)="toggleTranslation(t)"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                      </button>

                      <!-- Audio Replay Speaker Button -->
                      <button
                        type="button"
                        class="w-6 h-6 flex items-center justify-center rounded-full text-xs transition cursor-pointer border-0 bg-transparent"
                        [ngClass]="
                          t.speaker === 'AI'
                            ? (voiceService.playingSegmentId() === t.id ? 'bg-amber-100 text-amber-700 animate-pulse' : 'hover:bg-slate-100 text-slate-600')
                            : (voiceService.playingSegmentId() === t.id ? 'bg-white text-[#286FB4] animate-pulse' : 'hover:bg-white/15 text-white')
                        "
                        [title]="voiceService.playingSegmentId() === t.id ? 'Đang phát...' : 'Nghe lại phát âm'"
                        (click)="replaySpeaker(t)"
                      >
                        @if (voiceService.playingSegmentId() === t.id) {
                          <svg class="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
                          </svg>
                        } @else {
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
                          </svg>
                        }
                      </button>
                    </div>
                  </div>

                  <!-- Spoken English Text -->
                  <div class="font-medium text-[15px] leading-relaxed break-words">
                    {{ t.text }}
                    @if (t.isPartial) {
                      <span class="inline-block animate-pulse font-bold">...</span>
                    }
                  </div>

                  <!-- Full Vietnamese Translation -->
                  @if (showTranslation()[t.id]) {
                    <div
                      class="mt-2.5 pt-2 text-xs leading-relaxed italic border-t"
                      [ngClass]="
                        t.speaker === 'AI'
                          ? 'border-slate-100 text-slate-600'
                          : 'border-white/20 text-sky-100'
                      "
                    >
                      @if (loadingTranslation()[t.id] && !translationMap()[t.id] && !t.translation) {
                        <span class="animate-pulse">Đang dịch...</span>
                      } @else {
                        <span>{{ translationMap()[t.id] || t.translation || 'Không thể lấy bản dịch' }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            @if (voiceService.liveTranscripts().length === 0) {
              <div class="py-16 text-center text-slate-400 text-sm">
                <div class="w-12 h-12 rounded-2xl bg-sky-50 text-[#286FB4] mx-auto flex items-center justify-center mb-3 animate-pulse">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                Đang kết nối và chuẩn bị câu mở đầu từ AI...
              </div>
            }

            <!-- AI Thinking indicator -->
            @if (voiceService.uxState() === 'processing') {
              <div class="flex items-center gap-2 text-xs text-[#286FB4] font-semibold py-2">
                <span class="w-2 h-2 rounded-full bg-[#286FB4] animate-ping"></span>
                AI đang xử lý câu trả lời...
              </div>
            }
          </div>

          <!-- Pure Microphone Bottom Bar -->
          <footer
            class="p-4 sm:p-5 shrink-0 flex flex-col items-center justify-center gap-2.5 bg-white border-t border-slate-200/80 shadow-md"
          >
            <!-- Central Microphone Button with Pulsing Wave on Speaking -->
            <div class="relative flex items-center justify-center">
              @if (voiceService.isRecordingTurn()) {
                <span class="absolute w-24 h-24 rounded-full bg-rose-500/20 animate-ping pointer-events-none"></span>
                <span class="absolute w-20 h-20 rounded-full bg-rose-500/30 animate-pulse pointer-events-none"></span>
              }

              <button
                type="button"
                data-testid="roleplay-mic-btn"
                class="relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center text-white transition-all duration-200 shadow-xl cursor-pointer hover:scale-105 active:scale-95 focus:outline-none border-0"
                [style.background]="voiceService.isRecordingTurn() ? '#DF4C73' : '#286FB4'"
                [attr.aria-label]="voiceService.isRecordingTurn() ? 'Dừng nói' : 'Bắt đầu nói'"
                (click)="toggleSpeaking()"
              >
                @if (voiceService.isRecordingTurn()) {
                  <div class="flex items-center gap-1" title="Nhấn để hoàn tất câu nói">
                    <span class="w-1.5 h-4 bg-white rounded-full animate-[bounce_0.8s_infinite]"></span>
                    <span class="w-1.5 h-7 bg-white rounded-full animate-[bounce_0.8s_infinite_0.15s]"></span>
                    <span class="w-1.5 h-5 bg-white rounded-full animate-[bounce_0.8s_infinite_0.3s]"></span>
                    <span class="w-1.5 h-7 bg-white rounded-full animate-[bounce_0.8s_infinite_0.45s]"></span>
                    <span class="w-1.5 h-4 bg-white rounded-full animate-[bounce_0.8s_infinite_0.6s]"></span>
                  </div>
                } @else {
                  <svg class="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                }
              </button>
            </div>

            <!-- Hint text below microphone -->
            <div class="text-center">
              <p class="text-xs sm:text-sm font-bold text-slate-700">
                @if (voiceService.isRecordingTurn()) {
                  <span class="text-rose-600">Đang lắng nghe... Chạm lại để hoàn tất câu nói</span>
                } @else if (voiceService.uxState() === 'processing') {
                  <span class="text-[#286FB4]">AI đang suy nghĩ...</span>
                } @else if (voiceService.uxState() === 'ai_speaking') {
                  <span class="text-[#286FB4]">AI đang phản hồi qua loa</span>
                } @else {
                  <span class="text-slate-600">Chạm vào micro để nói</span>
                }
              </p>
            </div>
          </footer>
        </div>

        <!-- Chunks Target Drawer (Clean Sidebar for Desktop) -->
        @if (showChunks()) {
          <aside
            class="w-80 shrink-0 border-l border-slate-200/80 p-5 overflow-y-auto hidden md:block bg-white shadow-xs"
          >
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-extrabold text-xs text-[#286FB4] uppercase tracking-wider flex items-center gap-1.5">
                <svg class="w-4 h-4 text-[#286FB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
                <span>Mẫu câu gợi ý</span>
              </h3>
              <button
                type="button"
                class="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs cursor-pointer border-0 bg-transparent"
                (click)="showChunks.set(false)"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p class="text-xs text-slate-500 mb-4 leading-relaxed">
              Dùng các mẫu câu này trong hội thoại để đạt yêu cầu nhiệm vụ:
            </p>

            <div class="space-y-3">
              @for (c of scenario()?.chunks; track c.id) {
                <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-sky-200 transition">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-bold text-[#286FB4] uppercase">
                      {{ c.functionTag }}
                    </span>
                    <button
                      type="button"
                      class="text-xs hover:scale-110 transition cursor-pointer text-slate-500 border-0 bg-transparent"
                      title="Nghe mẫu phát âm"
                      (click)="playSample(c.text)"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
                      </svg>
                    </button>
                  </div>
                  <div class="text-xs font-bold text-slate-900 leading-snug">
                    "{{ c.text }}"
                  </div>
                  <div class="text-[11px] text-slate-500 mt-1">
                    {{ c.meaningVi }}
                  </div>
                </div>
              }
            </div>
          </aside>
        }
      </div>

      <!-- End confirmation modal -->
      @if (showEndModal()) {
        <div class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div class="card max-w-sm w-full p-6 space-y-4 bg-white border border-slate-100 text-slate-800 shadow-2xl rounded-3xl">
            <div class="w-12 h-12 rounded-2xl bg-sky-50 text-[#286FB4] mx-auto flex items-center justify-center">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="font-extrabold text-lg text-slate-900 text-center">Kết thúc phiên Roleplay?</h3>
            <p class="text-xs text-slate-600 leading-relaxed text-center">
              Hệ thống sẽ chấm điểm 5 kỹ năng, kiểm tra các mục tiêu nhiệm vụ bạn đã đạt và thống kê các chunk bạn dùng tốt.
            </p>
            <div class="flex justify-center gap-3 pt-2">
              <button
                type="button"
                class="btn-secondary text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                (click)="showEndModal.set(false)"
              >
                Tiếp tục nói
              </button>
              <button
                type="button"
                class="btn-primary text-xs px-5 py-2.5 rounded-xl font-bold cursor-pointer"
                [disabled]="isEnding()"
                (click)="confirmEndSession()"
              >
                {{ isEnding() ? 'Đang chấm điểm...' : 'Xác nhận hoàn thành' }}
              </button>
            </div>
          </div>
        </div>
      }
    </main>
  `,
})
export class ScenarioRoleplayComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly voiceService = inject(CoachVoiceService);
  private readonly coachService = inject(CoachService);
  private readonly scenarioService = inject(ScenarioService);
  readonly appState = inject(AppStateService);

  @ViewChild('transcriptContainer')
  private transcriptContainer?: ElementRef<HTMLDivElement>;

  readonly sessionId = signal<string>('');
  readonly scenario = signal<ScenarioDetail | null>(null);
  readonly timer = signal<number>(0);
  readonly showChunks = signal<boolean>(true);
  readonly showEndModal = signal<boolean>(false);
  readonly isEnding = signal<boolean>(false);

  // Translation signals (for full translation on demand)
  readonly showTranslation = signal<Record<string, boolean>>({});
  readonly translationMap = signal<Record<string, string>>({});
  readonly loadingTranslation = signal<Record<string, boolean>>({});

  private timerInterval?: ReturnType<typeof setInterval>;

  readonly statusLabel = computed(() => {
    const s = this.voiceService.uxState();
    switch (s) {
      case 'user_speaking':
        return 'Bạn đang nói...';
      case 'ai_speaking':
        return 'AI đang phản hồi...';
      case 'processing':
        return 'AI đang suy nghĩ...';
      case 'reconnecting':
        return 'Đang kết nối lại...';
      default:
        return 'Sẵn sàng hội thoại';
    }
  });

  readonly statusDotClass = computed(() => {
    const s = this.voiceService.uxState();
    if (s === 'user_speaking') return 'bg-emerald-500 animate-ping';
    if (s === 'ai_speaking') return 'bg-[#286FB4] animate-pulse';
    if (s === 'reconnecting') return 'bg-amber-400';
    return 'bg-emerald-500';
  });

  constructor() {
    effect(() => {
      // Auto-scroll when new transcript arrives
      const list = this.voiceService.liveTranscripts();
      setTimeout(() => {
        if (this.transcriptContainer) {
          const el = this.transcriptContainer.nativeElement;
          el.scrollTop = el.scrollHeight;
        }
      }, 80);

      // Sync pre-supplied translations without burning extra LLM calls per turn
      for (const item of list) {
        if (!this.translationMap()[item.id] && item.translation) {
          this.translationMap.update((m) => ({ ...m, [item.id]: item.translation! }));
        }
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.sessionId.set(id);

    if (id) {
      // Reset any previous conversation state and connect to roleplay session
      this.voiceService.cleanup();
      void this.voiceService.startVoiceSession(id);

      // Load scenario details for context
      this.loadScenarioContext();

      // Ensure AI speaks the opening roleplay message immediately
      const initialOpening = history.state?.roleplaySession?.openingMessage;
      if (initialOpening) {
        setTimeout(() => {
          if (this.voiceService.liveTranscripts().length === 0) {
            this.voiceService.speakText(initialOpening);
          }
        }, 500);
      }

      // Start timer
      this.timerInterval = setInterval(() => {
        this.timer.update((t) => t + 1);
      }, 1000);
    } else {
      // No session id in route — initialize fresh roleplay session
      const queryScenId = this.route.snapshot.queryParamMap.get('scenarioId') || 'supermarket-shopping';
      this.scenarioService.startRoleplay(queryScenId).subscribe({
        next: (res) => {
          this.sessionId.set(res.sessionId);
          this.voiceService.cleanup();
          void this.voiceService.startVoiceSession(res.sessionId);
          this.loadScenarioContext();
          if (res.openingMessage) {
            setTimeout(() => {
              if (this.voiceService.liveTranscripts().length === 0) {
                this.voiceService.speakText(res.openingMessage);
              }
            }, 500);
          }
          this.timerInterval = setInterval(() => {
            this.timer.update((t) => t + 1);
          }, 1000);
        },
        error: () => {
          void this.router.navigate(['/scenarios']);
        },
      });
    }
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.voiceService.cleanup();
  }

  loadScenarioContext(): void {
    const navState = history.state?.scenario;
    if (navState && navState.id) {
      this.scenario.set(navState);
      return;
    }
    const queryScenId = this.route.snapshot.queryParamMap.get('scenarioId');
    const targetId = queryScenId || 'supermarket-shopping';
    this.scenarioService.getScenario(targetId).subscribe({
      next: (s) => this.scenario.set(s),
    });
  }

  toggleChunks(): void {
    this.showChunks.update((v) => !v);
  }

  async toggleSpeaking(): Promise<void> {
    await this.voiceService.toggleSpeakingTurn();
  }

  replaySpeaker(item: LiveTranscriptItem): void {
    this.voiceService.playSegmentAudio(item);
  }

  playSample(text: string): void {
    this.voiceService.speakText(text);
  }

  prefetchTranslation(item: LiveTranscriptItem): void {
    if (this.translationMap()[item.id] || this.loadingTranslation()[item.id]) return;
    this.loadingTranslation.update((m) => ({ ...m, [item.id]: true }));
    this.coachService.translate(item.text).subscribe({
      next: (res) => {
        this.loadingTranslation.update((m) => ({ ...m, [item.id]: false }));
        this.translationMap.update((m) => ({ ...m, [item.id]: res.translatedText }));
      },
      error: () => {
        this.loadingTranslation.update((m) => ({ ...m, [item.id]: false }));
      },
    });
  }

  toggleTranslation(item: LiveTranscriptItem): void {
    const isShown = !!this.showTranslation()[item.id];
    this.showTranslation.update((m) => ({ ...m, [item.id]: !isShown }));
    if (!this.translationMap()[item.id] && !item.translation) {
      this.prefetchTranslation(item);
    }
  }

  confirmEndSession(): void {
    const id = this.sessionId();
    if (!id) return;

    this.isEnding.set(true);
    this.scenarioService.endRoleplay(id).subscribe({
      next: () => {
        this.isEnding.set(false);
        this.showEndModal.set(false);
        this.router.navigate(['/scenario-result', id]);
      },
      error: () => {
        this.isEnding.set(false);
        this.showEndModal.set(false);
        this.router.navigate(['/scenario-result', id]);
      },
    });
  }
}
