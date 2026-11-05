import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppStateService } from '../../core/services/app-state.service';
import { SpeechRecognitionService } from '../../core/services/speech-recognition.service';
import {
  ScenarioService,
  ScenarioDetail,
  ScenarioChunk,
  evaluatePronunciation,
  getIpaPhonetic,
  WordPronunciationScore,
} from '../../core/services/scenario.service';

// ---------------------------------------------------------------------------
// DRILL PHASE STATE MACHINE
// ---------------------------------------------------------------------------
/**
 * Multi-phase chunk drill inspired by "App the Coach":
 * Phase 1 (mcq_vi_to_en): Bold VI part → pick correct EN chunk
 * Phase 2 (pronounce_part1): AI says chunk part 1, user speaks & scores
 * Phase 3 (mcq_en_to_vi): Bold EN part → pick correct VI equivalent
 * Phase 4 (pronounce_part2): AI says chunk part 2 / full, user speaks & scores
 * Phase 5 (listen_repeat): Hear full chunk, user repeats
 * Phase 6 (fill_blank): Fill-in-blank, user must speak correctly
 */
export type DrillPhase =
  | 'mcq_vi_to_en'
  | 'pronounce_part1'
  | 'mcq_en_to_vi'
  | 'pronounce_part2'
  | 'listen_repeat'
  | 'fill_blank';

export type CoachStage = 'overview' | 'interactive_drill' | 'summary_ready';

const PHASE_ORDER: DrillPhase[] = [
  'mcq_vi_to_en',
  'pronounce_part1',
  'mcq_en_to_vi',
  'pronounce_part2',
  'listen_repeat',
  'fill_blank',
];

const MIN_PRONUN_SCORE = 55; // minimum to advance from pronunciation phases

const FUNCTIONAL_TAG_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPENING: { label: 'Mở đầu', color: '#286FB4', bg: '#E2F0F9' },
  REQUEST: { label: 'Yêu cầu', color: '#7c3aed', bg: '#F5F3FF' },
  CLARIFY: { label: 'Làm rõ', color: '#059669', bg: '#ECFDF5' },
  AGREE_DECLINE: { label: 'Đồng ý / Từ chối', color: '#f59e0b', bg: '#FFF5E5' },
  CLOSING: { label: 'Kết thúc', color: '#64748b', bg: '#F1F5F9' },
};

/** Shuffle array in-place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build MCQ options: 1 correct + up to 3 distractors, shuffled */
function buildMcqOptions(correct: string, distractors: string[]): { text: string; correct: boolean }[] {
  const pool = distractors.slice(0, 3);
  const all = shuffle([
    { text: correct, correct: true },
    ...pool.map((t) => ({ text: t, correct: false })),
  ]);
  return all;
}

