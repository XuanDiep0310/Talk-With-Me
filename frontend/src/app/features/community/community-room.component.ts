import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';

export interface RoomMember {
  name: string;
  emoji: string;
  color: string;
  speaking: boolean;
}

export interface RoomLine {
  id: number;
  speaker: string;
  text: string;
  time: string;
}

export const MEMBERS: RoomMember[] = [
  { name: "Bạn", emoji: "👤", color: "#286FB4", speaking: false },
  { name: "Lan", emoji: "👩", color: "#DF4C73", speaking: false },
  { name: "Minh", emoji: "👨", color: "#7c3aed", speaking: false },
  { name: "Hoa", emoji: "🧑", color: "#059669", speaking: false }
];

export const TRANSCRIPT_SEED: RoomLine[] = [
  { id: 1, speaker: "Lan", text: "So, what did everyone do this weekend? I went hiking near the city!", time: "00:03" },
  { id: 2, speaker: "Minh", text: "That sounds amazing! I stayed home and binged a Netflix series. Total couch potato mode.", time: "00:18" },
  { id: 3, speaker: "Hoa", text: "I tried a new coffee shop downtown. The vibes were so good!", time: "00:35" }
];

@Component({
  selector: 'app-community-room',
  standalone: true,
  imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 flex flex-col z-50" style="background: #0f172a">
      <!-- Top header bar -->
      <div class="flex items-center gap-4 px-5 py-4 shrink-0" style="background: #1e293b; border-bottom: 1px solid #334155">
        <span class="text-2xl">{{ appState.selectedRoom()?.name || 'Voice Room' }}</span>
        <div>
          <div class="text-white font-700 text-sm" style="font-weight: 700">
            {{ appState.selectedRoom()?.name || 'Phòng luyện nói cộng đồng' }}
          </div>
          <div class="flex items-center gap-2">
            <span class="badge" style="background: #0f172a; color: #B0DDE4; font-size: 11px">
              {{ appState.selectedRoom()?.level || 'B1' }}
            </span>
            <span class="badge" style="background: #0f172a; color: #a78bfa; font-size: 11px">
              {{ appState.selectedRoom()?.topic || 'Daily Talk' }}
            </span>
          </div>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <div class="font-700 text-lg font-mono" style="color: #286FB4; font-weight: 700">
            {{ timer() | formatTime }}
          </div>
          <button class="px-4 py-2 rounded-xl text-sm font-600 text-white cursor-pointer" style="background: #DF4C73; font-weight: 600" (click)="showLeave.set(true)">
            Rời phòng
          </button>
        </div>
      </div>

      <!-- Main room section -->
      <div class="flex flex-1 overflow-hidden">
        <div class="flex-1 flex flex-col overflow-hidden">
          <!-- Active Speakers Circle -->
          <div class="shrink-0 p-6" style="background: #1e293b; border-bottom: 1px solid #334155">
            <div class="flex items-center justify-center gap-8">
              @for (m of members; track m.name; let i = $index) {
                <div class="flex flex-col items-center gap-2">
                  <div class="relative">
                    <div
                      class="w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-300"
                      [style.background]="activeIdx() === i ? m.color : '#334155'"
                      [style.transform]="activeIdx() === i ? 'scale(1.1)' : 'scale(1)'"
                    >
                      {{ m.emoji }}
                    </div>
                  </div>
                  <div class="text-xs font-500" [style.color]="activeIdx() === i ? '#fff' : '#94a3b8'" style="font-weight: 500">
                    {{ m.name }}
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Live Speech Transcript -->
          <div class="flex-1 overflow-y-auto p-5 space-y-3">
            @for (line of transcript(); track line.id) {
              <div class="flex gap-3" [class.justify-end]="line.speaker === 'Bạn'" [class.justify-start]="line.speaker !== 'Bạn'">
                <div class="max-w-[75%]">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-600 text-sky-400" style="font-weight: 600">{{ line.speaker }}</span>
                    <span class="text-xs text-slate-500">{{ line.time }}</span>
                  </div>
                  <div class="px-4 py-3 rounded-2xl text-sm" [style.background]="line.speaker === 'Bạn' ? '#286FB4' : '#1e293b'" style="color: #fff">
                    {{ line.text }}
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Bottom interactive mic bar -->
          <div class="p-4 shrink-0 flex items-center justify-center gap-4" style="background: #1e293b; border-top: 1px solid #334155">
            <button class="p-3.5 rounded-full bg-slate-700 text-white cursor-pointer" (click)="toggleMic()">
              @if (micMuted()) { 🔇 } @else { 🎙️ }
            </button>
            <button class="btn-primary px-6 py-2.5 rounded-full text-sm cursor-pointer" (click)="simulateUserSpeak()">
              🗣️ Giơ tay / Bắt đầu phát biểu
            </button>
          </div>
        </div>
      </div>

      <!-- Leave Room Modal -->
      @if (showLeave()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div class="card p-6 max-w-sm w-full bg-slate-800 text-white border-slate-700 text-center">
            <div class="text-4xl mb-3">👋</div>
            <h3 class="text-lg font-700 mb-2">Rời khỏi phòng voice?</h3>
            <p class="text-xs text-slate-400 mb-6">Bạn có thể quay lại danh sách phòng bất kỳ lúc nào.</p>
            <div class="flex gap-3 justify-center">
              <button class="btn-secondary text-sm cursor-pointer" (click)="showLeave.set(false)">Ở lại</button>
              <button class="btn-accent text-sm cursor-pointer" (click)="leaveRoom()">Rời phòng</button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class CommunityRoomComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);

  readonly timer = signal(0);
  readonly activeIdx = signal(0);
  readonly micMuted = signal(false);
  readonly showLeave = signal(false);
  readonly transcript = signal<RoomLine[]>(TRANSCRIPT_SEED);

  readonly members = MEMBERS;

  private timerInterval: any = null;
  private speakerInterval: any = null;

  ngOnInit(): void {
    this.timerInterval = setInterval(() => {
      this.timer.update(t => t + 1);
    }, 1000);

    this.speakerInterval = setInterval(() => {
      this.activeIdx.update(i => (i + 1) % this.members.length);
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.speakerInterval) clearInterval(this.speakerInterval);
  }

  simulateUserSpeak(): void {
    this.activeIdx.set(0);
    const newLine: RoomLine = {
      id: Date.now(),
      speaker: "Bạn",
      text: "I totally agree! I spent my weekend reading a great book.",
      time: "01:12"
    };
    this.transcript.update(list => [...list, newLine]);
  }

  toggleMic(): void {
    this.micMuted.update(value => !value);
  }

  leaveRoom(): void {
    this.showLeave.set(false);
    this.appState.go("community");
  }
}
