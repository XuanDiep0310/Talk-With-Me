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

export type DrillPhase =
  | 'mcq_vi_to_en'
  | 'pronounce_chunk'
  | 'mcq_en_to_vi'
  | 'listen_repeat'
  | 'fill_blank';

export type CoachStage = 'overview' | 'interactive_drill' | 'summary_ready';

const PHASE_ORDER: DrillPhase[] = [
  'mcq_vi_to_en',
  'pronounce_chunk',
  'mcq_en_to_vi',
  'listen_repeat',
  'fill_blank',
];

const MIN_PRONUN_SCORE = 50;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMcqOptions(correct: string, distractors: string[]): { text: string; correct: boolean }[] {
  const pool = distractors.slice(0, 3);
  return shuffle([
    { text: correct, correct: true },
    ...pool.map((t) => ({ text: t, correct: false })),
  ]);
}

@Component({
  selector: 'app-scenario-detail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[#F8FAFC] pb-16 text-slate-800">
      @if (isLoading()) {
        <div class="py-32 flex flex-col items-center justify-center text-slate-400">
          <div class="w-10 h-10 border-4 border-slate-200 border-t-[#286FB4] rounded-full animate-spin mb-3"></div>
          <p class="text-sm font-medium">Đang tải bài học...</p>
        </div>
      } @else if (errorMessage()) {
        <div class="max-w-md mx-auto mt-16 p-6 rounded-2xl bg-white border border-rose-200 text-center shadow-sm">
          <p class="text-sm font-semibold text-rose-600 mb-4">{{ errorMessage() }}</p>
          <button type="button" class="btn-secondary cursor-pointer" (click)="loadScenario()">
            Thử lại
          </button>
        </div>
      } @else {
        @if (scenario(); as s) {

          <!-- ============================================================== -->
          <!-- SCREEN 1: THE COACH OVERVIEW                                   -->
          <!-- ============================================================== -->
          @if (stage() === 'overview') {
            <div class="max-w-lg mx-auto px-4 pt-6 space-y-6">
              <!-- Top bar -->
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Quay lại"
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-xs border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  (click)="goBack()"
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div class="text-xs font-semibold text-slate-500">
                  {{ s.chunks.length }} cụm cần nhớ
                </div>
              </div>

              <!-- Question & Context Header -->
              <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-2">
                <div class="text-xs font-bold uppercase tracking-wider text-[#286FB4]">
                  Để trả lời câu hỏi:
                </div>
                <h1 class="text-xl md:text-2xl font-extrabold text-slate-900 leading-snug">
                  {{ s.titleEn }}
                </h1>
                <p class="text-sm text-slate-500 font-medium">
                  {{ s.titleVi }}
                </p>
              </div>

              <!-- Chunks List -->
              <div class="space-y-3">
                <div class="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  Bạn cần nhớ các cụm sau:
                </div>

                <div class="space-y-2.5">
                  @for (c of s.chunks; track c.id) {
                    <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-[#286FB4]/40 transition flex items-center gap-3.5">
                      <button
                        type="button"
                        class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-sky-50 text-[#286FB4] hover:bg-sky-100 transition cursor-pointer"
                        title="Nghe phát âm mẫu"
                        (click)="playAudio(c.text, c.audioUrl)"
                      >
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </button>

                      <div class="flex-1 min-w-0">
                        <div class="text-base font-bold text-slate-900 leading-snug">
                          {{ c.text }}
                        </div>
                        <div class="text-xs text-slate-500 mt-0.5 font-medium">
                          {{ c.meaningVi }}
                        </div>
                      </div>

                      @if (isChunkPracticed(c.id)) {
                        <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
                          ✓
                        </span>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Start Button -->
              <div class="pt-4 pb-8">
                <button
                  type="button"
                  class="w-full py-4 rounded-2xl text-white font-extrabold text-base bg-[#286FB4] hover:bg-[#1d5a94] active:scale-[0.99] shadow-lg shadow-[#286FB4]/25 transition cursor-pointer"
                  (click)="startDrillFlow()"
                >
                  Bắt đầu nạp cụm
                </button>
              </div>
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 2: INTERACTIVE DRILL (THE COACH STYLE)                  -->
          <!-- ============================================================== -->
          @if (stage() === 'interactive_drill') {
            <div class="max-w-lg mx-auto px-4 pt-4 flex flex-col min-h-[90vh]">

              <!-- Clean Top Bar -->
              <div class="flex items-center gap-3 mb-6">
                <button
                  type="button"
                  aria-label="Thoát"
                  class="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer text-lg font-bold"
                  (click)="stage.set('overview')"
                >
                  ✕
                </button>

                <!-- Thin Sleek Progress Bar -->
                <div class="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-[#286FB4] transition-all duration-300"
                    [style.width]="overallProgressPct() + '%'"
                  ></div>
                </div>

                <div class="text-xs font-bold text-slate-400">
                  {{ drillChunkIdx() + 1 }}/{{ s.chunks.length }}
                </div>
              </div>

              @if (currentChunk(); as chunk) {
                <div class="flex-1 flex flex-col justify-between space-y-5">

                  <!-- ---------------------------------------------------- -->
                  <!-- PHASE 1: MCQ VI -> EN (Dịch cụm in đậm)               -->
                  <!-- ---------------------------------------------------- -->
                  @if (currentPhase() === 'mcq_vi_to_en') {
                    <div class="space-y-6">
                      <div class="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Hãy dịch cụm in đậm
                      </div>

                      <!-- Question text -->
                      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs">
                        <div
                          class="text-lg md:text-xl font-medium text-slate-800 leading-relaxed"
                          [innerHTML]="mcqViSentenceHtml()"
                        ></div>
                      </div>

                      <!-- MCQ Options -->
                      <div class="space-y-3">
                        @for (opt of mcqOptions(); track opt.text; let i = $index) {
                          <button
                            type="button"
                            class="w-full text-left p-4 rounded-2xl border-2 font-bold text-base transition-all cursor-pointer flex items-center justify-between"
                            [class]="getMcqOptionClass(opt)"
                            (click)="selectMcqOption(opt)"
                            [disabled]="mcqAnswered()"
                          >
                            <span>{{ opt.text }}</span>
                            @if (mcqAnswered() && opt.correct) {
                              <span class="text-emerald-600 font-bold text-lg">✓</span>
                            }
                          </button>
                        }
                      </div>
                    </div>
                  }

                  <!-- ---------------------------------------------------- -->
                  <!-- PHASE 2: PRONOUNCE CHUNK (Hãy nói cụm sau)            -->
                  <!-- ---------------------------------------------------- -->
                  @if (currentPhase() === 'pronounce_chunk') {
                    <div class="space-y-5 text-center">
                      <div class="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Hãy nói cụm sau
                      </div>

                      <!-- Circular Pronunciation Score Meter -->
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
                          <span class="text-[9px] uppercase font-bold text-slate-400 mt-1">
                            {{ pronunciationScore() !== null ? 'Điểm phát âm' : 'Chưa nói' }}
                          </span>
                        </div>
                      </div>

                      <!-- Chunk Card -->
                      <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
                        <div class="text-2xl font-extrabold text-slate-900 leading-snug">
                          @if (evaluatedWordTokens().length > 0 && pronunciationScore() !== null) {
                            <div class="flex flex-wrap gap-1.5 justify-center">
                              @for (w of evaluatedWordTokens(); track $index) {
                                <span
                                  class="transition-colors"
                                  [class.text-emerald-600]="w.status === 'correct'"
                                  [class.text-amber-500]="w.status === 'imperfect'"
                                  [class.text-rose-500]="w.status === 'missing'"
                                >{{ w.word }}</span>
                              }
                            </div>
                          } @else {
                            {{ chunk.text }}
                          }
                        </div>

                        <div class="text-xs text-slate-400 font-mono tracking-wide">
                          {{ ipaTranscript() }}
                        </div>

                        <div class="text-sm text-slate-500 font-medium pt-1">
                          {{ chunk.meaningVi }}
                        </div>

                        <!-- Listen Sample Button -->
                        <div class="pt-1">
                          <button
                            type="button"
                            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                            (click)="playAudio(chunk.text, chunk.audioUrl)"
                          >
                            <svg class="w-4 h-4 text-[#286FB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            Nghe mẫu
                          </button>
                        </div>
                      </div>

                      <!-- Recognized Speech Transcript Display -->
                      @if (recognizedSpeech()) {
                        <div class="bg-white rounded-2xl p-3.5 border border-slate-200 text-left space-y-1 shadow-xs">
                          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bạn đã nói:</div>
                          <div class="text-sm font-semibold text-slate-800">
                            "{{ recognizedSpeech() }}"
                          </div>
                        </div>
                      }

                      <!-- Center Microphone & Playback -->
                      <div class="py-2 flex flex-col items-center justify-center space-y-3">
                        <button
                          type="button"
                          class="w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xl relative"
                          [class]="isListening() ? 'bg-rose-500 text-white scale-110 shadow-rose-300 ring-4 ring-rose-200 animate-pulse' : 'bg-[#286FB4] text-white hover:bg-[#1d5a94] shadow-[#286FB4]/30 active:scale-95'"
                          (click)="toggleMicrophone()"
                        >
                          @if (isListening()) {
                            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                          } @else {
                            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v7.5a3 3 0 0 1-3 3z" />
                            </svg>
                          }
                        </button>
                        <span class="text-xs text-slate-400 font-medium">
                          {{ isListening() ? 'Đang lắng nghe bạn nói...' : 'Nhấn vào micro để nói' }}
                        </span>

                        <!-- User Audio Playback Button -->
                        @if (userAudioUrl()) {
                          <div class="pt-1">
                            <button
                              type="button"
                              class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer shadow-xs"
                              (click)="playUserAudio()"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              </svg>
                              Nghe lại giọng của bạn
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- ---------------------------------------------------- -->
                  <!-- PHASE 3: MCQ EN -> VI (Dịch cụm in đậm)               -->
                  <!-- ---------------------------------------------------- -->
                  @if (currentPhase() === 'mcq_en_to_vi') {
                    <div class="space-y-6">
                      <div class="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Hãy dịch cụm in đậm
                      </div>

                      <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs">
                        <div
                          class="text-lg md:text-xl font-medium text-slate-800 leading-relaxed"
                          [innerHTML]="mcqEnSentenceHtml()"
                        ></div>
                      </div>

                      <div class="space-y-3">
                        @for (opt of mcqOptions(); track opt.text; let i = $index) {
                          <button
                            type="button"
                            class="w-full text-left p-4 rounded-2xl border-2 font-bold text-base transition-all cursor-pointer flex items-center justify-between"
                            [class]="getMcqOptionClass(opt)"
                            (click)="selectMcqOption(opt)"
                            [disabled]="mcqAnswered()"
                          >
                            <span>{{ opt.text }}</span>
                            @if (mcqAnswered() && opt.correct) {
                              <span class="text-emerald-600 font-bold text-lg">✓</span>
                            }
                          </button>
                        }
                      </div>
                    </div>
                  }

                  <!-- ---------------------------------------------------- -->
                  <!-- PHASE 4: LISTEN & REPEAT FULL SENTENCE                -->
                  <!-- ---------------------------------------------------- -->
                  @if (currentPhase() === 'listen_repeat') {
                    <div class="space-y-5 text-center">
                      <div class="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Nghe mình nói và đọc lại
                      </div>

                      <!-- Circular Pronunciation Score Meter -->
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
                          <span class="text-[9px] uppercase font-bold text-slate-400 mt-1">
                            {{ pronunciationScore() !== null ? 'Điểm phát âm' : 'Chưa nói' }}
                          </span>
                        </div>
                      </div>

                      <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-2">
                        <div class="text-xl md:text-2xl font-extrabold text-slate-900 leading-snug">
                          @if (evaluatedWordTokens().length > 0 && pronunciationScore() !== null) {
                            <div class="flex flex-wrap gap-1.5 justify-center">
                              @for (w of evaluatedWordTokens(); track $index) {
                                <span
                                  class="transition-colors"
                                  [class.text-emerald-600]="w.status === 'correct'"
                                  [class.text-amber-500]="w.status === 'imperfect'"
                                  [class.text-rose-500]="w.status === 'missing'"
                                >{{ w.word }}</span>
                              }
                            </div>
                          } @else {
                            {{ chunk.exampleSentence }}
                          }
                        </div>

                        <div class="text-sm text-slate-500 font-medium pt-1">
                          {{ chunk.meaningVi }}
                        </div>

                        <div class="pt-1">
                          <button
                            type="button"
                            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                            (click)="playAudio(chunk.exampleSentence, chunk.audioUrl)"
                          >
                            <svg class="w-4 h-4 text-[#286FB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            Nghe mẫu
                          </button>
                        </div>
                      </div>

                      @if (recognizedSpeech()) {
                        <div class="bg-white rounded-2xl p-3.5 border border-slate-200 text-left space-y-1 shadow-xs">
                          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bạn đã nói:</div>
                          <div class="text-sm font-semibold text-slate-800">
                            "{{ recognizedSpeech() }}"
                          </div>
                        </div>
                      }

                      <div class="py-2 flex flex-col items-center justify-center space-y-3">
                        <button
                          type="button"
                          class="w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xl relative"
                          [class]="isListening() ? 'bg-rose-500 text-white scale-110 ring-4 ring-rose-200 animate-pulse' : 'bg-[#286FB4] text-white hover:bg-[#1d5a94] shadow-[#286FB4]/30 active:scale-95'"
                          (click)="toggleMicrophone()"
                        >
                          @if (isListening()) {
                            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                          } @else {
                            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v7.5a3 3 0 0 1-3 3z" />
                            </svg>
                          }
                        </button>
                        <span class="text-xs text-slate-400 font-medium">
                          {{ isListening() ? 'Đang lắng nghe bạn nói...' : 'Nhấn vào micro để nói' }}
                        </span>

                        @if (userAudioUrl()) {
                          <div class="pt-1">
                            <button
                              type="button"
                              class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer shadow-xs"
                              (click)="playUserAudio()"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              </svg>
                              Nghe lại giọng của bạn
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- ---------------------------------------------------- -->
                  <!-- PHASE 5: FILL IN THE BLANK                            -->
                  <!-- ---------------------------------------------------- -->
                  @if (currentPhase() === 'fill_blank') {
                    <div class="space-y-5 text-center">
                      <div class="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Nói cụm còn thiếu
                      </div>

                      <!-- Circular Pronunciation Score Meter -->
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
                          <span class="text-[9px] uppercase font-bold text-slate-400 mt-1">
                            {{ pronunciationScore() !== null ? 'Điểm phát âm' : 'Chưa nói' }}
                          </span>
                        </div>
                      </div>

                      <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
                        <div class="text-lg md:text-xl font-extrabold text-slate-900 tracking-wide leading-relaxed">
                          @if (evaluatedWordTokens().length > 0 && pronunciationScore() !== null) {
                            <div class="flex flex-wrap gap-1.5 justify-center">
                              @for (w of evaluatedWordTokens(); track $index) {
                                <span
                                  class="transition-colors"
                                  [class.text-emerald-600]="w.status === 'correct'"
                                  [class.text-amber-500]="w.status === 'imperfect'"
                                  [class.text-rose-500]="w.status === 'missing'"
                                >{{ w.word }}</span>
                              }
                            </div>
                          } @else {
                            {{ fillBlankSentence() }}
                          }
                        </div>

                        <div class="text-sm text-slate-500 font-medium">
                          {{ chunk.meaningVi }}
                        </div>
                      </div>

                      @if (recognizedSpeech()) {
                        <div class="bg-white rounded-2xl p-3.5 border border-slate-200 text-left space-y-1 shadow-xs">
                          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bạn đã nói:</div>
                          <div class="text-sm font-semibold text-slate-800">
                            "{{ recognizedSpeech() }}"
                          </div>
                        </div>
                      }

                      <div class="py-2 flex flex-col items-center justify-center space-y-3">
                        <button
                          type="button"
                          class="w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xl relative"
                          [class]="isListening() ? 'bg-rose-500 text-white scale-110 ring-4 ring-rose-200 animate-pulse' : 'bg-[#286FB4] text-white hover:bg-[#1d5a94] shadow-[#286FB4]/30 active:scale-95'"
                          (click)="toggleMicrophone()"
                        >
                          @if (isListening()) {
                            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                          } @else {
                            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v7.5a3 3 0 0 1-3 3z" />
                            </svg>
                          }
                        </button>
                        <span class="text-xs text-slate-400 font-medium">
                          {{ isListening() ? 'Đang lắng nghe bạn nói...' : 'Nói hoàn thiện cả câu' }}
                        </span>

                        @if (userAudioUrl()) {
                          <div class="pt-1">
                            <button
                              type="button"
                              class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer shadow-xs"
                              (click)="playUserAudio()"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              </svg>
                              Nghe lại giọng của bạn
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Bottom Navigation CTA -->
                  <div class="pt-6 pb-6">
                    @if (isMcqPhase()) {
                      @if (mcqAnswered()) {
                        <button
                          type="button"
                          class="w-full py-4 rounded-2xl text-white font-extrabold text-base bg-[#286FB4] hover:bg-[#1d5a94] shadow-lg shadow-[#286FB4]/25 transition cursor-pointer"
                          (click)="advancePhase()"
                        >
                          Tiếp tục
                        </button>
                      }
                    } @else {
                      <div class="space-y-2">
                        <button
                          type="button"
                          class="w-full py-4 rounded-2xl font-extrabold text-base transition-all cursor-pointer shadow-lg"
                          [class]="canAdvanceVoice() ? 'bg-[#286FB4] text-white hover:bg-[#1d5a94] shadow-[#286FB4]/25' : 'bg-slate-200 text-slate-400 cursor-not-allowed'"
                          [disabled]="!canAdvanceVoice()"
                          (click)="advancePhase()"
                        >
                          {{ isLastStep() ? 'Hoàn thành' : 'Tiếp tục' }}
                        </button>

                        <div class="text-center">
                          <button
                            type="button"
                            class="text-xs text-slate-400 hover:text-slate-600 font-medium py-1 cursor-pointer"
                            (click)="skipVoiceStep()"
                          >
                            Bỏ qua câu này
                          </button>
                        </div>
                      </div>
                    }
                  </div>

                </div>
              }
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 3: CELEBRATION & READY TO ROLEPLAY                      -->
          <!-- ============================================================== -->
          @if (stage() === 'summary_ready') {
            <div class="max-w-md mx-auto px-4 pt-16 text-center space-y-6">
              <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl font-bold shadow-xs">
                ✓
              </div>

              <div class="space-y-1">
                <h2 class="text-2xl font-extrabold text-slate-900">
                  Hoàn thành nạp cụm
                </h2>
                <p class="text-xs text-slate-500">
                  Bạn đã sẵn sàng để áp dụng vào hội thoại thực tế.
                </p>
              </div>

              <!-- Mastered Chunks List -->
              <div class="bg-white rounded-3xl p-5 border border-slate-200/90 text-left space-y-3 shadow-xs">
                @for (c of s.chunks; track c.id) {
                  <div class="flex items-center gap-3 text-sm">
                    <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
                      ✓
                    </span>
                    <span class="font-bold text-slate-900">{{ c.text }}</span>
                    <span class="text-xs text-slate-400 truncate">— {{ c.meaningVi }}</span>
                  </div>
                }
              </div>

              <!-- Action buttons -->
              <div class="space-y-3 pt-4">
                <button
                  type="button"
                  class="w-full py-4 rounded-2xl bg-[#286FB4] hover:bg-[#1d5a94] text-white font-extrabold text-base shadow-lg shadow-[#286FB4]/25 transition cursor-pointer"
                  [disabled]="isStartingRoleplay()"
                  (click)="startRoleplay()"
                >
                  {{ isStartingRoleplay() ? 'Đang tạo phòng...' : 'Vào hội thoại thực hành' }}
                </button>
                <button
                  type="button"
                  class="w-full py-3 text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                  (click)="stage.set('overview')"
                >
                  Xem lại danh sách cụm
                </button>
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

  readonly stage = signal<CoachStage>('overview');
  readonly drillChunkIdx = signal(0);
  readonly currentPhase = signal<DrillPhase>('mcq_vi_to_en');

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isStartingRoleplay = signal(false);
  readonly scenario = signal<ScenarioDetail | null>(null);
  readonly practicedChunkIds = signal<Set<string>>(new Set());

  // MCQ state
  readonly mcqOptions = signal<{ text: string; correct: boolean }[]>([]);
  readonly mcqAnswered = signal(false);
  readonly selectedOption = signal<{ text: string; correct: boolean } | null>(null);

  // Pronunciation & Recording state
  readonly circleCircumference = 2 * Math.PI * 40;
  readonly pronunciationScore = signal<number | null>(null);
  readonly evaluatedWordTokens = signal<WordPronunciationScore[]>([]);
  readonly recognizedSpeech = signal('');
  readonly isListening = signal(false);
  readonly userAudioUrl = signal<string | null>(null);

  private speechSub?: Subscription;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];

  readonly currentChunk = computed<ScenarioChunk | null>(() => {
    const s = this.scenario();
    if (!s || !s.chunks || s.chunks.length === 0) return null;
    return s.chunks[this.drillChunkIdx()] ?? s.chunks[0];
  });

  readonly ipaTranscript = computed(() => {
    const chunk = this.currentChunk();
    return chunk ? `/${getIpaPhonetic(chunk.text)}/` : '';
  });

  readonly isMcqPhase = computed(() => {
    const p = this.currentPhase();
    return p === 'mcq_vi_to_en' || p === 'mcq_en_to_vi';
  });

  readonly canAdvanceVoice = computed(() => {
    const score = this.pronunciationScore();
    return score !== null && score >= MIN_PRONUN_SCORE;
  });

  readonly isLastStep = computed(() => {
    const s = this.scenario();
    if (!s) return false;
    return (
      this.drillChunkIdx() === s.chunks.length - 1 &&
      this.currentPhase() === PHASE_ORDER[PHASE_ORDER.length - 1]
    );
  });

  readonly overallProgressPct = computed(() => {
    const s = this.scenario();
    if (!s || s.chunks.length === 0) return 0;
    const totalSteps = s.chunks.length * PHASE_ORDER.length;
    const currentStep = this.drillChunkIdx() * PHASE_ORDER.length + PHASE_ORDER.indexOf(this.currentPhase());
    return Math.round((currentStep / totalSteps) * 100);
  });

  readonly scoreColor = computed(() => {
    const score = this.pronunciationScore();
    if (score === null) return '#94a3b8';
    if (score >= 75) return '#16a34a';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  });

  readonly circleDashOffset = computed(() => {
    const score = this.pronunciationScore();
    if (score === null) return this.circleCircumference;
    return this.circleCircumference * (1 - score / 100);
  });

  readonly fillBlankSentence = computed(() => {
    const chunk = this.currentChunk();
    if (!chunk) return '';
    const ex = chunk.exampleSentence;
    const txt = chunk.text;
    const idx = ex.toLowerCase().indexOf(txt.toLowerCase());
    if (idx === -1) {
      return txt
        .split(' ')
        .map(() => '------')
        .join(' ');
    }
    const dashes = txt
      .split(' ')
      .map(() => '------')
      .join(' ');
    return ex.substring(0, idx) + dashes + ex.substring(idx + txt.length);
  });

  readonly mcqViSentenceHtml = computed((): SafeHtml => {
    const chunk = this.currentChunk();
    if (!chunk) return '';
    return this.sanitizer.bypassSecurityTrustHtml(
      `<strong>${chunk.meaningVi}</strong>`,
    );
  });

  readonly mcqEnSentenceHtml = computed((): SafeHtml => {
    const chunk = this.currentChunk();
    if (!chunk) return '';
    return this.sanitizer.bypassSecurityTrustHtml(
      `<strong>${chunk.text}</strong>`,
    );
  });

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
        this.errorMessage.set('Không thể tải thông tin bài học.');
        this.isLoading.set(false);
      },
    });
  }

  startDrillFlow(): void {
    this.drillChunkIdx.set(0);
    this.currentPhase.set('mcq_vi_to_en');
    this.resetPhaseState();
    this.stage.set('interactive_drill');
    this.buildMcqOptions();
  }

  private resetPhaseState(): void {
    this.pronunciationScore.set(null);
    this.evaluatedWordTokens.set([]);
    this.recognizedSpeech.set('');
    this.isListening.set(false);
    this.mcqAnswered.set(false);
    this.selectedOption.set(null);
    if (this.userAudioUrl()) {
      URL.revokeObjectURL(this.userAudioUrl()!);
      this.userAudioUrl.set(null);
    }
    this.stopMediaRecorder();
  }

  private buildMcqOptions(): void {
    const chunk = this.currentChunk();
    if (!chunk) return;
    if (this.currentPhase() === 'mcq_vi_to_en') {
      const distractors = chunk.distractorsEn?.length ? chunk.distractorsEn : ['I work there for', 'I am working at', 'I have worked'];
      this.mcqOptions.set(buildMcqOptions(chunk.text, distractors));
    } else if (this.currentPhase() === 'mcq_en_to_vi') {
      const distractors = chunk.distractorsVi?.length ? chunk.distractorsVi : ['Tôi làm việc ở đó', 'Tôi từng ở đó', 'Tôi đang đến đó'];
      this.mcqOptions.set(buildMcqOptions(chunk.meaningVi, distractors));
    }
  }

  selectMcqOption(opt: { text: string; correct: boolean }): void {
    if (this.mcqAnswered()) return;
    this.selectedOption.set(opt);
    this.mcqAnswered.set(true);
  }

  getMcqOptionClass(opt: { text: string; correct: boolean }): string {
    const answered = this.mcqAnswered();
    const selected = this.selectedOption();
    if (!answered) {
      return 'bg-white border-slate-200 text-slate-800 hover:border-[#286FB4] hover:bg-sky-50/50';
    }
    if (opt.correct) {
      return 'bg-emerald-50 border-emerald-500 text-emerald-900';
    }
    if (selected === opt && !opt.correct) {
      return 'bg-rose-50 border-rose-400 text-rose-800';
    }
    return 'bg-slate-50 border-slate-200 text-slate-400';
  }

  advancePhase(): void {
    const currentIdx = PHASE_ORDER.indexOf(this.currentPhase());
    if (currentIdx < PHASE_ORDER.length - 1) {
      const nextPhase = PHASE_ORDER[currentIdx + 1];
      this.currentPhase.set(nextPhase);
      this.resetPhaseState();
      this.buildMcqOptions();

      // Auto play audio once on listen_repeat or pronounce
      if (nextPhase === 'pronounce_chunk') {
        const c = this.currentChunk();
        if (c) setTimeout(() => this.playAudio(c.text, c.audioUrl), 300);
      } else if (nextPhase === 'listen_repeat') {
        const c = this.currentChunk();
        if (c) setTimeout(() => this.playAudio(c.exampleSentence, c.audioUrl), 300);
      }
    } else {
      // Chunk completed
      const s = this.scenario();
      const chunk = this.currentChunk();
      if (s && chunk) {
        this.practicedChunkIds.update((set) => new Set([...set, chunk.id]));
        this.scenarioService.recordDrill(s.id, { chunkId: chunk.id, isSkipped: false }).subscribe();
      }

      if (this.drillChunkIdx() < (s?.chunks.length ?? 0) - 1) {
        this.drillChunkIdx.update((i) => i + 1);
        this.currentPhase.set('mcq_vi_to_en');
        this.resetPhaseState();
        this.buildMcqOptions();
      } else {
        this.stage.set('summary_ready');
      }
    }
  }

  skipVoiceStep(): void {
    this.advancePhase();
  }

  handleSpokenResult(spokenText: string): void {
    this.recognizedSpeech.set(spokenText);
    this.isListening.set(false);
    const chunk = this.currentChunk();
    if (!chunk) return;

    let target = chunk.text;
    if (this.currentPhase() === 'listen_repeat' || this.currentPhase() === 'fill_blank') {
      target = chunk.exampleSentence;
    }

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
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          this.userAudioUrl.set(url);
          stream.getTracks().forEach((t) => t.stop());
        };
        this.mediaRecorder.start();
      })
      .catch(() => {
        // microphone error handled gracefully
      });
  }

  private stopMediaRecorder(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  playUserAudio(): void {
    const url = this.userAudioUrl();
    if (url) {
      const audio = new Audio(url);
      void audio.play().catch((err: unknown) => {
        console.debug('Failed to play user audio:', err);
      });
    }
  }

  playAudio(text: string, audioUrl?: string | null): void {
    this.scenarioService.playChunkAudio(text, audioUrl, false);
  }

  isChunkPracticed(chunkId: string): boolean {
    return this.practicedChunkIds().has(chunkId);
  }

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
