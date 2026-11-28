import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RadarAxis {
  key: string;
  shortLabel: string;
  label: string;
  value: number | null;
}

const DEFAULT_AXES: { key: string; shortLabel: string; label: string }[] = [
  { key: 'pronunciation', shortLabel: 'P', label: 'Phát âm' },
  { key: 'fluency', shortLabel: 'F', label: 'Lưu loát' },
  { key: 'vocabulary', shortLabel: 'V', label: 'Từ vựng' },
  { key: 'grammar', shortLabel: 'G', label: 'Ngữ pháp' },
  { key: 'interaction', shortLabel: 'I', label: 'Tương tác' },
];

/**
 * Compact 5-axis pentagonal SVG Radar Chart for communication competence visualization.
 */
@Component({
  selector: 'app-skill-radar-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex flex-col items-center">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
        class="overflow-visible select-none"
        role="img"
        aria-label="Biểu đồ Radar 5 kỹ năng giao tiếp"
      >
        @for (ring of gridPolygons(); track $index) {
          <polygon
            [attr.points]="ring"
            fill="none"
            stroke="#cbd5e1"
            stroke-width="1"
            stroke-dasharray="2 2"
          />
        }

        @for (spoke of spokes(); track spoke.key) {
          <line
            [attr.x1]="center()"
            [attr.y1]="center()"
            [attr.x2]="spoke.x"
            [attr.y2]="spoke.y"
            stroke="#cbd5e1"
            stroke-width="1"
          />
          <text
            [attr.x]="spoke.lx"
            [attr.y]="spoke.ly"
            text-anchor="middle"
            dominant-baseline="middle"
            class="fill-slate-600 text-[10px] font-bold"
          >
            <title>{{ spoke.label }}: {{ spoke.val !== null ? spoke.val : 'N/A' }}</title>
            {{ spoke.shortLabel }}
          </text>
        }

        <polygon
          [attr.points]="dataPolygon()"
          fill="rgba(37, 99, 235, 0.20)"
          stroke="#2563EB"
          stroke-width="2"
          stroke-linejoin="round"
        />

        @for (pt of dataPoints(); track pt.key) {
          <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3" fill="#2563EB" />
        }
      </svg>
    </div>
  `,
})
export class SkillRadarChartComponent {
  readonly scores = input<Record<string, number | null | undefined>>({});
  readonly size = input<number>(170);

  readonly center = computed(() => this.size() / 2);
  readonly radius = computed(() => this.size() * 0.34);

  readonly resolvedAxes = computed<RadarAxis[]>(() => {
    const map = this.scores();
    return DEFAULT_AXES.map((a) => {
      const raw = map[a.key];
      return {
        ...a,
        value: typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null,
      };
    });
  });

  private pointAt(index: number, scale: number): { x: number; y: number } {
    const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / 5;
    const c = this.center();
    const r = this.radius() * scale;
    return {
      x: Number((c + r * Math.cos(angle)).toFixed(1)),
      y: Number((c + r * Math.sin(angle)).toFixed(1)),
    };
  }

  readonly gridPolygons = computed(() => {
    return [0.25, 0.5, 0.75, 1.0].map((scale) =>
      Array.from({ length: 5 }, (_, idx) => {
        const pt = this.pointAt(idx, scale);
        return `${pt.x},${pt.y}`;
      }).join(' ')
    );
  });

  readonly spokes = computed(() => {
    const axes = this.resolvedAxes();
    return axes.map((ax, idx) => {
      const outer = this.pointAt(idx, 1.0);
      const lbl = this.pointAt(idx, 1.24);
      return { ...ax, x: outer.x, y: outer.y, lx: lbl.x, ly: lbl.y, val: ax.value };
    });
  });

  readonly dataPoints = computed(() => {
    return this.resolvedAxes().map((ax, idx) => {
      const pct = (ax.value ?? 0) / 100;
      const pt = this.pointAt(idx, pct);
      return { key: ax.key, x: pt.x, y: pt.y };
    });
  });

  readonly dataPolygon = computed(() =>
    this.dataPoints()
      .map((p) => `${p.x},${p.y}`)
      .join(' ')
  );
}
