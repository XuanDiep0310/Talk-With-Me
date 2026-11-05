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
  evaluatePronunciation,
  getIpaPhonetic,
  WordPronunciationScore,
} from '../../core/services/scenario.service';

/**
 * 4 Spiral learning modes for unconscious mastery:
 * - 'phonetics': Nạp cụm & Chuẩn hóa phát âm (Vòng tròn điểm, chậm rãi, từng âm tiết IPA)
 * - 'listen_repeat': Phản xạ thính giác (Nghe AI đọc câu hoàn chỉnh và nói lại)
 * - 'fill_blank': Truy xuất trí nhớ chủ động (Ẩn cụm từ, chỉ hiện gợi ý nghĩa và câu ngữ cảnh)
 * - 'reflex_quiz': Phản xạ tình huống tự nhiên (Nhìn tình huống tiếng Việt, bật nói tiếng Anh tức thì không cần nhìn chữ)
 */
export type DrillActivity = 'phonetics' | 'listen_repeat' | 'fill_blank' | 'reflex_quiz';

export type CoachStage = 'overview' | 'interactive_drill' | 'summary_ready';

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
          <!-- SCREEN 1: TỔNG QUAN BÀI HỌC & CÁC CHUNK CẦN NHỚ               -->
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

              <!-- Question & Objective Card (TalkWithMe Design System) -->
              <div class="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
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

                <!-- Context hint -->
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

              <!-- Chunks Checklist -->
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
                      class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex items-start gap-3.5"
                    >
                      <!-- Audio Speaker Button -->
                      <button
                        type="button"
                        class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-[#E2F0F9] text-[#286FB4] hover:bg-sky-100 transition cursor-pointer"
                        title="Nghe phát âm chuẩn"
                        (click)="playAudio(c.text, c.audioUrl)"
                      >
                        🔊
                      </button>

                      <!-- Chunk Details -->
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

                      <!-- Bookmark & Mastery check -->
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

              <!-- Coach Alexander Card -->
              <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-full bg-gradient-to-tr from-[#286FB4] to-sky-400 text-white font-extrabold flex items-center justify-center text-base shadow-xs">
                    🤖
                  </div>
                  <div>
                    <div class="text-sm font-bold text-slate-800">Luyện ghi nhớ trong tiềm thức</div>
                    <div class="text-xs text-slate-500">4 vòng lặp đa dạng: Phát âm ➔ Nghe lặp ➔ Điền khuyết ➔ Phản xạ</div>
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
                  Bắt đầu luyện phản xạ
                </button>
              </div>
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 2: LUYỆN LẶP ĐA DẠNG (SPIRAL DRILLS CHO CHUNK)          -->
          <!-- ============================================================== -->
          @if (stage() === 'interactive_drill') {
            <div class="max-w-xl mx-auto px-4 pt-6 space-y-6">
              <!-- Top Navigation Bar & Multi-Step Indicators -->
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Đóng bài luyện"
                  class="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-xs border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  (click)="stage.set('overview')"
                >
                  ✕
                </button>

                <!-- Current Activity Badge & Dots -->
                <div class="flex flex-col items-center">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-slate-800">{{ activityTitle() }}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#E2F0F9] text-[#286FB4]">
                      Vòng {{ currentRound() }}/4
                    </span>
                  </div>
                  <!-- Progress bar for all 4 rounds x chunks -->
                  <div class="flex items-center gap-1 mt-1.5">
                    @for (dot of progressDots(); track $index) {
                      <div
                        class="h-1.5 rounded-full transition-all"
                        [style.width]="dot.active ? '16px' : '5px'"
                        [style.background]="dot.active ? '#286FB4' : (dot.completed ? '#16a34a' : '#cbd5e1')"
                      ></div>
                    }
                  </div>
                </div>

                <div class="text-right text-xs font-bold text-slate-400">
                  Chunk {{ drillChunkIdx() + 1 }}/{{ s.chunks.length }}
                </div>
              </div>

              @if (currentChunk(); as chunk) {
                <!-- Activity Instruction Subtitle -->
                <div class="text-center pt-1">
                  <div class="text-xs font-extrabold uppercase tracking-widest text-[#286FB4] mb-1">
                    {{ activityInstruction() }}
                  </div>
                </div>

                <!-- ======================================================== -->
                <!-- DẠNG 1: PHONETICS (NẠP CỤM & VÒNG TRÒN ĐIỂM SVG)        -->
                <!-- ======================================================== -->
                @if (currentActivity() === 'phonetics') {
                  <!-- Circular Pronunciation Score Meter -->
                  <div class="relative w-32 h-32 mx-auto flex items-center justify-center">
                    <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" stroke="#e2e8f0" stroke-width="7" fill="none" />
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
                      <span class="text-3xl font-extrabold leading-none" [style.color]="scoreColor()">
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
                      class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      (click)="playAudio(chunk.text, chunk.audioUrl, false)"
                    >
                      <span>🔊</span> Nghe chuẩn
                    </button>
                    <button
                      type="button"
                      class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                      title="Nghe phát âm chậm rãi"
                      (click)="playAudio(chunk.text, chunk.audioUrl, true)"
                    >
                      <span>🐌</span> Chậm rãi
                    </button>
                  </div>

                  <!-- Target Chunk Text with Word-by-Word Colors & IPA -->
                  <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs text-center space-y-2">
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
                    <div class="text-xs font-mono font-600 text-slate-400">
                      {{ ipaTranscript() }}
                    </div>
                    <div class="text-sm text-slate-600 font-500 pt-1">
                      {{ chunk.meaningVi }}
                    </div>
                  </div>
                }

                <!-- ======================================================== -->
                <!-- DẠNG 2: LISTEN & REPEAT (NGHE NÓI GHÉP CÂU)              -->
                <!-- ======================================================== -->
                @if (currentActivity() === 'listen_repeat') {
                  <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs text-center space-y-3">
                    <div class="text-lg md:text-xl font-extrabold text-[#286FB4] leading-relaxed">
                      "{{ chunk.exampleSentence }}"
                    </div>
                    <div class="text-xs md:text-sm text-slate-600 font-500">
                      {{ chunk.meaningVi }}
                    </div>
                  </div>

                  <!-- Audio Controls -->
                  <div class="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      (click)="playAudio(chunk.exampleSentence, null, false)"
                    >
                      <span>🔊</span> Nghe câu
                    </button>
                    <button
                      type="button"
                      class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-xs font-bold text-amber-700 hover:bg-amber-50 transition cursor-pointer"
                      (click)="playAudio(chunk.exampleSentence, null, true)"
                    >
                      <span>🐌</span> Chậm rãi
                    </button>
                  </div>
                }

                <!-- ======================================================== -->
                <!-- DẠNG 3: FILL IN THE BLANK (ĐIỀN KHUYẾT TỪ TRÍ NHỚ)       -->
                <!-- ======================================================== -->
                @if (currentActivity() === 'fill_blank') {
                  <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs text-center space-y-3">
                    <div class="text-lg md:text-xl font-extrabold text-slate-800 leading-relaxed">
                      <span class="tracking-widest text-[#286FB4] font-mono">_____ _____ _____</span>
                      <span> {{ getSentenceTail(chunk) }}</span>
                    </div>
                    <div class="text-xs md:text-sm text-slate-600 font-500">
                      💡 Nghĩa tiếng Việt: <strong class="text-slate-800">{{ chunk.meaningVi }}</strong>
                    </div>
                    @if (showHint()) {
                      <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-bold animate-fadeIn">
                        Cụm từ cần nhớ: "{{ chunk.text }}"
                      </div>
                    }
                  </div>

                  <div class="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      (click)="playAudio(chunk.exampleSentence, null, false)"
                    >
                      <span>🔊</span> Nghe câu hoàn chỉnh
                    </button>
                    <button
                      type="button"
                      class="px-4 py-2 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
                      (click)="toggleHint()"
                    >
                      💡 {{ showHint() ? 'Ẩn gợi ý' : 'Gợi ý' }}
                    </button>
                  </div>
                }

                <!-- ======================================================== -->
                <!-- DẠNG 4: REFLEX QUIZ (PHẢN XẠ NHANH KHÔNG NHÌN CHỮ ANH)   -->
                <!-- ======================================================== -->
                @if (currentActivity() === 'reflex_quiz') {
                  <div class="bg-gradient-to-br from-[#E2F0F9] to-sky-50 rounded-3xl p-6 border border-sky-200 shadow-xs text-center space-y-3">
                    <div class="text-[10px] uppercase font-bold tracking-wider text-[#286FB4]">
                      Tình huống giao tiếp thực tế
                    </div>
                    <div class="text-lg md:text-xl font-extrabold text-slate-900 leading-snug">
                      Bạn muốn nói: "{{ chunk.meaningVi }}"
                    </div>
                    <p class="text-xs text-slate-500">
                      ⚡ Hãy bật nói ngay bằng tiếng Anh từ phản xạ tiềm thức!
                    </p>
                    @if (showHint()) {
                      <div class="p-2.5 rounded-xl bg-white border border-sky-300 text-xs text-[#286FB4] font-bold animate-fadeIn">
                        Mẫu câu: "{{ chunk.text }}"
                      </div>
                    }
                  </div>

                  <div class="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      class="px-4 py-2 rounded-full bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      (click)="playAudio(chunk.text, chunk.audioUrl, false)"
                    >
                      <span>🔊</span> Nghe đáp án
                    </button>
                    <button
                      type="button"
                      class="px-4 py-2 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
                      (click)="toggleHint()"
                    >
                      💡 {{ showHint() ? 'Ẩn đáp án' : 'Xem đáp án' }}
                    </button>
                  </div>
                }

                <!-- User Spoken Bubble Preview -->
                @if (recognizedSpeech()) {
                  <div class="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-900 text-center">
                    <span class="font-bold">Bạn đã nói:</span> "{{ recognizedSpeech() }}"
                  </div>
                }

                <!-- Central Pulsing Mic + Bottom Step Navigation -->
                <div class="flex flex-col items-center gap-4 pt-1">
                  <!-- Mic Button -->
                  <div class="relative">
                    @if (isListening()) {
                      <div class="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-60"></div>
                    }
                    <button
                      type="button"
                      aria-label="Thu âm giọng nói"
                      class="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                      [style.background]="isListening() ? '#DF4C73' : '#286FB4'"
                      (click)="toggleMicrophone()"
                    >
                      {{ isListening() ? '⏹' : '🎙️' }}
                    </button>
                  </div>
                  <span class="text-xs text-slate-500 font-600">
                    {{ isListening() ? 'Đang lắng nghe... nói to câu của bạn' : 'Chạm vào micro để nói' }}
                  </span>

                  <!-- Bottom Controls: Repeat, Skip, Next Step -->
                  <div class="w-full flex items-center justify-between pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      class="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                      (click)="repeatActivity(chunk.id)"
                    >
                      🔄 Nói lại
                    </button>

                    <button
                      type="button"
                      class="px-3.5 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                      (click)="skipActivity(chunk.id)"
                    >
                      ⏭ Bỏ qua
                    </button>

                    <button
                      type="button"
                      class="px-5 py-2.5 rounded-xl bg-[#286FB4] hover:bg-[#1d5a94] text-white text-xs font-extrabold shadow-md cursor-pointer transition"
                      (click)="advanceActivity(chunk.id)"
                    >
                      {{ isLastStep() ? 'Hoàn thành nạp cụm ➔' : 'Tiếp tục ➔' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- ============================================================== -->
          <!-- SCREEN 3: HOÀN THÀNH NẠP CỤM -> SẴN SÀNG ROLEPLAY            -->
          <!-- ============================================================== -->
          @if (stage() === 'summary_ready') {
            <div class="max-w-md mx-auto px-4 pt-12 text-center space-y-6">
              <div class="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl shadow-sm animate-bounce">
                🎯
              </div>
              <div>
                <h2 class="text-2xl font-extrabold text-slate-900">
                  Tuyệt vời! Bạn đã nạp sâu các cụm từ
                </h2>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed">
                  Các mẫu câu đã được củng cố qua 4 tầng phản xạ. Giờ là lúc đưa vào hội thoại thực tế cùng AI Coach trong vai diễn của bạn!
                </p>
              </div>

              <!-- Quick Recap List -->
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
                  Quay lại xem bài học
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
  readonly drillChunkIdx = signal(0);
  readonly currentActivity = signal<DrillActivity>('phonetics');

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
    const idx = this.drillChunkIdx();
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

  readonly currentRound = computed(() => {
    switch (this.currentActivity()) {
      case 'phonetics':
        return 1;
      case 'listen_repeat':
        return 2;
      case 'fill_blank':
        return 3;
      case 'reflex_quiz':
        return 4;
    }
  });

  readonly activityTitle = computed(() => {
    switch (this.currentActivity()) {
      case 'phonetics':
        return 'Nạp âm & Phát âm';
      case 'listen_repeat':
        return 'Nghe & Đọc lại';
      case 'fill_blank':
        return 'Điền khuyết trí nhớ';
      case 'reflex_quiz':
        return 'Phản xạ tiềm thức';
    }
  });

  readonly activityInstruction = computed(() => {
    switch (this.currentActivity()) {
      case 'phonetics':
        return 'HÃY PHÁT ÂM CHUẨN CỤM TỪ NÀY';
      case 'listen_repeat':
        return 'HÃY NGHE MÌNH NÓI VÀ ĐỌC LẠI';
      case 'fill_blank':
        return 'NÓI HOÀN THIỆN CÂU SAU TỪ TRÍ NHỚ';
      case 'reflex_quiz':
        return 'BẬT NÓI TIẾNG ANH NGAY TỨC THÌ';
    }
  });

  readonly progressDots = computed(() => {
    const s = this.scenario();
    if (!s || !s.chunks.length) return [];
    const totalChunks = s.chunks.length;
    const activities: DrillActivity[] = ['phonetics', 'listen_repeat', 'fill_blank', 'reflex_quiz'];
    const currentActIdx = activities.indexOf(this.currentActivity());
    const currentGlobalStep = currentActIdx * totalChunks + this.drillChunkIdx();
    const totalSteps = 4 * totalChunks;

    const dots = [];
    for (let i = 0; i < totalSteps; i++) {
      dots.push({
        active: i === currentGlobalStep,
        completed: i < currentGlobalStep,
      });
    }
    return dots;
  });

  readonly isLastStep = computed(() => {
    const s = this.scenario();
    if (!s || !s.chunks.length) return false;
    return this.currentActivity() === 'reflex_quiz' && this.drillChunkIdx() === s.chunks.length - 1;
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
    this.drillChunkIdx.set(0);
    this.currentActivity.set('phonetics');
    this.resetChunkEvaluation();
    this.stage.set('interactive_drill');
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

    if (this.currentActivity() === 'phonetics' || this.currentActivity() === 'reflex_quiz') {
      const evaluation = evaluatePronunciation(chunk.text, spokenText);
      this.pronunciationScore.set(evaluation.score);
      this.evaluatedWordTokens.set(evaluation.words);
    } else {
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

  repeatActivity(chunkId: string): void {
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

  skipActivity(chunkId: string): void {
    this.advanceStep(chunkId, true);
  }

  advanceActivity(chunkId: string): void {
    this.advanceStep(chunkId, false);
  }

  private advanceStep(chunkId: string, isSkipped: boolean): void {
    const s = this.scenario();
    if (!s) return;

    this.scenarioService
      .recordDrill(s.id, {
        chunkId,
        isSkipped,
      })
      .subscribe();

    if (!isSkipped) {
      this.practicedChunkIds.update((set) => new Set([...set, chunkId]));
    }

    const totalChunks = s.chunks.length;
    const currentIdx = this.drillChunkIdx();
    const act = this.currentActivity();

    // Spaced Spiral Transition logic
    if (currentIdx < totalChunks - 1) {
      // Advance to next chunk within current activity
      this.drillChunkIdx.update((i) => i + 1);
      this.resetChunkEvaluation();
    } else {
      // Reached end of chunks for current activity; escalate to next round
      if (act === 'phonetics') {
        this.currentActivity.set('listen_repeat');
        this.drillChunkIdx.set(0);
        this.resetChunkEvaluation();
      } else if (act === 'listen_repeat') {
        this.currentActivity.set('fill_blank');
        this.drillChunkIdx.set(0);
        this.resetChunkEvaluation();
      } else if (act === 'fill_blank') {
        this.currentActivity.set('reflex_quiz');
        this.drillChunkIdx.set(0);
        this.resetChunkEvaluation();
      } else {
        // All 4 rounds complete!
        this.stage.set('summary_ready');
      }
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
        this.router.navigate(['/scenario-roleplay', res.sessionId], { state: { scenario: s, roleplaySession: res }, queryParams: { scenarioId: s.id } });
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
