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
} from '../../core/services/scenario.service';

export type DetailStep = 'context' | 'chunks' | 'drill';

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
    <div class="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <!-- Top header bar -->
      <div class="flex items-center gap-4">
        <button
          type="button"
          aria-label="Quay lại danh sách"
          class="w-10 h-10 rounded-xl flex items-center justify-center btn-secondary cursor-pointer"
          (click)="goBack()"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-800 truncate" style="font-weight: 800; color: #1e293b">
              {{ scenario()?.titleVi || 'Tình huống' }}
            </h1>
            <span class="badge" style="background: #E2F0F9; color: #286FB4; font-weight: 700">
              {{ scenario()?.level }}
            </span>
          </div>
          <p class="text-xs text-slate-500 font-500 italic">
            {{ scenario()?.titleEn }} · ⏱ {{ scenario()?.estimatedDurationMinutes || 10 }} phút · +{{ scenario()?.xpReward || 100 }} XP
          </p>
        </div>
      </div>

      <!-- Steps tab bar -->
      <div class="flex border-b border-slate-200 gap-8">
        <button
          type="button"
          class="pb-3 text-sm font-700 transition-all border-b-2 cursor-pointer"
          [style.borderColor]="step() === 'context' ? '#286FB4' : 'transparent'"
          [style.color]="step() === 'context' ? '#286FB4' : '#64748b'"
          (click)="step.set('context')"
        >
          1. Bối cảnh & Mục tiêu
        </button>
        <button
          type="button"
          class="pb-3 text-sm font-700 transition-all border-b-2 cursor-pointer"
          [style.borderColor]="step() === 'chunks' ? '#286FB4' : 'transparent'"
          [style.color]="step() === 'chunks' ? '#286FB4' : '#64748b'"
          (click)="step.set('chunks')"
        >
          2. Mẫu câu (Chunks)
        </button>
        <button
          type="button"
          class="pb-3 text-sm font-700 transition-all border-b-2 cursor-pointer"
          [style.borderColor]="step() === 'drill' ? '#286FB4' : 'transparent'"
          [style.color]="step() === 'drill' ? '#286FB4' : '#64748b'"
          (click)="step.set('drill')"
        >
          3. Luyện phản xạ
        </button>
      </div>

      <!-- Loading / Error states -->
      @if (isLoading()) {
        <div class="py-16 text-center text-slate-400">
          <div class="text-3xl animate-bounce mb-2">⏳</div>
          <p class="text-sm">Đang tải nội dung tình huống...</p>
        </div>
      } @else if (errorMessage()) {
        <div class="card p-6 text-center text-rose-600 bg-rose-50 border-rose-200">
          <p>{{ errorMessage() }}</p>
          <button type="button" class="btn-secondary mt-3 cursor-pointer" (click)="loadScenario()">
            Thử lại
          </button>
        </div>
      } @else {
        @if (scenario(); as s) {
          <!-- Tab 1: Context & Goals -->
          @if (step() === 'context') {
            <div class="card p-6 space-y-6">
              <!-- Context description -->
              <div>
                <h3 class="font-700 text-base mb-2" style="font-weight: 700; color: #1e293b">
                  📖 Bối cảnh tình huống
                </h3>
                <p class="text-sm leading-relaxed text-slate-700 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  {{ s.context }}
                </p>
              </div>

              <!-- Roles -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div class="p-4 rounded-xl bg-sky-50 border border-sky-100">
                  <div class="text-xs text-sky-700 font-700 uppercase tracking-wider mb-1">
                    👤 Vai của bạn
                  </div>
                  <div class="text-sm font-700 text-slate-800">{{ s.userRole }}</div>
                </div>
                <div class="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                  <div class="text-xs text-indigo-700 font-700 uppercase tracking-wider mb-1">
                    🤖 Vai của AI
                  </div>
                  <div class="text-sm font-700 text-slate-800">{{ s.aiRole }}</div>
                </div>
              </div>

              <!-- Objectives / Requirements -->
              <div>
                <h3 class="font-700 text-base mb-3" style="font-weight: 700; color: #1e293b">
                  🎯 Mục tiêu nhiệm vụ cần đạt
                </h3>
                <div class="space-y-2.5">
                  @for (req of s.requirements; track req.id) {
                    <div class="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/80">
                      <span class="text-emerald-600 font-bold text-sm mt-0.5">✓</span>
                      <div class="flex-1">
                        <div class="text-sm font-600 text-slate-800">{{ req.description }}</div>
                        @if (req.expectedChunkFunction) {
                          <div class="text-[11px] text-slate-500 font-500 mt-0.5">
                            Chức năng kỳ vọng: <span class="font-600 text-slate-700">{{ req.expectedChunkFunction }}</span>
                          </div>
                        }
                      </div>
                      @if (req.isMandatory) {
                        <span class="badge" style="background: #FEE2E2; color: #991B1B; font-size: 10px; font-weight: 700">
                          Bắt buộc
                        </span>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Next button -->
              <div class="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  class="btn-primary cursor-pointer px-6 py-2.5"
                  (click)="step.set('chunks')"
                >
                  Tiếp tục: Học Chunks mẫu →
                </button>
              </div>
            </div>
          }

          <!-- Tab 2: Chunks list -->
          @if (step() === 'chunks') {
            <div class="space-y-4">
              <p class="text-sm text-slate-600">
                Các mẫu câu (Language Chunks) quan trọng nhất cho tình huống này. Hãy nghe và ghi nhớ để dùng trong hội thoại:
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (c of s.chunks; track c.id) {
                  <div
                    class="card p-5 border-l-4 flex flex-col justify-between"
                    [style.borderLeftColor]="getTagMeta(c.functionTag).color"
                  >
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <span
                          class="badge"
                          [style.background]="getTagMeta(c.functionTag).bg"
                          [style.color]="getTagMeta(c.functionTag).color"
                          style="font-weight: 700; font-size: 11px"
                        >
                          {{ getTagMeta(c.functionTag).label }}
                        </span>
                        <button
                          type="button"
                          class="w-8 h-8 rounded-full flex items-center justify-center bg-sky-50 hover:bg-sky-100 text-sky-700 transition cursor-pointer"
                          title="Nghe mẫu phát âm"
                          (click)="playAudio(c.text, c.audioUrl)"
                        >
                          🔊
                        </button>
                      </div>

                      <div class="font-700 text-lg mb-1" style="font-weight: 700; color: #1e293b">
                        "{{ c.text }}"
                      </div>
                      <div class="text-xs text-slate-500 mb-3">{{ c.meaningVi }}</div>

                      <div class="p-3 rounded-xl bg-slate-50 text-xs text-slate-700 border border-slate-100 space-y-1">
                        <div class="font-600 text-slate-800">💬 {{ c.exampleSentence }}</div>
                      </div>
                    </div>

                    @if (c.acceptedVariations && c.acceptedVariations.length > 0) {
                      <div class="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-400">
                        Biến thể chấp nhận: <span class="italic text-slate-600">{{ c.acceptedVariations.join(', ') }}</span>
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  class="btn-secondary cursor-pointer"
                  (click)="step.set('context')"
                >
                  ← Quay lại bối cảnh
                </button>
                <button
                  type="button"
                  class="btn-primary cursor-pointer px-6 py-2.5"
                  (click)="step.set('drill')"
                >
                  Tiếp tục: Luyện phản xạ →
                </button>
              </div>
            </div>
          }

          <!-- Tab 3: Reflex Drill -->
          @if (step() === 'drill') {
            <div class="card p-6 text-center space-y-6">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-700 bg-sky-100 text-sky-800">
                  Chunk {{ drillIdx() + 1 }} / {{ s.chunks.length }}
                </span>
                <span class="text-xs text-slate-400">Luyện phản xạ trước khi Roleplay</span>
              </div>

              @if (currentChunk(); as c) {
                <div>
                  <div class="flex items-center justify-center gap-2 mb-2">
                    <h3 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">
                      "{{ c.text }}"
                    </h3>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full flex items-center justify-center bg-sky-50 hover:bg-sky-100 text-sky-700 cursor-pointer"
                      title="Nghe mẫu phát âm"
                      (click)="playAudio(c.text, c.audioUrl)"
                    >
                      🔊
                    </button>
                  </div>
                  <p class="text-sm text-slate-500">{{ c.meaningVi }}</p>
                </div>

                <div class="p-4 rounded-2xl bg-sky-50 text-sky-900 text-sm max-w-lg mx-auto border border-sky-100 text-left">
                  <div class="font-700 mb-1">Ví dụ nói trong thực tế:</div>
                  <div class="italic">"{{ c.exampleSentence }}"</div>
                </div>

                <!-- Mic button and speech recognition -->
                <div class="flex flex-col items-center gap-4 pt-2">
                  <button
                    type="button"
                    class="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white transition-all cursor-pointer shadow-md hover:scale-105"
                    [style.background]="isListening() ? '#DF4C73' : '#286FB4'"
                    [attr.aria-label]="isListening() ? 'Dừng ghi âm' : 'Bắt đầu đọc lại chunk'"
                    (click)="toggleMicrophone()"
                  >
                    {{ isListening() ? '⏹' : '🎙️' }}
                  </button>
                  <span class="text-sm text-slate-500">
                    {{ isListening() ? 'Đang nghe, bạn hãy đọc to mẫu câu...' : 'Nhấn mic và đọc to câu mẫu trên' }}
                  </span>

                  @if (recognizedSpeech()) {
                    <div class="w-full max-w-lg rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
                      <span class="font-700">Bạn đã nói:</span> "{{ recognizedSpeech() }}"
                    </div>
                  }

                  @if (drillMessage()) {
                    <p class="text-sm font-600 text-emerald-700">{{ drillMessage() }}</p>
                  }

                  <!-- Actions: Nói lại, Câu tiếp theo, Bỏ qua -->
                  <div class="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      type="button"
                      class="btn-secondary cursor-pointer px-4 py-2 text-sm font-600"
                      (click)="repeatChunk(c.id)"
                    >
                      🔄 Nói lại
                    </button>
                    <button
                      type="button"
                      class="btn-secondary cursor-pointer px-4 py-2 text-sm font-600"
                      (click)="skipChunk(c.id)"
                    >
                      ⏭ Bỏ qua
                    </button>
                    @if (drillIdx() < s.chunks.length - 1) {
                      <button
                        type="button"
                        class="btn-primary cursor-pointer px-4 py-2 text-sm font-600"
                        (click)="nextChunk(c.id)"
                      >
                        → Câu tiếp theo
                      </button>
                    }
                  </div>

                  <!-- Roleplay launch -->
                  <div class="pt-6 border-t border-slate-100 w-full flex justify-center">
                    <button
                      type="button"
                      class="btn-primary px-8 py-3.5 text-base font-700 cursor-pointer shadow-lg hover:shadow-xl transition-all"
                      [disabled]="isStartingRoleplay()"
                      (click)="startRoleplay()"
                    >
                      {{ isStartingRoleplay() ? 'Đang tạo phòng roleplay...' : '🎭 Bắt đầu Roleplay ngay!' }}
                    </button>
                  </div>
                </div>
              }
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

  readonly step = signal<DetailStep>('context');
  readonly drillIdx = signal(0);
  readonly isListening = signal(false);
  readonly recognizedSpeech = signal('');
  readonly drillMessage = signal<string | null>(null);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isStartingRoleplay = signal(false);

  readonly scenario = signal<ScenarioDetail | null>(null);

  private speechSub?: Subscription;

  readonly currentChunk = computed<ScenarioChunk | null>(() => {
    const s = this.scenario();
    if (!s || !s.chunks || s.chunks.length === 0) return null;
    const idx = this.drillIdx();
    return s.chunks[idx] || s.chunks[0];
  });

  ngOnInit(): void {
    this.loadScenario();
    this.speechSub = this.speechService.speechResult$.subscribe((res) => {
      this.recognizedSpeech.set(res.text);
      this.isListening.set(false);
      this.drillMessage.set('Đã ghi nhận câu nói của bạn!');
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
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Không thể tải thông tin tình huống.');
        this.isLoading.set(false);
      },
    });
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

  playAudio(text: string, audioUrl?: string | null): void {
    this.scenarioService.playChunkAudio(text, audioUrl);
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

  repeatChunk(chunkId: string): void {
    const s = this.scenario();
    if (!s) return;
    this.scenarioService
      .recordDrill(s.id, {
        chunkId,
        isSkipped: false,
      })
      .subscribe();
    this.recognizedSpeech.set('');
    this.drillMessage.set('Đã lưu lượt nói lại. Hãy thử đọc lại thật trôi chảy!');
  }

  skipChunk(chunkId: string): void {
    const s = this.scenario();
    if (!s) return;
    this.scenarioService
      .recordDrill(s.id, {
        chunkId,
        isSkipped: true,
      })
      .subscribe();
    this.recognizedSpeech.set('');
    this.drillMessage.set(null);
    if (this.drillIdx() < s.chunks.length - 1) {
      this.drillIdx.update((i) => i + 1);
    }
  }

  nextChunk(chunkId: string): void {
    const s = this.scenario();
    if (!s) return;
    this.scenarioService
      .recordDrill(s.id, {
        chunkId,
        isSkipped: false,
      })
      .subscribe();
    this.recognizedSpeech.set('');
    this.drillMessage.set(null);
    if (this.drillIdx() < s.chunks.length - 1) {
      this.drillIdx.update((i) => i + 1);
    }
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
