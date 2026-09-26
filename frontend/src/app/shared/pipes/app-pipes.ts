import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatTime',
  standalone: true,
  pure: true
})
export class FormatTimePipe implements PipeTransform {
  transform(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

@Pipe({
  name: 'scoreColor',
  standalone: true,
  pure: true
})
export class ScoreColorPipe implements PipeTransform {
  transform(score: number): string {
    if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  }
}

@Pipe({
  name: 'levelBadge',
  standalone: true,
  pure: true
})
export class LevelBadgePipe implements PipeTransform {
  transform(level: string): string {
    switch (level) {
      case 'A1':
      case 'A2':
        return 'bg-emerald-100 text-emerald-700';
      case 'B1':
      case 'B2':
        return 'bg-blue-100 text-blue-700';
      case 'C1':
      case 'C2':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }
}