@Component({
  selector: 'app-scenario-detail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50/70 pb-16">
      <!-- Loading / Error States -->
      @if (isLoading()) {
        <div class="py-24 text-center text-slate-400">
          <div class="text-4xl animate-bounce mb-3">⏳</div>
          <p class="text-sm font-600">Đang tải tình huống...</p>
        </div>
      } @else if (errorMessage()) {
        <div class="max-w-md mx-auto mt-12 p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center">
          <p class="text-sm font-600 text-rose-700 mb-4">{{ errorMessage() }}</p>
          <button type="button" class="btn-secondary cursor-pointer" (click)="loadScenario()">
            Thử lại
          </button>
        </div>
      } @else {
        @if (scenario(); as s) {

          <!-- ============================================================== -->
          <!-- SCREEN 1: OVERVIEW                                             -->
          <!-- ============================================================== -->
          @if (stage() === 'overview') {
            <div class="max-w-2xl mx-auto px-4 pt-6 space-y-6">
              <!-- Header Bar -->
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Quay lại danh sách"
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-xs border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  (click)="goBack()"
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div class="flex items-center gap-2">
                  <span class="px-3 py-1 rounded-full text-xs font-bold bg-[#E2F0F9] text-[#286FB4]">
                    Level {{ s.level }}
                  </span>
                  <span class="text-xs text-slate-500 font-600">
                    ⏱ {{ s.estimatedDurationMinutes || 10 }} phút
                  </span>
                </div>
              </div>

              <!-- Hero Card -->
              <div class="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
                <div class="absolute -right-6 -bottom-6 w-32 h-32 bg-[#286FB4]/20 rounded-full blur-2xl"></div>
                <div class="text-[11px] font-extrabold uppercase tracking-widest text-sky-300 mb-1">
                  TÌNH HUỐNG GIAO TIẾP
                </div>
                <h1 class="text-xl md:text-2xl font-800 leading-snug mb-2 font-extrabold">
                  {{ s.titleEn }}
                </h1>
                <p class="text-xs md:text-sm text-slate-300 font-500">
                  {{ s.titleVi }}
                </p>
                <div class="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
                  <span>Vai: <strong class="text-white">{{ s.userRole }}</strong> vs <strong class="text-white">{{ s.aiRole }}</strong></span>
                  <button
                    type="button"
                    class="text-sky-300 hover:text-sky-200 underline font-600 cursor-pointer"
                    (click)="showContextModal.set(true)"
                  >
                    Xem bối cảnh & nhiệm vụ
                  </button>
                </div>
              </div>

              <!-- How it works -->
              <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                <div class="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                  🎯 Quy trình học theo "App The Coach"
                </div>
                <div class="grid grid-cols-3 gap-2">
                  @for (step of drillSteps; track step.phase) {
                    <div class="text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div class="text-lg mb-1">{{ step.icon }}</div>
                      <div class="text-[10px] font-bold text-slate-700 leading-tight">{{ step.label }}</div>
                    </div>
                  }
                </div>
              </div>

              <!-- Chunks Checklist -->
              <div class="space-y-3">
                <div class="flex items-center justify-between px-1">
                  <h2 class="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    CỤM TỪ CẦN LUYỆN ({{ s.chunks.length }})
                  </h2>
                  <span class="text-xs text-[#286FB4] font-700">
                    +{{ s.xpReward || 100 }} XP khi hoàn thành
                  </span>
                </div>
                <div class="space-y-3">
                  @for (c of s.chunks; track c.id) {
                    <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex items-start gap-3.5">
                      <button
                        type="button"
                        class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-[#E2F0F9] text-[#286FB4] hover:bg-sky-100 transition cursor-pointer"
                        title="Nghe phát âm chuẩn"
                        (click)="playAudio(c.text, c.audioUrl)"
                      >
                        🔊
                      </button>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span
                            class="px-2 py-0.5 rounded text-[10px] font-bold"
                            [style.background]="getTagMeta(c.functionTag).bg"
                            [style.color]="getTagMeta(c.functionTag).color"
                          >
                            {{ getTagMeta(c.functionTag).label }}
                          </span>
                        </div>
                        <div class="text-base font-extrabold text-slate-900 leading-snug">
                          {{ c.text }}
                        </div>
                        <div class="text-xs text-slate-500 mt-0.5">
                          {{ c.meaningVi }}
                        </div>
                        <div class="text-[11px] text-slate-600 italic mt-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          💬 "{{ c.exampleSentence }}"
                        </div>
                      </div>
                      <div class="flex flex-col items-center gap-2 shrink-0 pt-0.5">
                        <button
                          type="button"
                          class="text-base transition cursor-pointer"
                          [title]="isBookmarked(c.id) ? 'Đã lưu vào Chunk Bank' : 'Lưu vào Chunk Bank'"
                          (click)="toggleBookmark(c.id)"
                        >
                          {{ isBookmarked(c.id) ? '🔖' : '🏷️' }}
                        </button>
                        @if (isChunkPracticed(c.id)) {
                          <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold" title="Đã luyện tập">
                            ✓
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Start Button -->
              <div class="pt-2 pb-6">
                <button
                  type="button"
                  class="w-full py-4 rounded-2xl text-white font-extrabold text-base bg-[#286FB4] hover:bg-[#1d5a94] shadow-lg shadow-[#286FB4]/25 transition cursor-pointer"
                  (click)="startDrillFlow()"
                >
                  🚀 Bắt đầu luyện phản xạ cụm từ
                </button>
              </div>
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 2: MULTI-PHASE CHUNK DRILL                              -->
          <!-- ============================================================== -->
          @if (stage() === 'interactive_drill') {
            <div class="max-w-xl mx-auto px-4 pt-5 space-y-5">

              <!-- Top Nav: Back + Progress + Chunk counter -->
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Thoát bài luyện"
                  class="w-9 h-9 rounded-full flex items-center justify-center bg-white shadow-xs border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer text-sm"
                  (click)="stage.set('overview')"
                >✕</button>

                <!-- Progress bar -->
                <div class="flex-1 mx-3">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-bold text-slate-500">Cụm {{ drillChunkIdx() + 1 }}/{{ s.chunks.length }}</span>
                    <span class="text-[10px] font-bold text-[#286FB4]">{{ phaseLabel() }}</span>
                  </div>
                  <div class="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-[#286FB4] to-sky-400 transition-all duration-500"
                      [style.width]="overallProgressPct() + '%'"
                    ></div>
                  </div>
                  <!-- Phase dots for current chunk -->
                  <div class="flex items-center gap-1 mt-1.5 justify-center">
                    @for (ph of phaseOrder; track ph; let i = $index) {
                      <div
                        class="rounded-full transition-all"
                        [style.width]="ph === currentPhase() ? '14px' : '5px'"
                        [style.height]="'5px'"
                        [style.background]="phaseCompleted(i) ? '#16a34a' : (ph === currentPhase() ? '#286FB4' : '#cbd5e1')"
                      ></div>
                    }
                  </div>
                </div>

                <!-- Play audio for chunk reference -->
                @if (currentChunk(); as cc) {
                  <button
                    type="button"
                    class="w-9 h-9 rounded-full flex items-center justify-center bg-[#E2F0F9] text-[#286FB4] hover:bg-sky-200 transition cursor-pointer text-sm"
                    title="Nghe cụm từ"
                    (click)="playAudio(cc.text, cc.audioUrl)"
                  >🔊</button>
                }
              </div>

              @if (currentChunk(); as chunk) {

                <!-- ===================================================== -->
                <!-- PHASE 1 & 3: MCQ (VI→EN or EN→VI)                    -->
                <!-- ===================================================== -->
                @if (currentPhase() === 'mcq_vi_to_en' || currentPhase() === 'mcq_en_to_vi') {
                  <div class="space-y-5">
                    <!-- Instruction -->
                    <div class="text-center">
                      <div class="text-[11px] font-extrabold uppercase tracking-widest text-[#286FB4] mb-2">
                        {{ currentPhase() === 'mcq_vi_to_en' ? 'CHỌN NGHĨA TIẾNG ANH ĐÚNG' : 'CHỌN NGHĨA TIẾNG VIỆT ĐÚNG' }}
                      </div>
                    </div>

                    <!-- Sentence card with bold highlight -->
                    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                      <div class="text-sm font-600 text-slate-500 mb-1">Hãy dịch phần in đậm:</div>
                      <div
                        class="text-base md:text-lg font-semibold text-slate-800 leading-relaxed"
                        [innerHTML]="mcqSentenceHtml()"
                      ></div>
                    </div>

                    <!-- MCQ Options -->
                    <div class="space-y-2.5">
                      @for (opt of mcqOptions(); track opt.text; let i = $index) {
                        <button
                          type="button"
                          class="w-full text-left p-4 rounded-2xl border-2 font-semibold text-sm transition cursor-pointer"
                          [class]="getMcqOptionClass(opt, i)"
                          (click)="selectMcqOption(opt)"
                          [disabled]="mcqAnswered()"
                        >
                          <span class="inline-block w-6 h-6 rounded-full text-center text-xs font-bold mr-2 bg-slate-100 text-slate-600">
                            {{ mcqOptionLetter(i) }}
                          </span>
                          {{ opt.text }}
                        </button>
                      }
                    </div>

                    <!-- Feedback message -->
                    @if (mcqAnswered()) {
                      <div
                        class="rounded-xl p-3 text-sm font-bold text-center"
                        [class]="mcqCorrect() ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'"
                      >
                        {{ mcqCorrect() ? '✅ Đúng rồi! Tiếp tục nào.' : '❌ Chưa đúng. Đáp án: ' + mcqCorrectText() }}
                      </div>
                      <button
                        type="button"
                        class="w-full py-3.5 rounded-2xl text-white font-extrabold text-sm bg-[#286FB4] hover:bg-[#1d5a94] transition cursor-pointer shadow-md shadow-[#286FB4]/20"
                        (click)="advancePhase()"
                      >
                        Tiếp theo ➔
                      </button>
                    }
                  </div>
                }

                <!-- ===================================================== -->
                <!-- PHASE 2 & 4: PRONUNCIATION DRILL                      -->
                <!-- ===================================================== -->
                @if (currentPhase() === 'pronounce_part1' || currentPhase() === 'pronounce_part2') {
                  <div class="space-y-5">
                    <!-- Instruction -->
                    <div class="text-center">
                      <div class="text-[11px] font-extrabold uppercase tracking-widest text-[#286FB4] mb-1">
                        HÃY PHÁT ÂM CỤM TỪ SAU
                      </div>
                      <div class="text-[10px] text-slate-400 font-500">AI sẽ đọc mẫu trước — đạt {{ minScore }}+ điểm để tiếp tục</div>
                    </div>

                    <!-- Circular score meter -->
                    <div class="relative w-28 h-28 mx-auto flex items-center justify-center">
                      <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="#e2e8f0" stroke-width="8" fill="none" />
                        <circle
                          cx="50" cy="50" r="40"
                          [attr.stroke]="scoreColor()"
                          stroke-width="8"
                          stroke-linecap="round"
                          fill="none"
                          [attr.stroke-dasharray]="circleCircumference"
                          [attr.stroke-dashoffset]="circleDashOffset()"
                          class="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span class="text-2xl font-extrabold leading-none" [style.color]="scoreColor()">
                          {{ pronunciationScore() !== null ? pronunciationScore() : '--' }}
                        </span>
                        <span class="text-[8px] uppercase font-bold text-slate-400 mt-0.5">
                          {{ pronunciationScore() !== null ? 'điểm' : 'chưa nói' }}
                        </span>
                      </div>
                    </div>

                    <!-- Chunk display -->
                    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                      <div class="text-lg font-extrabold text-slate-900 mb-1">{{ chunk.text }}</div>
                      <div class="text-xs text-slate-400 font-mono mb-2">{{ ipaTranscript() }}</div>
                      <div class="text-sm text-[#286FB4] font-600">{{ chunk.meaningVi }}</div>
                    </div>

                    <!-- Word-by-word result -->
                    @if (evaluatedWordTokens().length > 0 && pronunciationScore() !== null) {
                      <div class="flex flex-wrap gap-1.5 justify-center">
                        @for (w of evaluatedWordTokens(); track $index) {
                          <span
                            class="px-2.5 py-1 rounded-lg text-sm font-bold"
                            [style.background]="w.status === 'correct' ? '#dcfce7' : (w.status === 'imperfect' ? '#fef9c3' : '#fee2e2')"
                            [style.color]="w.status === 'correct' ? '#16a34a' : (w.status === 'imperfect' ? '#854d0e' : '#dc2626')"
                          >{{ w.word }}</span>
                        }
                      </div>
                    }

                    <!-- AI-speak + Mic controls -->
                    <div class="flex flex-col items-center gap-3">
                      <!-- TTS Buttons row -->
                      <div class="flex items-center gap-3">
                        <button
                          type="button"
                          class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 font-bold text-sm hover:bg-sky-100 transition cursor-pointer"
                          (click)="playAudio(chunk.text, chunk.audioUrl, false)"
                        >
                          <span>🔊</span> AI đọc mẫu
                        </button>
                        <button
                          type="button"
                          class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-sm hover:bg-indigo-100 transition cursor-pointer"
                          (click)="playAudio(chunk.text, chunk.audioUrl, true)"
                        >
                          <span>🐌</span> Chậm
                        </button>
                      </div>

                      <!-- Microphone button -->
                      <button
                        type="button"
                        class="w-18 h-18 rounded-full flex flex-col items-center justify-center shadow-lg transition cursor-pointer border-4"
                        [class]="isListening() ? 'bg-rose-500 border-rose-300 animate-pulse' : 'bg-[#286FB4] border-[#286FB4]/30 hover:bg-[#1d5a94]'"
                        (click)="toggleMicrophone()"
                        style="width:72px;height:72px"
                      >
                        <span class="text-2xl">{{ isListening() ? '⏹' : '🎤' }}</span>
                        <span class="text-[9px] text-white font-bold mt-0.5">{{ isListening() ? 'Dừng' : 'Nói' }}</span>
                      </button>

                      @if (recognizedSpeech()) {
                        <div class="text-xs text-slate-500 italic text-center">
                          Nhận được: "{{ recognizedSpeech() }}"
                        </div>
                      }
                    </div>

                    <!-- User audio playback -->
                    @if (userAudioUrl()) {
                      <div class="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">🎧 Giọng bạn vừa nói:</div>
                        <audio [src]="userAudioUrl()!" controls class="w-full h-8"></audio>
                      </div>
                    }

                    <!-- Advance controls -->
                    <div class="flex gap-3">
                      <button
                        type="button"
                        class="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                        (click)="skipPronun()"
                      >
                        Bỏ qua
                      </button>
                      <button
                        type="button"
                        class="flex-1 py-3 rounded-xl font-bold text-sm transition cursor-pointer"
                        [class]="canAdvancePronun() ? 'bg-[#286FB4] text-white hover:bg-[#1d5a94] shadow-md shadow-[#286FB4]/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'"
                        [disabled]="!canAdvancePronun()"
                        (click)="advancePhase()"
                      >
                        {{ canAdvancePronun() ? 'Tiếp theo ➔' : 'Nói đạt ' + minScore + '+ điểm' }}
                      </button>
                    </div>
                  </div>
                }

                <!-- ===================================================== -->
                <!-- PHASE 5: LISTEN & REPEAT FULL CHUNK                   -->
                <!-- ===================================================== -->
                @if (currentPhase() === 'listen_repeat') {
                  <div class="space-y-5">
                    <div class="text-center">
                      <div class="text-[11px] font-extrabold uppercase tracking-widest text-[#286FB4] mb-1">
                        NGHE VÀ NÓI LẠI
                      </div>
                      <div class="text-[10px] text-slate-400">AI đọc câu hoàn chỉnh — bạn lặp lại</div>
                    </div>

                    <!-- Full chunk card -->
                    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
                      <div class="text-lg font-extrabold text-slate-900 mb-1">{{ chunk.exampleSentence }}</div>
                      <div class="text-xs text-slate-400 font-mono mb-2">{{ ipaOfExample() }}</div>
                      <div class="text-sm text-[#286FB4] font-600">{{ chunk.meaningVi }}</div>
                    </div>

                    <!-- Word tokens after speaking -->
                    @if (evaluatedWordTokens().length > 0 && pronunciationScore() !== null) {
                      <div class="flex flex-wrap gap-1.5 justify-center">
                        @for (w of evaluatedWordTokens(); track $index) {
                          <span
                            class="px-2.5 py-1 rounded-lg text-sm font-bold"
                            [style.background]="w.status === 'correct' ? '#dcfce7' : (w.status === 'imperfect' ? '#fef9c3' : '#fee2e2')"
                            [style.color]="w.status === 'correct' ? '#16a34a' : (w.status === 'imperfect' ? '#854d0e' : '#dc2626')"
                          >{{ w.word }}</span>
                        }
                      </div>
                    }

                    <!-- Controls -->
                    <div class="flex flex-col items-center gap-3">
                      <button
                        type="button"
                        class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 font-bold text-sm hover:bg-sky-100 transition cursor-pointer"
                        (click)="playAudio(chunk.exampleSentence, chunk.audioUrl, false)"
                      >
                        <span>🔊</span> AI đọc mẫu câu
                      </button>
                      <button
                        type="button"
                        class="w-18 h-18 rounded-full flex flex-col items-center justify-center shadow-lg transition cursor-pointer border-4"
                        [class]="isListening() ? 'bg-rose-500 border-rose-300 animate-pulse' : 'bg-[#286FB4] border-[#286FB4]/30 hover:bg-[#1d5a94]'"
                        (click)="toggleMicrophone()"
                        style="width:72px;height:72px"
                      >
                        <span class="text-2xl">{{ isListening() ? '⏹' : '🎤' }}</span>
                        <span class="text-[9px] text-white font-bold mt-0.5">{{ isListening() ? 'Dừng' : 'Nói' }}</span>
                      </button>
                    </div>

                    @if (userAudioUrl()) {
                      <div class="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">🎧 Giọng bạn vừa nói:</div>
                        <audio [src]="userAudioUrl()!" controls class="w-full h-8"></audio>
                      </div>
                    }

                    <div class="flex gap-3">
                      <button
                        type="button"
                        class="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                        (click)="skipPronun()"
                      >
                        Bỏ qua
                      </button>
                      <button
                        type="button"
                        class="flex-1 py-3 rounded-xl font-bold text-sm transition cursor-pointer"
                        [class]="pronunciationScore() !== null ? 'bg-[#286FB4] text-white hover:bg-[#1d5a94] shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'"
                        [disabled]="pronunciationScore() === null"
                        (click)="advancePhase()"
                      >
                        Tiếp theo ➔
                      </button>
                    </div>
                  </div>
                }

                <!-- ===================================================== -->
                <!-- PHASE 6: FILL IN THE BLANK (speak)                    -->
                <!-- ===================================================== -->
                @if (currentPhase() === 'fill_blank') {
                  <div class="space-y-5">
                    <div class="text-center">
                      <div class="text-[11px] font-extrabold uppercase tracking-widest text-[#286FB4] mb-1">
                        ĐIỀN VÀO CHỖ TRỐNG
                      </div>
                      <div class="text-[10px] text-slate-400">Nói hoàn chỉnh câu dưới đây để tiếp tục</div>
                    </div>

                    <!-- Blank sentence card -->
                    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center space-y-3">
                      <div class="text-base font-extrabold text-slate-900 tracking-wide leading-relaxed">
                        {{ fillBlankSentence() }}
                      </div>
                      <div class="text-xs text-slate-400 italic">{{ chunk.meaningVi }}</div>
                    </div>

                    <!-- Word tokens after speaking -->
                    @if (evaluatedWordTokens().length > 0 && pronunciationScore() !== null) {
                      <div class="flex flex-wrap gap-1.5 justify-center">
                        @for (w of evaluatedWordTokens(); track $index) {
                          <span
                            class="px-2.5 py-1 rounded-lg text-sm font-bold"
                            [style.background]="w.status === 'correct' ? '#dcfce7' : (w.status === 'imperfect' ? '#fef9c3' : '#fee2e2')"
                            [style.color]="w.status === 'correct' ? '#16a34a' : (w.status === 'imperfect' ? '#854d0e' : '#dc2626')"
                          >{{ w.word }}</span>
                        }
                      </div>
                    }

                    <!-- Controls -->
                    <div class="flex flex-col items-center gap-3">
                      <button
                        type="button"
                        class="w-18 h-18 rounded-full flex flex-col items-center justify-center shadow-lg transition cursor-pointer border-4"
                        [class]="isListening() ? 'bg-rose-500 border-rose-300 animate-pulse' : 'bg-[#286FB4] border-[#286FB4]/30 hover:bg-[#1d5a94]'"
                        (click)="toggleMicrophone()"
                        style="width:72px;height:72px"
                      >
                        <span class="text-2xl">{{ isListening() ? '⏹' : '🎤' }}</span>
                        <span class="text-[9px] text-white font-bold mt-0.5">{{ isListening() ? 'Dừng' : 'Nói' }}</span>
                      </button>
                      @if (recognizedSpeech()) {
                        <div class="text-xs text-slate-500 italic">"{{ recognizedSpeech() }}"</div>
                      }
                    </div>

                    @if (userAudioUrl()) {
                      <div class="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">🎧 Giọng bạn:</div>
                        <audio [src]="userAudioUrl()!" controls class="w-full h-8"></audio>
                      </div>
                    }

                    <div class="flex gap-3">
                      <button
                        type="button"
                        class="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                        (click)="skipPronun()"
                      >
                        Bỏ qua
                      </button>
                      <button
                        type="button"
                        class="flex-1 py-3 rounded-xl font-bold text-sm transition cursor-pointer"
                        [class]="canAdvancePronun() ? 'bg-[#286FB4] text-white hover:bg-[#1d5a94] shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'"
                        [disabled]="!canAdvancePronun()"
                        (click)="advancePhase()"
                      >
                        {{ isLastChunk() ? '🏁 Hoàn thành!' : 'Tiếp theo ➔' }}
                      </button>
                    </div>
                  </div>
                }

              }
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 3: SUMMARY READY → ROLEPLAY                            -->
          <!-- ============================================================== -->
          @if (stage() === 'summary_ready') {
            <div class="max-w-md mx-auto px-4 pt-12 text-center space-y-6">
              <div class="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl shadow-sm animate-bounce">
                🎯
              </div>
              <div>
                <h2 class="text-2xl font-extrabold text-slate-900">
                  Xuất sắc! Bạn đã nạp sâu tất cả cụm từ
                </h2>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed">
                  Mỗi cụm từ đã qua 6 bước phản xạ: Dịch MCQ ➔ Phát âm ➔ Dịch ngược ➔ Phát âm ➔ Nghe lặp ➔ Điền khuyết.<br>
                  Giờ là lúc dùng chúng trong cuộc hội thoại thực tế!
                </p>
              </div>

              <!-- Quick Recap -->
              <div class="bg-white rounded-3xl p-5 border border-slate-200 text-left space-y-2.5 shadow-xs">
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mẫu câu bạn sẽ dùng trong Roleplay:
                </div>
                @for (c of s.chunks; track c.id) {
                  <div class="flex items-center gap-2.5 text-xs text-slate-800">
                    <span class="text-emerald-500 font-bold">✓</span>
                    <span class="font-bold text-[#286FB4]">"{{ c.text }}"</span>
                    <span class="text-slate-400 italic text-[11px] truncate">— {{ c.meaningVi }}</span>
                  </div>
                }
              </div>

              <div class="space-y-3 pt-2">
                <button
                  type="button"
                  class="w-full py-4 rounded-2xl bg-[#286FB4] hover:bg-[#1d5a94] text-white font-extrabold text-sm shadow-xl shadow-[#286FB4]/25 transition cursor-pointer"
                  [disabled]="isStartingRoleplay()"
                  (click)="startRoleplay()"
                >
                  {{ isStartingRoleplay() ? 'Đang tạo phòng roleplay...' : '🎭 Bắt đầu Roleplay ngay' }}
                </button>
                <button
                  type="button"
                  class="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                  (click)="stage.set('overview')"
                >
                  Xem lại bài học
                </button>
              </div>
            </div>
          }

          <!-- ============================================================== -->
          <!-- CONTEXT & REQUIREMENTS MODAL                                   -->
          <!-- ============================================================== -->
          @if (showContextModal()) {
            <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div class="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 class="font-extrabold text-base text-slate-800">Bối cảnh & Nhiệm vụ</h3>
                  <button
                    type="button"
                    class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                    (click)="showContextModal.set(false)"
                  >✕</button>
                </div>
                <div>
                  <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Bối cảnh</h4>
                  <p class="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    {{ s.context }}
                  </p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="p-3 rounded-xl bg-sky-50 border border-sky-100">
                    <div class="text-[10px] font-bold text-sky-700 uppercase">Vai của bạn</div>
                    <div class="text-xs font-bold text-slate-800">{{ s.userRole }}</div>
                  </div>
                  <div class="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                    <div class="text-[10px] font-bold text-indigo-700 uppercase">Vai của AI</div>
                    <div class="text-xs font-bold text-slate-800">{{ s.aiRole }}</div>
                  </div>
                </div>
                <div>
                  <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Mục tiêu cần hoàn thành</h4>
                  <div class="space-y-2">
                    @for (req of s.requirements; track req.id) {
                      <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <span class="text-emerald-600 font-bold mt-0.5">✓</span>
                        <div class="flex-1">
                          <span class="font-600 text-slate-800">{{ req.description }}</span>
                        </div>
                        @if (req.isMandatory) {
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                            Bắt buộc
                          </span>
                        }
                      </div>
                    }
                  </div>
                </div>
                <div class="pt-2">
                  <button
                    type="button"
                    class="w-full py-3 rounded-xl bg-[#286FB4] text-white text-xs font-bold hover:bg-[#1d5a94] transition cursor-pointer"
                    (click)="showContextModal.set(false)"
                  >
                    Đã hiểu, quay lại học
                  </button>
                </div>
              </div>
            </div>
          }
        }
      }
    </div>
  `,
})
export class ScenarioDetailComponent implements OnInit, OnDestroy {
  private readonly scenarioService = inject(ScenarioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  readonly appState = inject(AppStateService);
  readonly speechService = inject(SpeechRecognitionService);

  // ----- Stage & navigation -----
  readonly stage = signal<CoachStage>('overview');
  readonly drillChunkIdx = signal(0);
  readonly currentPhase = signal<DrillPhase>('mcq_vi_to_en');

  // ----- Data -----
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isStartingRoleplay = signal(false);
  readonly showContextModal = signal(false);
  readonly scenario = signal<ScenarioDetail | null>(null);
  readonly bookmarkedChunkIds = signal<Set<string>>(new Set());
  readonly practicedChunkIds = signal<Set<string>>(new Set());

  // ----- MCQ state -----
  readonly mcqOptions = signal<{ text: string; correct: boolean }[]>([]);
  readonly selectedMcqIdx = signal<number | null>(null);
  readonly mcqAnswered = signal(false);
  readonly mcqCorrect = signal(false);
  readonly mcqCorrectText = signal('');

  // ----- Pronunciation state -----
  readonly pronunciationScore = signal<number | null>(null);
  readonly evaluatedWordTokens = signal<WordPronunciationScore[]>([]);
  readonly recognizedSpeech = signal('');
  readonly isListening = signal(false);
  readonly userAudioUrl = signal<string | null>(null);

  readonly circleCircumference = 2 * Math.PI * 40;
  readonly minScore = MIN_PRONUN_SCORE;

  // Phase order exported for template iteration
  readonly phaseOrder = PHASE_ORDER;

  // Drill step metadata for overview display
  readonly drillSteps = [
    { phase: 'mcq_vi_to_en', icon: '🇻🇳', label: 'Dịch VI→EN' },
    { phase: 'pronounce_part1', icon: '🎤', label: 'Phát âm cụm' },
    { phase: 'mcq_en_to_vi', icon: '🇬🇧', label: 'Dịch EN→VI' },
    { phase: 'pronounce_part2', icon: '🔁', label: 'Phát âm lại' },
    { phase: 'listen_repeat', icon: '👂', label: 'Nghe & lặp' },
    { phase: 'fill_blank', icon: '✏️', label: 'Điền khuyết' },
  ];

  private speechSub?: Subscription;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];

  // ----- Computed -----
  readonly currentChunk = computed<ScenarioChunk | null>(() => {
    const s = this.scenario();
    if (!s || !s.chunks || s.chunks.length === 0) return null;
    const idx = this.drillChunkIdx();
    return s.chunks[idx] ?? s.chunks[0];
  });

  readonly ipaTranscript = computed(() => {
    const chunk = this.currentChunk();
    return chunk ? getIpaPhonetic(chunk.text) : '';
  });

  readonly ipaOfExample = computed(() => {
    const chunk = this.currentChunk();
    return chunk ? getIpaPhonetic(chunk.exampleSentence) : '';
  });

  readonly scoreColor = computed(() => {
    const score = this.pronunciationScore();
    if (score === null) return '#286FB4';
    if (score >= 70) return '#16a34a';
    if (score >= MIN_PRONUN_SCORE) return '#f59e0b';
    return '#dc2626';
  });

  readonly circleDashOffset = computed(() => {
    const score = this.pronunciationScore();
    if (score === null) return this.circleCircumference;
    return this.circleCircumference * (1 - score / 100);
  });

  readonly canAdvancePronun = computed(() => {
    const score = this.pronunciationScore();
    return score !== null && score >= MIN_PRONUN_SCORE;
  });

  readonly isLastChunk = computed(() => {
    const s = this.scenario();
    if (!s) return false;
    return this.drillChunkIdx() === s.chunks.length - 1;
  });

  readonly overallProgressPct = computed(() => {
    const s = this.scenario();
    if (!s || s.chunks.length === 0) return 0;
    const totalPhases = PHASE_ORDER.length;
    const totalSteps = s.chunks.length * totalPhases;
    const doneSteps = this.drillChunkIdx() * totalPhases + PHASE_ORDER.indexOf(this.currentPhase());
    return Math.round((doneSteps / totalSteps) * 100);
  });

  readonly phaseLabel = computed(() => {
    const labels: Record<DrillPhase, string> = {
      mcq_vi_to_en: 'Dịch VI→EN',
      pronounce_part1: 'Phát âm',
      mcq_en_to_vi: 'Dịch EN→VI',
      pronounce_part2: 'Phát âm lại',
      listen_repeat: 'Nghe & lặp',
      fill_blank: 'Điền khuyết',
    };
    return labels[this.currentPhase()];
  });

  readonly fillBlankSentence = computed(() => {
    const chunk = this.currentChunk();
    if (!chunk) return '';
    const ex = chunk.exampleSentence;
    const txt = chunk.text;
    const idx = ex.toLowerCase().indexOf(txt.toLowerCase());
    if (idx === -1) {
      // Replace first few words with blanks
      return ex.replace(/\b\w+\b/g, (_, i) => (i < txt.split(' ').length * 4 ? '___' : _));
    }
    const blanks = txt
      .split(' ')
      .map(() => '___')
      .join(' ');
    return ex.substring(0, idx) + blanks + ex.substring(idx + txt.length);
  });

  readonly mcqSentenceHtml = computed((): SafeHtml => {
    const chunk = this.currentChunk();
    if (!chunk) return '';
    if (this.currentPhase() === 'mcq_vi_to_en') {
      // Show VI sentence with the main VI meaning bolded
      const html = `<span class="text-slate-400">${chunk.meaningVi.replace(
        chunk.meaningVi,
        `<strong class="text-slate-900">${chunk.meaningVi}</strong>`,
      )}</span>`;
      return this.sanitizer.bypassSecurityTrustHtml(
        `<strong class="text-slate-900 text-lg">${chunk.meaningVi}</strong>`,
      );
    } else {
      // Show EN chunk bolded
      return this.sanitizer.bypassSecurityTrustHtml(
        `<strong class="text-[#286FB4] text-lg">${chunk.text}</strong>`,
      );
    }
  });

  // ----- Lifecycle -----
  ngOnInit(): void {
    this.loadScenario();
    this.speechSub = this.speechService.speechResult$.subscribe((res) => {
      this.handleSpokenResult(res.text);
    });
  }

  ngOnDestroy(): void {
    this.speechSub?.unsubscribe();
    this.stopMediaRecorder();
    if (this.userAudioUrl()) {
      URL.revokeObjectURL(this.userAudioUrl()!);
    }
  }

  // ----- Data loading -----
  loadScenario(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const paramId = this.route.snapshot.paramMap.get('id') || 'supermarket-shopping';
    this.scenarioService.getScenario(paramId).subscribe({
      next: (data) => {
        this.scenario.set(data);
        if (data.practicedChunks) {
          this.practicedChunkIds.set(new Set(data.practicedChunks));
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Không thể tải thông tin tình huống.');
        this.isLoading.set(false);
      },
    });
  }

  // ----- Drill flow -----
  startDrillFlow(): void {
    this.drillChunkIdx.set(0);
    this.currentPhase.set('mcq_vi_to_en');
    this.resetPhaseState();
    this.stage.set('interactive_drill');
    this.buildMcqForCurrentPhase();
  }

  /** Reset all per-phase state */
  private resetPhaseState(): void {
    this.pronunciationScore.set(null);
    this.evaluatedWordTokens.set([]);
    this.recognizedSpeech.set('');
    this.isListening.set(false);
    this.mcqAnswered.set(false);
    this.mcqCorrect.set(false);
    this.mcqCorrectText.set('');
    this.selectedMcqIdx.set(null);
    if (this.userAudioUrl()) {
      URL.revokeObjectURL(this.userAudioUrl()!);
      this.userAudioUrl.set(null);
    }
    this.stopMediaRecorder();
  }

  private buildMcqForCurrentPhase(): void {
    const chunk = this.currentChunk();
    if (!chunk) return;
    if (this.currentPhase() === 'mcq_vi_to_en') {
      // Correct = chunk.text; distractors = chunk.distractorsEn
      const distractors = (chunk.distractorsEn && chunk.distractorsEn.length > 0)
        ? chunk.distractorsEn
        : ['I want to...', 'Could I have...', 'Let me...'];
      const opts = buildMcqOptions(chunk.text, distractors);
      this.mcqOptions.set(opts);
      this.mcqCorrectText.set(chunk.text);
    } else if (this.currentPhase() === 'mcq_en_to_vi') {
      // Correct = chunk.meaningVi; distractors = chunk.distractorsVi
      const distractors = (chunk.distractorsVi && chunk.distractorsVi.length > 0)
        ? chunk.distractorsVi
        : ['Tôi muốn...', 'Hãy giúp tôi...', 'Có thể cho tôi...'];
      const opts = buildMcqOptions(chunk.meaningVi, distractors);
      this.mcqOptions.set(opts);
      this.mcqCorrectText.set(chunk.meaningVi);
    }
  }

  selectMcqOption(opt: { text: string; correct: boolean }): void {
    if (this.mcqAnswered()) return;
    this.mcqAnswered.set(true);
    this.mcqCorrect.set(opt.correct);
  }

  getMcqOptionClass(opt: { text: string; correct: boolean }, idx: number): string {
    const answered = this.mcqAnswered();
    if (!answered) {
      return 'bg-white border-slate-200 text-slate-800 hover:border-[#286FB4] hover:bg-sky-50';
    }
    if (opt.correct) {
      return 'bg-emerald-50 border-emerald-400 text-emerald-800';
    }
    // wrong selected or just wrong
    return 'bg-rose-50 border-rose-200 text-rose-400';
  }

  mcqOptionLetter(idx: number): string {
    return ['A', 'B', 'C', 'D'][idx] ?? String(idx + 1);
  }

  phaseCompleted(phaseIdx: number): boolean {
    const currentIdx = PHASE_ORDER.indexOf(this.currentPhase());
    return phaseIdx < currentIdx;
  }

  /** Advance to next phase or next chunk */
  advancePhase(): void {
    const currentIdx = PHASE_ORDER.indexOf(this.currentPhase());
    if (currentIdx < PHASE_ORDER.length - 1) {
      // next phase
      const nextPhase = PHASE_ORDER[currentIdx + 1];
      this.currentPhase.set(nextPhase);
      this.resetPhaseState();
      this.buildMcqForCurrentPhase();
      // Auto-play TTS for pronunciation phases
      if (nextPhase === 'pronounce_part1' || nextPhase === 'pronounce_part2') {
        const chunk = this.currentChunk();
        if (chunk) {
          setTimeout(() => this.playAudio(chunk.text, chunk.audioUrl, false), 400);
        }
      } else if (nextPhase === 'listen_repeat') {
        const chunk = this.currentChunk();
        if (chunk) {
          setTimeout(() => this.playAudio(chunk.exampleSentence, chunk.audioUrl, false), 400);
        }
      }
    } else {
      // All 6 phases done for this chunk
      const s = this.scenario();
      if (!s) return;
      const chunk = this.currentChunk();
      if (chunk) {
        this.practicedChunkIds.update((set) => new Set([...set, chunk.id]));
        this.scenarioService.recordDrill(s.id, { chunkId: chunk.id, isSkipped: false }).subscribe();
      }
      if (this.drillChunkIdx() < s.chunks.length - 1) {
        // next chunk
        this.drillChunkIdx.update((i) => i + 1);
        this.currentPhase.set('mcq_vi_to_en');
        this.resetPhaseState();
        this.buildMcqForCurrentPhase();
      } else {
        // All chunks done!
        this.stage.set('summary_ready');
      }
    }
  }

  skipPronun(): void {
    const s = this.scenario();
    const chunk = this.currentChunk();
    if (s && chunk) {
      this.scenarioService.recordDrill(s.id, { chunkId: chunk.id, isSkipped: true }).subscribe();
    }
    this.advancePhase();
  }

  // ----- Speech recognition -----
  handleSpokenResult(spokenText: string): void {
    this.recognizedSpeech.set(spokenText);
    this.isListening.set(false);

    const chunk = this.currentChunk();
    if (!chunk) return;

    const target =
      this.currentPhase() === 'listen_repeat' ? chunk.exampleSentence : chunk.text;
    const evaluation = evaluatePronunciation(target, spokenText);
    this.pronunciationScore.set(evaluation.score);
    this.evaluatedWordTokens.set(evaluation.words);
  }

  toggleMicrophone(): void {
    if (this.isListening()) {
      this.speechService.stopListening();
      this.isListening.set(false);
      this.stopMediaRecorder();
    } else {
      this.recognizedSpeech.set('');
      this.pronunciationScore.set(null);
      this.evaluatedWordTokens.set([]);
      if (this.userAudioUrl()) {
        URL.revokeObjectURL(this.userAudioUrl()!);
        this.userAudioUrl.set(null);
      }
      this.isListening.set(true);
      this.startMediaRecorder();
      this.speechService.startListening('en-US').catch(() => {
        this.isListening.set(false);
        this.stopMediaRecorder();
      });
    }
  }

  private startMediaRecorder(): void {
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        this.userAudioUrl.set(url);
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
      };
      this.mediaRecorder.start();
    }).catch(() => {
      // Microphone permission denied — silently ignore (STT will fail too)
    });
  }

  private stopMediaRecorder(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  // ----- Audio -----
  playAudio(text: string, audioUrl?: string | null, slow = false): void {
    this.scenarioService.playChunkAudio(text, audioUrl, slow);
  }

  // ----- Helpers -----
  getTagMeta(tag: string) {
    return FUNCTIONAL_TAG_CONFIG[tag] || { label: tag, color: '#286FB4', bg: '#E2F0F9' };
  }

  isBookmarked(chunkId: string): boolean {
    return this.bookmarkedChunkIds().has(chunkId);
  }

  toggleBookmark(chunkId: string): void {
    this.bookmarkedChunkIds.update((set) => {
      const next = new Set(set);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }

  isChunkPracticed(chunkId: string): boolean {
    return this.practicedChunkIds().has(chunkId);
  }

  // ----- Roleplay -----
  startRoleplay(): void {
    const s = this.scenario();
    if (!s) return;
    this.isStartingRoleplay.set(true);
    this.scenarioService.startRoleplay(s.id).subscribe({
      next: (res) => {
        this.isStartingRoleplay.set(false);
        this.router.navigate(['/scenario-roleplay', res.sessionId], {
          state: { scenario: s, roleplaySession: res },
          queryParams: { scenarioId: s.id },
        });
      },
      error: () => {
        this.isStartingRoleplay.set(false);
        this.errorMessage.set('Không thể khởi tạo phiên Roleplay. Vui lòng thử lại.');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/scenarios']);
  }
}
