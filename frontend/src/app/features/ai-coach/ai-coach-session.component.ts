import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppStateService } from '../../core/services/app-state.service';
import { AiCoachCompletedSession } from '../../core/models/app.models';
import { FormatTimePipe } from '../../shared/pipes/app-pipes';

export type SessionState = 'ready' | 'user-speaking' | 'processing' | 'ai-speaking' | 'error';
interface TranscriptLine { id: number; speaker: 'User' | 'AI'; text: string; time: string; }

const MOCK_ANSWERS = [
  'I enjoy this topic because it gives me a chance to share my experiences and learn something new.',
  'One example that comes to mind is a memorable day with my friends. We had a great time together.',
  'In the future, I would like to explore this more because it helps me understand different perspectives.'
];
const MOCK_AI_RESPONSES = [
  'That is a thoughtful answer. Could you tell me a little more about what made that experience special?',
  'I see what you mean. How do you think this might change in the future?',
  'That sounds interesting! What would you recommend to someone new to this topic?'
];

@Component({
  selector: 'app-ai-coach-session', standalone: true, imports: [CommonModule, FormatTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (appState.selectedTopic()) {
      <main class="fixed inset-0 z-50 flex flex-col" style="background:#0f172a;color:white">
        <header class="flex items-center gap-4 px-6 py-4" style="background:#1e293b;border-bottom:1px solid #334155">
          <div><h1 class="font-700">{{ appState.selectedTopic() }}</h1><p class="text-sm" aria-live="polite">{{ stateLabel() }}</p></div>
          <div class="ml-auto flex items-center gap-4"><span class="font-mono text-lg">{{ timer() | formatTime }}</span>
            <button class="btn-accent cursor-pointer" (click)="showEndModal.set(true)">End Session</button></div>
        </header>
        <section class="flex-1 overflow-y-auto p-6 max-w-3xl w-full mx-auto" aria-label="Conversation transcript" aria-live="polite">
          @for (line of transcript(); track line.id) {
            <article class="my-4 flex" [class.justify-end]="line.speaker === 'User'">
              <div class="max-w-xl rounded-2xl p-4" [style.background]="line.speaker === 'AI' ? '#1e293b' : '#064e3b'">
                <div class="text-xs opacity-70">{{ line.speaker }} · {{ line.time }}</div><p>{{ line.text }}</p>
              </div>
            </article>
          }
        </section>
        <footer class="p-6 flex flex-col items-center gap-3" style="background:#1e293b">
          <p class="text-sm" aria-live="polite">Mock microphone: <strong>{{ micActive() ? 'On' : 'Off' }}</strong></p>
          @if (state() === 'error') { <p role="alert" class="text-rose-300">The mock response could not be completed. Please try again.</p><button class="btn-secondary cursor-pointer" (click)="retry()">Retry</button> }
          <div class="flex flex-wrap justify-center gap-3">
            <button class="btn-secondary cursor-pointer" (click)="toggleMic()">{{ micActive() ? 'Turn microphone off' : 'Turn microphone on' }}</button>
            <button class="btn-primary cursor-pointer" [disabled]="state() !== 'user-speaking'" (click)="submitMockAnswer()">Submit mock answer</button>
            <button class="btn-secondary cursor-pointer" (click)="triggerMockError()">Simulate mock error</button>
          </div>
        </footer>
        @if (showEndModal()) {
          <div class="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" role="presentation">
            <section class="card p-6 max-w-md w-full text-center" role="dialog" aria-modal="true" aria-labelledby="end-title">
              <h2 id="end-title" class="text-xl font-700 mb-3">End this session?</h2><p class="mb-6">Your practice report will be saved to your learning history.</p>
              <div class="flex justify-center gap-3"><button class="btn-secondary cursor-pointer" (click)="showEndModal.set(false)">Continue</button><button class="btn-primary cursor-pointer" (click)="endSession()">End Session</button></div>
            </section>
          </div>
        }
      </main>
    }
  `
})
export class AiCoachSessionComponent implements OnInit, OnDestroy {
  readonly appState = inject(AppStateService);
  private readonly router = inject(Router);
  readonly state = signal<SessionState>('ready');
  readonly timer = signal(0);
  readonly micActive = signal(false);
  readonly transcript = signal<TranscriptLine[]>([]);
  readonly showEndModal = signal(false);
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private turn = 0;

  ngOnInit(): void {
    const topic = this.appState.selectedTopic();
    if (!topic) { void this.router.navigateByUrl('/ai-coach'); return; }
    this.startedAt = Date.now();
    this.transcript.set([{ id: 1, speaker: 'AI', text: `Welcome! Let’s practice ${topic}. What would you like to share about it?`, time: '00:00' }]);
    this.timerInterval = setInterval(() => this.timer.set(Math.floor((Date.now() - this.startedAt) / 1000)), 1000);
  }

  ngOnDestroy(): void { this.stopResources(); }

  stateLabel(): string {
    return ({ ready: 'Ready · turn the mock microphone on to answer', 'user-speaking': 'You are speaking · mock microphone is active', processing: 'Processing your mock answer…', 'ai-speaking': 'AI is responding…', error: 'Mock error · retry available' } as Record<SessionState, string>)[this.state()];
  }

  toggleMic(): void {
    if (this.state() === 'processing' || this.state() === 'ai-speaking' || this.state() === 'error') return;
    const active = !this.micActive();
    this.micActive.set(active);
    this.state.set(active ? 'user-speaking' : 'ready');
  }

  submitMockAnswer(): void {
    if (this.state() !== 'user-speaking') return;
    this.micActive.set(false);
    this.state.set('processing');
    const answer = MOCK_ANSWERS[this.turn % MOCK_ANSWERS.length];
    this.transcript.update(lines => [...lines, { id: lines.length + 1, speaker: 'User', text: answer, time: this.formatElapsed() }]);
    this.pendingTimeout = setTimeout(() => {
      this.pendingTimeout = null;
      this.state.set('ai-speaking');
      const response = MOCK_AI_RESPONSES[this.turn % MOCK_AI_RESPONSES.length];
      this.transcript.update(lines => [...lines, { id: lines.length + 1, speaker: 'AI', text: response, time: this.formatElapsed() }]);
      this.turn++;
      this.pendingTimeout = setTimeout(() => { this.pendingTimeout = null; this.state.set('ready'); }, 900);
    }, 900);
  }

  triggerMockError(): void { this.clearPendingTimeout(); this.micActive.set(false); this.state.set('error'); }
  retry(): void { this.state.set('ready'); }

  endSession(): void {
    this.showEndModal.set(false);
    this.stopResources();
    const duration = this.timer();
    const session: AiCoachCompletedSession = {
      id: `${Date.now()}`, topic: this.appState.selectedTopic() ?? 'AI Coach', type: 'ai-coach',
      date: new Date().toLocaleString(), completedAt: new Date().toISOString(), duration: this.formatTime(duration),
      score: 82, overallScore: 82, xp: 120, status: 'completed', emoji: '🎙️',
      skills: [{ label: 'Fluency', score: 84 }, { label: 'Vocabulary', score: 82 }, { label: 'Grammar', score: 79 }, { label: 'Pronunciation', score: 83 }],
      strengths: ['Good vocabulary usage', 'Clear responses', 'Good conversation flow'],
      improvements: ['Practice past tense', 'Reduce hesitation', 'Improve pronunciation consistency']
    };
    this.appState.completeAiCoachSession(session);
    void this.router.navigateByUrl('/ai-coach-report');
  }

  private formatElapsed(): string { return `${String(Math.floor(this.timer() / 60)).padStart(2, '0')}:${String(this.timer() % 60).padStart(2, '0')}`; }
  private formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
  private clearPendingTimeout(): void { if (this.pendingTimeout) clearTimeout(this.pendingTimeout); this.pendingTimeout = null; }
  private stopResources(): void { if (this.timerInterval) clearInterval(this.timerInterval); this.timerInterval = null; this.clearPendingTimeout(); }
}
