import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

export interface Chunk {
  id: string;
  label: string;
  function: string;
  chunk: string;
  meaning: string;
  example: string;
  exampleVi: string;
  color: string;
  bg: string;
}

export type DetailStep = "context" | "chunks" | "drill";

export const GENERIC_CHUNKS: Chunk[] = [
  {
    id: "g1", label: "Mở đầu", function: "Bắt đầu tình huống",
    chunk: "Excuse me, could I...?",
    meaning: "Xin lỗi, tôi có thể...?",
    example: "Excuse me, could I ask you something about this?",
    exampleVi: "Xin lỗi, tôi có thể hỏi bạn điều này được không?",
    color: "#286FB4", bg: "#E2F0F9",
  },
  {
    id: "g2", label: "Đề nghị / Yêu cầu", function: "Nêu yêu cầu chính",
    chunk: "I'd like to...",
    meaning: "Tôi muốn...",
    example: "I'd like to know more about the options available.",
    exampleVi: "Tôi muốn biết thêm về các lựa chọn hiện có.",
    color: "#7c3aed", bg: "#F5F3FF",
  },
  {
    id: "g3", label: "Làm rõ", function: "Hỏi thêm để hiểu rõ hơn",
    chunk: "Could you explain...?",
    meaning: "Bạn có thể giải thích...?",
    example: "Could you explain how this works exactly?",
    exampleVi: "Bạn có thể giải thích chính xác điều này hoạt động thế nào không?",
    color: "#059669", bg: "#ECFDF5",
  },
  {
    id: "g4", label: "Đồng ý / Xác nhận", function: "Đồng ý hoặc xác nhận thông tin",
    chunk: "That works for me.",
    meaning: "Điều đó phù hợp với tôi.",
    example: "That works for me. Let's go ahead with that plan.",
    exampleVi: "Điều đó phù hợp với tôi. Hãy tiếp tục với kế hoạch đó.",
    color: "#f59e0b", bg: "#FFF5E5",
  },
  {
    id: "g5", label: "Từ chối / Thay thế", function: "Lịch sự từ chối hoặc đề xuất thay thế",
    chunk: "I'm afraid I can't..., but maybe...",
    meaning: "Tôi e rằng tôi không thể..., nhưng có lẽ...",
    example: "I'm afraid I can't do that right now, but maybe we could schedule it for next week?",
    exampleVi: "Tôi e rằng tôi không thể làm điều đó ngay bây giờ, nhưng có lẽ chúng ta có thể lên lịch cho tuần sau?",
    color: "#DF4C73", bg: "#FFF0F3",
  },
  {
    id: "g6", label: "Kết thúc", function: "Kết thúc cuộc trò chuyện",
    chunk: "Thank you so much for your help!",
    meaning: "Cảm ơn bạn rất nhiều vì đã giúp đỡ!",
    example: "Thank you so much for your help! I really appreciate it.",
    exampleVi: "Cảm ơn bạn rất nhiều vì đã giúp đỡ! Tôi thực sự trân trọng điều đó.",
    color: "#64748b", bg: "#F1F5F9",
  }
];

