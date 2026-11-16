import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { CoachService } from '../../core/services/coach.service';
import {
  CoachVoiceService,
  LiveTranscriptItem,
} from '../../core/services/coach-voice.service';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-ai-coach-session',
  standalone: true,
  imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      tabindex="-1"
      class="fixed inset-0 z-50 flex flex-col min-w-0 bg-slate-950 text-slate-50"
      (document:keydown.escape)="closeEndModal()"
    >
      <!-- Top Navigation Header -->
      <header
        class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-md shadow-blue-500/20 shrink-0">
            AI
          </div>
          <div class="min-w-0">
            <h1 class="font-bold text-sm sm:text-base truncate text-slate-100 tracking-tight">
              {{ currentTopicTitle() }}
            </h1>
            <div class="flex items-center gap-2 mt-0.5">
              <span
                class="badge text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5"
                [ngClass]="stateBadgeClass()"
              >
                <span class="w-1.5 h-1.5 rounded-full" [ngClass]="stateDotClass()"></span>
                {{ stateText() }}
              </span>
              @if (voiceService.isMockMode()) {
                <span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Dev Mock
                </span>
              }
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2.5 sm:gap-3.5">
          <!-- Session Timer -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/80">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="text-slate-400">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span class="font-mono text-sm sm:text-base font-bold text-slate-200">
              {{ elapsedSeconds() | formatTime }}
            </span>
          </div>

          <!-- Desktop Hint Toggle Button -->
          <button
            type="button"
            class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shadow-xs"
            [ngClass]="
              showHints()
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-amber-400/10'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            "
            [title]="showHints() ? 'Đóng khung gợi ý' : 'Mở khung gợi ý câu trả lời'"
            (click)="showHints.set(!showHints())"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" class="text-amber-400">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
            </svg>
            <span>Gợi ý câu</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-400/30">
              {{ userLevel() }}
            </span>
          </button>

          <!-- Dev Mock Switch (D-08) -->
          <label class="hidden md:flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              class="rounded border-slate-600 text-blue-600 focus:ring-0"
              [checked]="voiceService.isMockMode()"
              (change)="toggleMockMode()"
            />
            <span>Mock Mic</span>
          </label>

          <!-- End Session Action Button -->
          <button
            type="button"
            class="px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-xs active:scale-95"
            (click)="showEndModal.set(true)"
          >
            Kết thúc
          </button>
        </div>
      </header>

      <!-- Connection / Reconnecting Banner -->
      @if (voiceService.uxState() === 'reconnecting') {
        <div class="bg-amber-600/90 text-white text-xs px-4 py-2 text-center flex items-center justify-center gap-2" role="alert">
          <svg class="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span>Đang mất kết nối tạm thời. Hệ thống đang tự động nối lại và giữ nguyên đoạn nói của bạn...</span>
        </div>
      }

      @if (voiceService.uxState() === 'mic_error') {
        <div class="bg-rose-600/90 text-white text-xs px-4 py-2 text-center flex items-center justify-center gap-2" role="alert">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Không thể truy cập Micro. Vui lòng cấp quyền truy cập microphone trên trình duyệt để tiếp tục.</span>
        </div>
      }

      <!-- Main Content Area: Flex layout for Live Script (left) & Desktop Hint Panel (right) -->
      <div class="flex-1 flex min-h-0 relative overflow-hidden bg-slate-950">
        <!-- Conversation Live Script (Scrollable Area) -->
        <section
          #transcriptContainer
          class="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-4"
          aria-label="Hội thoại Live Script"
          aria-live="polite"
          (scroll)="onUserScroll()"
        >
          @if (liveTranscripts().length === 0) {
            <div class="text-center py-20 text-slate-500">
              <div class="w-16 h-16 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-500 mb-4 shadow-inner">
                <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <p class="text-base font-semibold text-slate-300">Đang khởi tạo hội thoại cùng Coach Alex</p>
              <p class="text-xs text-slate-500 mt-1">Nhấn vào nút Micro bên dưới để bắt đầu luyện nói bất kỳ lúc nào.</p>
            </div>
          }

          @for (item of liveTranscripts(); track item.id) {
            <article
              class="flex items-start gap-3 my-3"
              [class.justify-end]="item.speaker === 'USER'"
              [class.speaker-ai]="item.speaker === 'AI'"
              [class.speaker-user]="item.speaker === 'USER'"
            >
              @if (item.speaker === 'AI') {
                <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 text-xs font-extrabold shadow-sm">
                  AI
                </div>
              }

              <div
                class="max-w-xl rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all"
                [ngClass]="
                  item.speaker === 'AI'
                    ? 'bg-slate-900 border border-slate-800 text-slate-100'
                    : 'bg-blue-600 text-white'
                "
                [class.opacity-70]="item.isPartial"
                [class.border-sky-400]="item.isPartial || voiceService.playingSegmentId() === item.id"
              >
                <div class="flex items-center justify-between gap-4 text-[11px] mb-1.5 opacity-80">
                  <div class="flex items-center gap-2">
                    <span class="font-bold">{{ item.speaker === 'AI' ? 'Coach Alex' : 'Bạn' }}</span>
                    <span>•</span>
                    <span>{{ item.time }}</span>
                  </div>

                  <!-- Action Buttons: Translate & Replay -->
                  @if (!item.isPartial) {
                    <div class="flex items-center gap-1.5">
                      <!-- Translate Toggle Button -->
                      <button
                        type="button"
                        class="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition cursor-pointer"
                        [ngClass]="showTranslation()[item.id] ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40' : 'bg-white/10 hover:bg-white/20 text-slate-300'"
                        [title]="showTranslation()[item.id] ? 'Ẩn bản dịch' : 'Xem bản dịch tiếng Việt'"
                        (click)="toggleTranslation(item)"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                      </button>

                      <!-- Replay Audio Button -->
                      <button
                        type="button"
                        class="w-7 h-7 flex items-center justify-center rounded-lg text-xs transition cursor-pointer"
                        [ngClass]="
                          voiceService.playingSegmentId() === item.id
                            ? 'bg-amber-400 text-slate-950 shadow-sm animate-pulse'
                            : 'bg-white/10 hover:bg-white/20 text-slate-200'
                        "
                        [title]="voiceService.playingSegmentId() === item.id ? 'Đang phát âm thanh...' : 'Nghe lại'"
                        (click)="replaySegment(item)"
                      >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                      </button>
                    </div>
                  }
                </div>

                <p class="break-words select-text text-[15px] leading-relaxed">
                  {{ item.text }}
                  @if (item.isPartial) {
                    <span class="inline-block animate-pulse font-bold">...</span>
                  }
                </p>

                <!-- In-line Translation Box -->
                @if (showTranslation()[item.id]) {
                  <div class="mt-2.5 pt-2 border-t border-white/15 text-xs text-sky-200 italic leading-relaxed">
                    @if (loadingTranslation()[item.id] && !translationMap()[item.id] && !item.translation) {
                      <span class="animate-pulse">Đang dịch...</span>
                    } @else {
                      <span>{{ translationMap()[item.id] || item.translation || 'Không thể lấy bản dịch' }}</span>
                    }
                  </div>
                }
              </div>

              @if (item.speaker === 'USER') {
                <div class="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 shrink-0 text-xs font-bold shadow-sm">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              }
            </article>
          }

          <!-- AI Thinking Indicator -->
          @if (voiceService.uxState() === 'processing') {
            <div class="flex items-center gap-3 my-2">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 text-xs font-extrabold shadow-sm">
                AI
              </div>
              <div class="rounded-2xl px-4 py-2.5 bg-slate-900 border border-slate-800 text-sky-400 text-xs flex items-center gap-2">
                <span class="flex gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]"></span>
                </span>
                <span>Alex đang lắng nghe và chuẩn bị phản hồi...</span>
              </div>
            </div>
          }
        </section>

        <!-- Desktop Hint Side Panel -->
        @if (showHints()) {
          <aside
            class="hidden md:flex flex-col w-80 lg:w-96 shrink-0 border-l border-slate-800 bg-slate-900/95 p-4 overflow-y-auto shadow-2xl backdrop-blur-md"
            aria-label="Khung gợi ý câu trả lời"
          >
            <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div class="flex items-center gap-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" class="text-amber-400">
                  <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                </svg>
                <h2 class="text-sm font-bold text-slate-100">Gợi ý câu trả lời</h2>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 font-bold border border-sky-400/30">
                  Level {{ userLevel() }}
                </span>
              </div>
              <button
                type="button"
                class="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                title="Đóng khung gợi ý"
                (click)="showHints.set(false)"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            @if (suggestions().length > 0) {
              <div class="space-y-3">
                @for (sugg of suggestions(); track sugg.text) {
                  <div
                    class="group p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500/50 transition cursor-pointer flex items-start justify-between gap-3 shadow-2xs"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-blue-300 transition leading-relaxed">
                        "{{ sugg.text }}"
                      </p>
                      <p class="text-xs text-slate-400 italic mt-1 leading-relaxed">
                        {{ sugg.translation }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="w-7 h-7 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-slate-300 hover:text-white transition cursor-pointer"
                      title="Nghe phát âm mẫu"
                      (click)="playSampleAudio(sugg.text)"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </button>
                  </div>
                }
              </div>
              <p class="text-[11px] text-slate-500 mt-4 text-center">
                Bấm biểu tượng loa để nghe phát âm mẫu, rồi nhấn micro để nói.
              </p>
            } @else {
              <div class="text-center py-12 text-slate-500 text-xs">
                <div class="w-8 h-8 mx-auto rounded-full border-2 border-slate-700 border-t-amber-400 animate-spin mb-2"></div>
                Đang chuẩn bị gợi ý câu trả lời theo ngữ cảnh...
              </div>
            }
          </aside>
        }
      </div>

      <!-- Mobile Slide-up Bottom Sheet for Hints -->
      @if (showHints()) {
        <div
          class="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-hints-title"
        >
          <button
            type="button"
            class="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-xs border-0 p-0 cursor-default"
            aria-label="Đóng gợi ý"
            tabindex="-1"
            (click)="showHints.set(false)"
          ></button>

          <section
            class="relative z-10 bg-slate-900 border-t border-slate-700 rounded-t-3xl p-5 max-h-[75vh] flex flex-col shadow-2xl"
          >
            <div class="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3"></div>
            <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div class="flex items-center gap-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" class="text-amber-400">
                  <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                </svg>
                <h2 id="mobile-hints-title" class="text-sm font-bold text-slate-100">Gợi ý câu trả lời</h2>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 font-bold border border-sky-400/30">
                  Level {{ userLevel() }}
                </span>
              </div>
              <button
                type="button"
                class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer text-xs"
                aria-label="Đóng bảng gợi ý"
                (click)="showHints.set(false)"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div class="overflow-y-auto space-y-2.5 flex-1 pr-1">
              @for (sugg of suggestions(); track sugg.text) {
                <div
                  class="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/70 flex items-start justify-between gap-3 shadow-xs"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-xs sm:text-sm font-semibold text-slate-100 leading-snug">
                      "{{ sugg.text }}"
                    </p>
                    <p class="text-[11px] text-slate-400 italic mt-1 leading-snug">
                      {{ sugg.translation }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="w-8 h-8 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-slate-200 transition cursor-pointer"
                    title="Nghe phát âm mẫu"
                    (click)="playSampleAudio(sugg.text)"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  </button>
                </div>
              }
            </div>
          </section>
        </div>
      }

      <!-- Bottom Single-Mic Control Studio Footer -->
      <footer
        class="py-4 px-4 sm:px-6 flex flex-col items-center justify-center gap-2 bg-slate-900 border-t border-slate-800"
      >
        <!-- Horizontal Row: Left Spacer | Central Mic | Right Hint Button -->
        <div class="w-full max-w-sm sm:max-w-md flex items-center justify-between relative px-2">
          <!-- Left spacer for balance -->
          <div class="w-11 sm:w-12"></div>

          <!-- Central Microphone Button -->
          <div class="relative flex items-center justify-center">
            @if (voiceService.isRecordingTurn()) {
              <span class="absolute w-24 h-24 rounded-full bg-rose-500/25 animate-ping pointer-events-none"></span>
              <span class="absolute w-20 h-20 rounded-full bg-rose-500/40 animate-pulse pointer-events-none"></span>
            }

            <button
              type="button"
              data-testid="coach-mic-btn"
              class="relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl cursor-pointer focus:outline-none"
              [ngClass]="
                voiceService.isRecordingTurn()
                  ? 'bg-rose-600 hover:bg-rose-500 text-white scale-105 ring-4 ring-rose-400/50 shadow-rose-600/40'
                  : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 ring-4 ring-blue-400/30 shadow-blue-600/30'
              "
              [disabled]="voiceService.uxState() === 'connecting' || voiceService.uxState() === 'ending'"
              [attr.aria-label]="voiceService.isRecordingTurn() ? 'Đang nói - Nhấn để dừng và gửi câu nói' : 'Nhấn để bắt đầu nói'"
              (click)="onMicButtonClick()"
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
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              }
            </button>
          </div>

          <!-- Right: Hint Toggle Button -->
          <div class="w-11 sm:w-12 flex items-center justify-end">
            <button
              type="button"
              class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition cursor-pointer shadow-md"
              [ngClass]="
                showHints()
                  ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/30 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 hover:scale-105 border border-slate-700'
              "
              [title]="showHints() ? 'Đóng gợi ý câu trả lời' : 'Mở gợi ý câu trả lời'"
              (click)="toggleHints()"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
              </svg>
              @if (suggestions().length > 0 && !showHints()) {
                <span class="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
                <span class="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border border-slate-800"></span>
              }
            </button>
          </div>
        </div>

        <!-- Instruction Label -->
        <div class="text-center">
          <p class="text-xs sm:text-sm font-bold text-slate-100">
            @if (voiceService.isRecordingTurn()) {
              <span class="text-rose-400 flex items-center justify-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                Đang ghi âm... Nhấn lại micro để hoàn tất câu nói
              </span>
            } @else if (voiceService.uxState() === 'processing') {
              <span class="text-purple-300">Đang xử lý câu nói...</span>
            } @else if (voiceService.uxState() === 'ai_speaking') {
              <span class="text-blue-300">Coach Alex đang nói</span>
            } @else {
              <span class="text-slate-300">Nhấn vào micro để nói</span>
            }
          </p>
        </div>
      </footer>

      <!-- End Session Confirmation Modal -->
      @if (showEndModal()) {
        <div
          class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="presentation"
        >
          <section
            class="card p-6 sm:p-8 max-w-md w-full rounded-3xl text-center text-slate-800 bg-white shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-title"
          >
            <div class="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <h2 id="end-title" class="text-xl font-extrabold mb-2 text-slate-900 tracking-tight">
              Kết thúc phiên luyện nói?
            </h2>
            <p class="text-sm text-slate-500 mb-6 leading-relaxed">
              Bạn đã luyện tập được <strong class="text-slate-800">{{ elapsedSeconds() | formatTime }}</strong>. Toàn bộ hội thoại sẽ được AI phân tích và lưu vào báo cáo kết quả.
            </p>
            <div class="flex gap-3 justify-center">
              <button
                type="button"
                class="btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                (click)="showEndModal.set(false)"
              >
                Tiếp tục nói
              </button>
              <button
                type="button"
                class="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-sm active:scale-95"
                [disabled]="isEnding()"
                (click)="confirmEndSession()"
              >
                @if (isEnding()) {
                  <span>Đang lưu...</span>
                } @else {
                  <span>Xác nhận kết thúc</span>
                }
              </button>
            </div>
          </section>
        </div>
      }
    </main>
  `,
})
export class AiCoachSessionComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);
  readonly voiceService = inject(CoachVoiceService);
  private readonly coachService = inject(CoachService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);

  @ViewChild('transcriptContainer') private transcriptContainer!: ElementRef<HTMLDivElement>;

  readonly showEndModal = signal(false);
  readonly elapsedSeconds = signal(0);
  readonly isEnding = signal(false);
  readonly currentTopicTitle = signal<string>('Daily Conversation');
  readonly liveTranscripts = this.voiceService.liveTranscripts;

  readonly showTranslation = signal<Record<string, boolean>>({});
  readonly translationMap = signal<Record<string, string>>({});
  readonly loadingTranslation = signal<Record<string, boolean>>({});

  readonly showHints = signal(false);
  readonly userLevel = signal<string>('B1');
  readonly suggestions = this.voiceService.currentSuggestions;

  toggleHints(): void {
    this.showHints.update((v) => !v);
  }

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private isUserScrollingUp = false;

  constructor() {
    effect(() => {
      const items = this.liveTranscripts();
      if (items.length > 0) {
        this.scrollToBottom();
        for (const item of items) {
          if (!this.translationMap()[item.id]) {
            if (item.translation) {
              this.translationMap.update((m) => ({ ...m, [item.id]: item.translation! }));
            } else if (!item.isPartial) {
              this.prefetchTranslation(item);
            }
          }
        }
      }
    });
  }

  readonly stateText = computed(() => {
    const s = this.voiceService.uxState();
    switch (s) {
      case 'ready':
        return 'Sẵn sàng';
      case 'requesting_mic':
        return 'Đang xin quyền mic';
      case 'connecting':
        return 'Đang kết nối';
      case 'ai_speaking':
        return 'AI đang nói';
      case 'user_speaking':
        return 'Bạn đang nói';
      case 'processing':
        return 'Đang xử lý';
      case 'reconnecting':
        return 'Đang kết nối lại';
      case 'mic_error':
        return 'Lỗi microphone';
      case 'ai_error':
        return 'Lỗi dịch vụ AI';
      case 'ending':
        return 'Đang kết thúc';
    }
  });

  readonly stateBadgeClass = computed(() => {
    const s = this.voiceService.uxState();
    if (s === 'ai_speaking') return 'bg-sky-500/20 text-sky-300';
    if (s === 'user_speaking') return 'bg-rose-500/20 text-rose-300';
    if (s === 'processing') return 'bg-purple-500/20 text-purple-300';
    if (s === 'reconnecting') return 'bg-amber-500/20 text-amber-300';
    if (s === 'mic_error' || s === 'ai_error') return 'bg-rose-500/20 text-rose-300';
    return 'bg-slate-700 text-slate-300';
  });

  readonly stateDotClass = computed(() => {
    const s = this.voiceService.uxState();
    if (s === 'ai_speaking') return 'bg-sky-400 animate-pulse';
    if (s === 'user_speaking') return 'bg-rose-400 animate-ping';
    if (s === 'processing') return 'bg-purple-400 animate-spin';
    if (s === 'reconnecting') return 'bg-amber-400 animate-pulse';
    if (s === 'mic_error' || s === 'ai_error') return 'bg-rose-400';
    return 'bg-slate-400';
  });

  ngOnInit(): void {
    const qSessionId =
      this.route.snapshot.paramMap.get('id') ||
      this.route.snapshot.queryParamMap.get('sessionId');
    if (!qSessionId) {
      this.toastService.show('Không tìm thấy phiên thoại hợp lệ', 'error');
      void this.router.navigate(['/ai-coach']);
      return;
    }
    this.sessionId = qSessionId;

    this.coachService.getSession(this.sessionId).subscribe({
      next: (sess) => {
        if (sess.topic?.title) {
          this.currentTopicTitle.set(sess.topic.title);
        } else if (this.appState.selectedTopic()) {
          this.currentTopicTitle.set(this.appState.selectedTopic()!);
        }

        if (sess.transcripts && sess.transcripts.length > 0) {
          const initialItems: LiveTranscriptItem[] = sess.transcripts.map((t) => ({
            id: t.id,
            speaker: t.speaker,
            text: t.text,
            isPartial: false,
            time: '00:00',
            seq: t.seq,
          }));
          this.voiceService.liveTranscripts.set(initialItems);
        }

        if (sess.level) {
          this.userLevel.set(sess.level);
        }

        this.coachService.getSuggestions(this.sessionId!).subscribe({
          next: (res) => {
            if (res.suggestions?.length && this.voiceService.currentSuggestions().length === 0) {
              this.voiceService.currentSuggestions.set(res.suggestions);
            }
          },
          error: (err) => console.warn('Could not load suggestions:', err),
        });

        void this.voiceService.startVoiceSession(this.sessionId!);
        this.startTimer();
      },
      error: (err) => {
        console.error('Cannot retrieve session:', err);
        this.toastService.show('Không thể tải phiên thoại. Vui lòng thử lại.', 'error');
        void this.router.navigate(['/ai-coach']);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.voiceService.cleanup();
  }

  onMicButtonClick(): void {
    void this.voiceService.toggleSpeakingTurn();
  }

  replaySegment(item: LiveTranscriptItem): void {
    this.voiceService.playSegmentAudio(item);
  }

  playSampleAudio(text: string): void {
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

  onUserScroll(): void {
    if (!this.transcriptContainer) return;
    const el = this.transcriptContainer.nativeElement;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    this.isUserScrollingUp = !atBottom;
  }

  private scrollToBottom(): void {
    if (this.isUserScrollingUp || !this.transcriptContainer) return;
    setTimeout(() => {
      try {
        const el = this.transcriptContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      } catch {
        // Ignored
      }
    }, 50);
  }

  toggleMockMode(): void {
    this.voiceService.toggleMockMode();
  }

  closeEndModal(): void {
    this.showEndModal.set(false);
  }

  confirmEndSession(): void {
    if (!this.sessionId || this.isEnding()) return;

    this.isEnding.set(true);
    this.voiceService.uxState.set('ending');

    this.coachService.endSession(this.sessionId).subscribe({
      next: () => {
        this.isEnding.set(false);
        this.showEndModal.set(false);
        this.voiceService.cleanup();
        this.toastService.show('Đã lưu thành công phiên luyện nói!', 'success');
        void this.router.navigate(['/ai-coach/sessions', this.sessionId, 'feedback']);
      },
      error: (err) => {
        this.isEnding.set(false);
        console.error('Error ending session:', err);
        this.voiceService.cleanup();
        void this.router.navigate(['/ai-coach/sessions', this.sessionId, 'feedback']);
      },
    });
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
