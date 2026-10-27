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
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppStateService } from '../../core/services/app-state.service';
import { SpeechRecognitionService } from '../../core/services/speech-recognition.service';
import {
  ScenarioService,
  ScenarioDetail,
  ScenarioChunk,
  ChunkFunctionalTag,
  evaluatePronunciation,
  getIpaPhonetic,
  WordPronunciationScore,
} from '../../core/services/scenario.service';

export type CoachStage = 'overview' | 'drill' | 'assemble' | 'complete';

const FUNCTIONAL_TAG_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  OPENING: { label: 'Mở đầu', color: '#286FB4', bg: '#E2F0F9' },
  REQUEST: { label: 'Yêu cầu', color: '#7c3aed', bg: '#F5F3FF' },
  CLARIFY: { label: 'Làm rõ', color: '#059669', bg: '#ECFDF5' },
  AGREE_DECLINE: { label: 'Đồng ý / Từ chối', color: '#f59e0b', bg: '#FFF5E5' },
  CLOSING: { label: 'Kết thúc', color: '#64748b', bg: '#F1F5F9' },
};

@Component({
  selector: 'app-scenario-detail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50/60 pb-12">
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
          <!-- SCREEN 1: OVERVIEW & "BẠN CẦN NHỚ CỤM SAU" (The Coach Style)   -->
          <!-- ============================================================== -->
          @if (stage() === 'overview') {
            <div class="max-w-2xl mx-auto px-4 pt-6 space-y-6">
              <!-- Header Bar -->
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Quay lại"
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  (click)="goBack()"
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-[#E2F0F9] text-[#286FB4]">
                    {{ s.level }}
                  </span>
                  <span class="text-xs text-slate-500 font-600">
                    ⏱ {{ s.estimatedDurationMinutes || 10 }} phút
                  </span>
                </div>
              </div>

              <!-- Question & Objective Card -->
              <div class="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                <div class="absolute -right-6 -bottom-6 w-32 h-32 bg-[#286FB4]/20 rounded-full blur-2xl"></div>
                <div class="text-[11px] font-extrabold uppercase tracking-widest text-sky-300 mb-1">
                  ĐỂ TRẢ LỜI CÂU HỎI
                </div>
                <h1 class="text-xl md:text-2xl font-800 leading-snug mb-2 font-extrabold">
                  {{ s.titleEn }}
                </h1>
                <p class="text-xs md:text-sm text-slate-300 font-500">
                  {{ s.titleVi }}
                </p>

                <!-- Context hint collapsible -->
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

              <!-- Section: BẠN CẦN NHỚ CỤM SAU -->
              <div class="space-y-3">
                <div class="flex items-center justify-between px-1">
                  <h2 class="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    BẠN CẦN NHỚ CỤM SAU ({{ s.chunks.length }})
                  </h2>
                  <span class="text-xs text-[#286FB4] font-700">
                    +{{ s.xpReward || 100 }} XP khi hoàn thành
                  </span>
                </div>

                <div class="space-y-3">
                  @for (c of s.chunks; track c.id) {
                    <div
                      class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-start gap-3.5"
                    >
                      <!-- Audio Speaker Button -->
                      <button
                        type="button"
                        class="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-[#E2F0F9] text-[#286FB4] hover:bg-sky-100 transition cursor-pointer"
                        title="Nghe phát âm chuẩn"
                        (click)="playAudio(c.text, c.audioUrl)"
                      >
                        🔊
                      </button>

                      <!-- Chunk details -->
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
                        <div class="text-[11px] text-slate-600 italic mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          💬 "{{ c.exampleSentence }}"
                        </div>
                      </div>

                      <!-- Bookmark & Mastery check -->
                      <div class="flex flex-col items-center gap-2 flex-shrink-0 pt-0.5">
                        <button
                          type="button"
                          class="text-lg transition cursor-pointer"
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

              <!-- Coach Alexander Card -->
              <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-[#286FB4] to-sky-400 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
                    🤖
                  </div>
                  <div>
                    <div class="text-sm font-bold text-slate-800">Thực hành cùng Alex (Coach)</div>
                    <div class="text-xs text-slate-500">Luyện nạp cụm & ghép câu phản xạ</div>
                  </div>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-[#E2F0F9] text-[#286FB4]">
                  Luyện tập ➔
                </span>
              </div>

              <!-- Sticky / Big Bottom Button -->
              <div class="pt-2 pb-6">
                <button
                  type="button"
                  class="w-full py-4 rounded-2xl text-white font-extrabold text-base bg-[#286FB4] hover:bg-[#1d5a94] shadow-lg shadow-[#286FB4]/25 transition cursor-pointer"
                  (click)="startDrillFlow()"
                >
                  Bắt đầu
                </button>
              </div>
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 2 & 3: "NẠP CỤM" (Pronunciation Score Meter + IPA)      -->
          <!-- ============================================================== -->
          @if (stage() === 'drill') {
            <div class="max-w-xl mx-auto px-4 pt-6 space-y-6">
              <!-- Top Stepper Bar -->
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Đóng"
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  (click)="stage.set('overview')"
                >
                  ✕
                </button>

                <!-- Step dots -->
                <div class="flex flex-col items-center">
                  <span class="text-xs font-bold text-slate-700">Nạp cụm</span>
                  <div class="flex items-center gap-1.5 mt-1">
                    @for (c of s.chunks; track c.id; let idx = $index) {
                      <div
                        class="h-1.5 rounded-full transition-all"
                        [style.width]="idx === drillIdx() ? '18px' : '6px'"
                        [style.background]="idx === drillIdx() ? '#286FB4' : (idx < drillIdx() ? '#16a34a' : '#cbd5e1')"
                      ></div>
                    }
                  </div>
                </div>

                <div class="w-10 text-right text-xs font-bold text-slate-400">
                  {{ drillIdx() + 1 }}/{{ s.chunks.length }}
                </div>
              </div>

              @if (currentChunk(); as chunk) {
                <!-- Subtitle Label -->
                <div class="text-center pt-2">
                  <div class="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                    HÃY NÓI CỤM SAU
                  </div>
                </div>

                <!-- Circular Pronunciation Score Meter -->
                <div class="relative w-32 h-32 mx-auto flex items-center justify-center">
                  <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#e2e8f0"
                      stroke-width="7"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      [attr.stroke]="scoreColor()"
                      stroke-width="7"
                      stroke-linecap="round"
                      fill="none"
                      [attr.stroke-dasharray]="circleCircumference"
                      [attr.stroke-dashoffset]="circleDashOffset()"
                      class="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span class="text-3xl font-900 font-extrabold leading-none" [style.color]="scoreColor()">
                      {{ pronunciationScore() !== null ? pronunciationScore() : '--' }}
                    </span>
                    <span class="text-[9px] uppercase font-bold text-slate-400 mt-1">
                      {{ pronunciationScore() !== null ? 'Điểm phát âm' : 'Chưa nói' }}
                    </span>
                  </div>
                </div>

                <!-- Normal + Snail Audio Controls -->
                <div class="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    (click)="playAudio(chunk.text, chunk.audioUrl, false)"
                  >
                    <span>🔊</span> Nghe chuẩn
                  </button>
                  <button
                    type="button"
                    class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                    title="Nghe phát âm chậm rãi"
                    (click)="playAudio(chunk.text, chunk.audioUrl, true)"
                  >
                    <span>🐌</span> Chậm rãi
                  </button>
                </div>

                <!-- Word-by-Word Colored Chunk Display -->
                <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm text-center space-y-2">
                  <div class="text-2xl md:text-3xl font-extrabold tracking-tight flex flex-wrap items-center justify-center gap-2">
                    @for (token of evaluatedWordTokens(); track $index) {
                      <span
                        class="transition-colors"
                        [class.text-emerald-600]="token.status === 'correct'"
                        [class.text-rose-600]="token.status === 'imperfect'"
                        [class.text-slate-800]="token.status === 'missing'"
                      >
                        {{ token.word }}
                      </span>
                    }
                  </div>

                  <!-- IPA Transcription -->
                  <div class="text-xs font-mono font-600 text-slate-400">
                    {{ ipaTranscript() }}
                  </div>

                  <!-- Meaning in Vietnamese -->
                  <div class="text-sm text-slate-600 font-500 pt-1">
                    {{ chunk.meaningVi }}
                  </div>
                </div>

                <!-- User Spoken Bubble Preview -->
                @if (recognizedSpeech()) {
                  <div class="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-900 text-center">
                    <span class="font-bold">Bạn đã nói:</span> "{{ recognizedSpeech() }}"
                  </div>
                }

                <!-- Central Pulsing Mic + Action Buttons -->
                <div class="flex flex-col items-center gap-4 pt-2">
                  <!-- Mic Button -->
                  <div class="relative">
                    @if (isListening()) {
                      <div class="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-60"></div>
                    }
                    <button
                      type="button"
                      aria-label="Thu âm phát âm"
                      class="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                      [style.background]="isListening() ? '#DF4C73' : '#286FB4'"
                      (click)="toggleMicrophone()"
                    >
                      {{ isListening() ? '⏹' : '🎙️' }}
                    </button>
                  </div>
                  <span class="text-xs text-slate-500 font-600">
                    {{ isListening() ? 'Đang lắng nghe... đọc to cụm từ' : 'Chạm vào mic để đọc cụm từ' }}
                  </span>

                  <!-- Bottom Navigation: Repeat, Skip, Next -->
                  <div class="w-full flex items-center justify-between pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      class="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      (click)="repeatDrill(chunk.id)"
                    >
                      🔄 Nói lại
                    </button>

                    <button
                      type="button"
                      class="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      (click)="skipDrill(chunk.id)"
                    >
                      ⏭ Bỏ qua
                    </button>

                    <button
                      type="button"
                      class="px-6 py-2.5 rounded-xl bg-[#286FB4] hover:bg-[#1d5a94] text-white text-xs font-extrabold shadow-md cursor-pointer transition"
                      (click)="nextDrill(chunk.id)"
                    >
                      Tiếp tục ➔
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 4: "GHÉP CÂU" (Nghe và đọc lại câu hoàn chỉnh)           -->
          <!-- ============================================================== -->
          @if (stage() === 'assemble') {
            <div class="max-w-xl mx-auto px-4 pt-6 space-y-6">
              <!-- Stepper Header -->
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Đóng"
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  (click)="stage.set('overview')"
                >
                  ✕
                </button>
                <div class="flex flex-col items-center">
                  <span class="text-xs font-bold text-slate-700">Ghép câu</span>
                  <div class="text-[10px] text-slate-400 font-500">Luyện phản xạ nguyên câu</div>
                </div>
                <div class="w-10"></div>
              </div>

              <!-- Subtitle Label -->
              <div class="text-center pt-2">
                <div class="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                  HÃY NGHE MÌNH NÓI VÀ ĐỌC LẠI
                </div>
              </div>

              @if (currentChunk(); as chunk) {
                <!-- Full Assembled Sentence Card -->
                <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center space-y-3">
                  <div class="text-xl md:text-2xl font-extrabold text-[#286FB4] leading-relaxed">
                    "{{ chunk.exampleSentence }}"
                  </div>
                  <div class="text-xs md:text-sm text-slate-600 font-500">
                    {{ chunk.meaningVi }}
                  </div>
                </div>

                <!-- Normal + Snail Audio Controls -->
                <div class="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    (click)="playAudio(chunk.exampleSentence, null, false)"
                  >
                    <span>🔊</span> Nghe câu
                  </button>
                  <button
                    type="button"
                    class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                    (click)="playAudio(chunk.exampleSentence, null, true)"
                  >
                    <span>🐌</span> Chậm rãi
                  </button>
                </div>

                <!-- Spoken Transcript Speech Bubble -->
                @if (recognizedSpeech()) {
                  <div class="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-900 text-center">
                    <span class="font-bold">Bạn đã nói:</span> "{{ recognizedSpeech() }}"
                  </div>
                }

                <!-- Central Mic Button -->
                <div class="flex flex-col items-center gap-4 pt-2">
                  <div class="relative">
                    @if (isListening()) {
                      <div class="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-60"></div>
                    }
                    <button
                      type="button"
                      aria-label="Thu âm đọc lại"
                      class="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                      [style.background]="isListening() ? '#DF4C73' : '#286FB4'"
                      (click)="toggleMicrophone()"
                    >
                      {{ isListening() ? '⏹' : '🎙️' }}
                    </button>
                  </div>
                  <span class="text-xs text-slate-500 font-600">
                    {{ isListening() ? 'Đang nghe... hãy đọc lại nguyên câu' : 'Chạm mic và đọc lại câu trên' }}
                  </span>

                  <!-- Next button -->
                  <div class="w-full flex justify-end pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      class="w-full py-3.5 rounded-2xl bg-[#286FB4] hover:bg-[#1d5a94] text-white text-sm font-extrabold shadow-md cursor-pointer transition"
                      (click)="stage.set('complete')"
                    >
                      Tiếp tục: Điền khuyết phản xạ ➔
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 5: "GHÉP CÂU - HOÀN THIỆN CÂU" (Fill-in-the-blank)       -->
          <!-- ============================================================== -->
          @if (stage() === 'complete') {
            <div class="max-w-xl mx-auto px-4 pt-6 space-y-6">
              <!-- Stepper Header -->
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Đóng"
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  (click)="stage.set('overview')"
                >
                  ✕
                </button>
                <div class="flex flex-col items-center">
                  <span class="text-xs font-bold text-slate-700">Ghép câu</span>
                  <div class="text-[10px] text-slate-400 font-500">Hoàn thiện câu từ trí nhớ</div>
                </div>
                <div class="w-10"></div>
              </div>

              <!-- Subtitle Label -->
              <div class="text-center pt-2">
                <div class="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                  NÓI HOÀN THIỆN CÂU SAU
                </div>
              </div>

              @if (currentChunk(); as chunk) {
                <!-- Masked Prompt Card -->
                <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center space-y-3">
                  <div class="text-xl md:text-2xl font-extrabold text-slate-800 leading-relaxed">
                    <span class="tracking-widest text-[#286FB4] font-mono">_____ _____ _____</span>
                    <span> {{ getSentenceTail(chunk) }}</span>
                  </div>
                  <div class="text-xs md:text-sm text-slate-600 font-500">
                    💡 Gợi ý nghĩa: {{ chunk.meaningVi }}
                  </div>
                  @if (showHint()) {
                    <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-bold animate-fadeIn">
                      Cụm từ cần nói: "{{ chunk.text }}"
                    </div>
                  }
                </div>

                <!-- Normal + Snail Audio Controls -->
                <div class="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    (click)="playAudio(chunk.exampleSentence, null, false)"
                  >
                    <span>🔊</span> Nghe mẫu
                  </button>
                  <button
                    type="button"
                    class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                    (click)="playAudio(chunk.exampleSentence, null, true)"
                  >
                    <span>🐌</span> Chậm rãi
                  </button>
                </div>

                <!-- Spoken Transcript Preview -->
                @if (recognizedSpeech()) {
                  <div class="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-900 text-center">
                    <span class="font-bold">Bạn đã nói:</span> "{{ recognizedSpeech() }}"
                  </div>
                }

                <!-- Central Mic with "Bấm vào đây để nói" Tooltip -->
                <div class="flex flex-col items-center gap-3 pt-2">
                  <!-- Floating Tooltip -->
                  <div class="relative bg-slate-800 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md animate-bounce">
                    Bấm vào đây để nói
                    <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                  </div>

                  <div class="relative">
                    @if (isListening()) {
                      <div class="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-60"></div>
                    }
                    <button
                      type="button"
                      aria-label="Thu âm hoàn thiện câu"
                      class="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                      [style.background]="isListening() ? '#DF4C73' : '#286FB4'"
                      (click)="toggleMicrophone()"
                    >
                      {{ isListening() ? '⏹' : '🎙️' }}
                    </button>
                  </div>

                  <!-- Actions: Hint button + Roleplay button -->
                  <div class="w-full flex items-center justify-between pt-6 border-t border-slate-200">
                    <button
                      type="button"
                      class="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
                      (click)="toggleHint()"
                    >
                      💡 {{ showHint() ? 'Ẩn gợi ý' : 'Gợi ý' }}
                    </button>

                    <button
                      type="button"
                      class="px-6 py-3 rounded-2xl bg-[#286FB4] hover:bg-[#1d5a94] text-white text-sm font-extrabold shadow-lg shadow-[#286FB4]/25 transition cursor-pointer"
                      [disabled]="isStartingRoleplay()"
                      (click)="startRoleplay()"
                    >
                      {{ isStartingRoleplay() ? 'Đang tạo phòng...' : '🎭 Bắt đầu Roleplay ngay' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- ============================================================== -->
          <!-- CONTEXT & REQUIREMENTS MODAL                                   -->
          <!-- ============================================================== -->
          @if (showContextModal()) {
            <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div class="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 class="font-extrabold text-base text-slate-800">
                    Bối cảnh & Nhiệm vụ
                  </h3>
                  <button
                    type="button"
                    class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                    (click)="showContextModal.set(false)"
                  >
                    ✕
                  </button>
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
  readonly appState = inject(AppStateService);
  readonly speechService = inject(SpeechRecognitionService);

  readonly stage = signal<CoachStage>('overview');
  readonly drillIdx = signal(0);
  readonly isListening = signal(false);
  readonly recognizedSpeech = signal('');
  readonly drillMessage = signal<string | null>(null);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isStartingRoleplay = signal(false);
  readonly showContextModal = signal(false);
  readonly showHint = signal(false);

  readonly scenario = signal<ScenarioDetail | null>(null);
  readonly bookmarkedChunkIds = signal<Set<string>>(new Set());
  readonly practicedChunkIds = signal<Set<string>>(new Set());

  // Pronunciation score meter state
  readonly circleCircumference = 2 * Math.PI * 40; // ~251.33
  readonly pronunciationScore = signal<number | null>(null);
  readonly evaluatedWordTokens = signal<WordPronunciationScore[]>([]);

  private speechSub?: Subscription;

  readonly currentChunk = computed<ScenarioChunk | null>(() => {
    const s = this.scenario();
    if (!s || !s.chunks || s.chunks.length === 0) return null;
    const idx = this.drillIdx();
    return s.chunks[idx] || s.chunks[0];
  });

  readonly ipaTranscript = computed(() => {
    const chunk = this.currentChunk();
    return chunk ? getIpaPhonetic(chunk.text) : '';
  });

  readonly scoreColor = computed(() => {
    const score = this.pronunciationScore();
    if (score === null) return '#286FB4';
    if (score >= 70) return '#16a34a';
    if (score >= 50) return '#f59e0b';
    return '#dc2626';
  });

  readonly circleDashOffset = computed(() => {
    const score = this.pronunciationScore();
    if (score === null) return this.circleCircumference;
    return this.circleCircumference * (1 - score / 100);
  });

  ngOnInit(): void {
    this.loadScenario();
    this.speechSub = this.speechService.speechResult$.subscribe((res) => {
      this.handleSpokenResult(res.text);
    });
  }

  ngOnDestroy(): void {
    this.speechSub?.unsubscribe();
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
        this.resetChunkEvaluation();
      },
      error: () => {
        this.errorMessage.set('Không thể tải thông tin tình huống.');
        this.isLoading.set(false);
      },
    });
  }

  startDrillFlow(): void {
    this.drillIdx.set(0);
    this.resetChunkEvaluation();
    this.stage.set('drill');
  }

  resetChunkEvaluation(): void {
    const chunk = this.currentChunk();
    if (!chunk) return;
    const words = chunk.text.trim().split(/\s+/).map((w) => ({
      word: w,
      status: 'missing' as const,
    }));
    this.evaluatedWordTokens.set(words);
    this.pronunciationScore.set(null);
    this.recognizedSpeech.set('');
    this.showHint.set(false);
  }

  handleSpokenResult(spokenText: string): void {
    this.recognizedSpeech.set(spokenText);
    this.isListening.set(false);

    const chunk = this.currentChunk();
    if (!chunk) return;

    if (this.stage() === 'drill') {
      const evaluation = evaluatePronunciation(chunk.text, spokenText);
      this.pronunciationScore.set(evaluation.score);
      this.evaluatedWordTokens.set(evaluation.words);
    } else if (this.stage() === 'assemble' || this.stage() === 'complete') {
      const evaluation = evaluatePronunciation(chunk.exampleSentence, spokenText);
      this.pronunciationScore.set(evaluation.score);
    }
  }

  getTagMeta(tag: string) {
    return (
      FUNCTIONAL_TAG_CONFIG[tag] || {
        label: tag,
        color: '#286FB4',
        bg: '#E2F0F9',
      }
    );
  }

  playAudio(text: string, audioUrl?: string | null, slow = false): void {
    this.scenarioService.playChunkAudio(text, audioUrl, slow);
  }

  toggleMicrophone(): void {
    if (this.isListening()) {
      this.speechService.stopListening();
      this.isListening.set(false);
    } else {
      this.recognizedSpeech.set('');
      this.drillMessage.set(null);
      this.isListening.set(true);
      this.speechService.startListening('en-US').catch(() => {
        this.isListening.set(false);
      });
    }
  }

  repeatDrill(chunkId: string): void {
    const s = this.scenario();
    if (!s) return;
    this.scenarioService
      .recordDrill(s.id, {
        chunkId,
        isSkipped: false,
      })
      .subscribe();
    this.resetChunkEvaluation();
  }

  skipDrill(chunkId: string): void {
    const s = this.scenario();
    if (!s) return;
    this.scenarioService
      .recordDrill(s.id, {
        chunkId,
        isSkipped: true,
      })
      .subscribe();

    if (this.drillIdx() < s.chunks.length - 1) {
      this.drillIdx.update((i) => i + 1);
      this.resetChunkEvaluation();
    } else {
      this.stage.set('assemble');
    }
  }

  nextDrill(chunkId: string): void {
    const s = this.scenario();
    if (!s) return;
    this.scenarioService
      .recordDrill(s.id, {
        chunkId,
        isSkipped: false,
      })
      .subscribe();

    this.practicedChunkIds.update((set) => new Set([...set, chunkId]));

    if (this.drillIdx() < s.chunks.length - 1) {
      this.drillIdx.update((i) => i + 1);
      this.resetChunkEvaluation();
    } else {
      this.stage.set('assemble');
    }
  }

  getSentenceTail(chunk: ScenarioChunk): string {
    const ex = chunk.exampleSentence;
    const txt = chunk.text;
    const idx = ex.toLowerCase().indexOf(txt.toLowerCase());
    if (idx !== -1) {
      const tail = ex.substring(idx + txt.length).trim();
      return tail.length > 0 ? tail : ex;
    }
    return ex;
  }

  toggleHint(): void {
    this.showHint.update((v) => !v);
  }

  isBookmarked(chunkId: string): boolean {
    return this.bookmarkedChunkIds().has(chunkId);
  }

  toggleBookmark(chunkId: string): void {
    this.bookmarkedChunkIds.update((set) => {
      const next = new Set(set);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
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
        this.router.navigate(['/scenario-roleplay', res.sessionId]);
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