@Component({
  selector: 'app-scenario-detail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <!-- Top header bar -->
      <div class="flex items-center gap-4">
        <button class="w-9 h-9 rounded-xl flex items-center justify-center btn-secondary cursor-pointer" (click)="appState.go('scenarios')">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <div>
          <h1 class="text-2xl font-800" style="font-weight: 800; color: #1e293b">{{ title() }}</h1>
          <p class="text-sm" style="color: #64748b">Tình huống thực tế · Level {{ level() }}</p>
        </div>
      </div>

      <!-- Steps tab bar -->
      <div class="flex border-b border-slate-200 gap-8">
        <button
          class="pb-3 text-sm font-700 transition-all border-b-2 cursor-pointer"
          [style.borderColor]="step() === 'context' ? '#286FB4' : 'transparent'"
          [style.color]="step() === 'context' ? '#286FB4' : '#64748b'"
          (click)="step.set('context')"
        >
          1. Bối cảnh & Mục tiêu
        </button>
        <button
          class="pb-3 text-sm font-700 transition-all border-b-2 cursor-pointer"
          [style.borderColor]="step() === 'chunks' ? '#286FB4' : 'transparent'"
          [style.color]="step() === 'chunks' ? '#286FB4' : '#64748b'"
          (click)="step.set('chunks')"
        >
          2. Mẫu câu (Chunks)
        </button>
        <button
          class="pb-3 text-sm font-700 transition-all border-b-2 cursor-pointer"
          [style.borderColor]="step() === 'drill' ? '#286FB4' : 'transparent'"
          [style.color]="step() === 'drill' ? '#286FB4' : '#64748b'"
          (click)="step.set('drill')"
        >
          3. Luyện phản xạ
        </button>
      </div>

      <!-- Step content -->
      @switch (step()) {
        @case ('context') {
          <div class="card p-6 space-y-6">
            <div>
              <h3 class="font-700 text-base mb-2" style="font-weight: 700; color: #1e293b">Mô tả bối cảnh</h3>
              <p class="text-sm leading-relaxed" style="color: #475569">{{ desc() }}</p>
            </div>

            <div>
              <h3 class="font-700 text-base mb-3" style="font-weight: 700; color: #1e293b">Mục tiêu bài luyện</h3>
              <div class="space-y-2">
                @for (obj of objectives; track obj) {
                  <div class="flex items-center gap-2 text-sm text-slate-700">
                    <span class="text-emerald-500 font-bold">✓</span>
                    <span>{{ obj }}</span>
                  </div>
                }
              </div>
            </div>

            <div class="pt-4 border-t flex justify-end">
              <button class="btn-primary cursor-pointer" (click)="step.set('chunks')">
                Tiếp tục: Học Chunks mẫu →
              </button>
            </div>
          </div>
        }

        @case ('chunks') {
          <div class="space-y-4">
            <p class="text-sm text-slate-600">Các mẫu câu (Language Chunks) quan trọng nhất cho tình huống này:</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (c of chunks; track c.id) {
                <div class="card p-5 border-l-4" [style.borderLeftColor]="c.color">
                  <div class="flex items-center justify-between mb-2">
                    <span class="badge" [style.background]="c.bg" [style.color]="c.color">{{ c.label }}</span>
                    <span class="text-xs text-slate-400">{{ c.function }}</span>
                  </div>
                  <div class="font-700 text-base mb-1" style="font-weight: 700; color: #1e293b">"{{ c.chunk }}"</div>
                  <div class="text-xs text-slate-500 mb-3">{{ c.meaning }}</div>
                  <div class="p-3 rounded-xl bg-slate-50 text-xs italic text-slate-700 border border-slate-200">
                    <div>💬 {{ c.example }}</div>
                    <div class="text-slate-400 mt-1 not-italic">{{ c.exampleVi }}</div>
                  </div>
                </div>
              }
            </div>

            <div class="pt-4 flex justify-end">
              <button class="btn-primary cursor-pointer" (click)="step.set('drill')">
                Tiếp tục: Luyện phản xạ →
              </button>
            </div>
          </div>
        }

        @case ('drill') {
          <div class="card p-6 text-center space-y-6">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-700 bg-sky-100 text-sky-800">
              Chunk {{ drillIdx() + 1 }} / {{ chunks.length }}
            </div>

            @if (currentChunk(); as c) {
              <div>
                <h3 class="text-2xl font-800 mb-2" style="font-weight: 800; color: #1e293b">"{{ c.chunk }}"</h3>
                <p class="text-sm text-slate-500">{{ c.meaning }}</p>
              </div>

              <div class="p-4 rounded-2xl bg-sky-50 text-sky-900 text-sm max-w-lg mx-auto border border-sky-100">
                <div class="font-600 mb-1">Ví dụ nói:</div>
                <div class="italic">"{{ c.example }}"</div>
              </div>

              <div class="flex justify-center gap-4 pt-4">
                <button class="btn-primary px-8 py-3.5 text-base cursor-pointer" (click)="startRoleplay()">
                  🎭 Bắt đầu Roleplay ngay!
                </button>
              </div>
            }
          </div>
        }
      }
    </div>
  `
})
export class ScenarioDetailComponent {
  readonly appState = inject(AppStateService);

  readonly step = signal<DetailStep>("context");
  readonly drillIdx = signal(0);
  readonly chunks = GENERIC_CHUNKS;

  readonly title = computed(() => this.appState.selectedScenario()?.title || "Đặt bàn tại nhà hàng");
  readonly level = computed(() => this.appState.selectedScenario()?.level || "A2");
  readonly desc = computed(() => this.appState.selectedScenario()?.description || "Luyện tập đặt bàn, yêu cầu món ăn và giao tiếp với nhân viên phục vụ nhà hàng.");

  readonly objectives = [
    "Chào hỏi và yêu cầu vị trí bàn",
    "Đặt món ăn và giải thích yêu cầu chế độ ăn",
    "Hỏi thông tin về các món ăn trong thực đơn",
    "Yêu cầu tính tiền và thanh toán gọn gàng"
  ];

  readonly currentChunk = computed(() => this.chunks[this.drillIdx()]);

  startRoleplay(): void {
    this.appState.go("scenario-roleplay");
  }
}
