import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-ai-coach-report', standalone: true, imports: [CommonModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <header class="flex items-center gap-4"><button class="btn-secondary cursor-pointer" (click)="appState.go('ai-coach')">← AI Coach</button>
        <div><h1 class="text-2xl font-800">AI Coach Report</h1><p class="text-sm text-slate-500">{{ session()?.topic ?? 'No completed session' }}</p></div>
      </header>
      @if (session(); as report) {
        <section class="card p-6 text-white" style="background:linear-gradient(135deg,#286FB4,#1d5a94)">
          <div class="flex flex-wrap items-center justify-between gap-4"><div><p class="text-sm opacity-80">Overall Score</p><p class="text-5xl font-800">{{ report.overallScore }}<span class="text-2xl">/100</span></p></div>
            <div><p class="text-sm opacity-80">Session duration</p><p class="text-xl font-700">{{ report.duration }}</p></div>
            <div><p class="text-sm opacity-80">Reward</p><p class="text-2xl font-700">+{{ report.xp }} XP</p></div></div>
        </section>
        <section class="card p-6"><h2 class="text-lg font-700 mb-5">Skills</h2><div class="space-y-4">
          @for (skill of report.skills; track skill.label) { <div><div class="flex justify-between mb-1"><span>{{ skill.label }}</span><strong>{{ skill.score }}/100</strong></div><div class="h-2.5 rounded-full bg-slate-100"><div class="h-2.5 rounded-full bg-blue-600" [style.width.%]="skill.score"></div></div></div> }
        </div></section>
        <div class="grid md:grid-cols-2 gap-6"><section class="card p-6"><h2 class="text-lg font-700 mb-4">Strengths</h2>@for (item of report.strengths; track item) { <p class="mb-2">✓ {{ item }}</p> }</section>
          <section class="card p-6"><h2 class="text-lg font-700 mb-4">Improvements</h2>@for (item of report.improvements; track item) { <p class="mb-2">→ {{ item }}</p> }</section></div>
        <section class="card p-6"><h2 class="text-lg font-700 mb-3">Learning history · Completed</h2><p>{{ report.topic }} · {{ report.completedAt | date:'medium' }} · {{ report.duration }} · {{ report.overallScore }}/100 · +{{ report.xp }} XP</p></section>
      } @else { <section class="card p-8 text-center"><h2 class="text-xl font-700 mb-2">No completed session yet</h2><p class="mb-5">Choose a topic to start a mock practice session.</p><button class="btn-primary cursor-pointer" (click)="appState.go('ai-coach')">Choose a topic</button></section> }
      <footer class="flex gap-4"><button class="btn-secondary flex-1 justify-center cursor-pointer" (click)="appState.go('dashboard')">Dashboard</button><button class="btn-primary flex-1 justify-center cursor-pointer" (click)="appState.go('ai-coach')">Practice again</button></footer>
    </main>
  `
})
export class AiCoachReportComponent {
  readonly appState = inject(AppStateService);
  readonly session = computed(() => this.appState.latestAiCoachSession());
}
