"use client";

import { buildEstimationGantt, ganttColor, type GanttRow } from "@/lib/estimation-gantt";
import type { ComprehensiveDetails } from "@/lib/estimation-team";

interface Props {
  estimation: { timeline: number; breakdown?: { details?: ComprehensiveDetails } | null };
  compact?: boolean;
}

const LEGEND: Array<{ kind: GanttRow["kind"]; label: string }> = [
  { kind: "dev", label: "Development" },
  { kind: "test", label: "Testing during sprints" },
  { kind: "test-end", label: "End-phase testing" },
  { kind: "support", label: "Support roles" },
  { kind: "unstaffed", label: "Not staffed" },
  { kind: "phase", label: "Design / deployment" },
];

export default function EstimationGanttChart({ estimation, compact = false }: Props) {
  const g = buildEstimationGantt(estimation);
  const pct = (week: number) => `${Math.min(100, (week / g.totalWeeks) * 100)}%`;
  const step = g.totalWeeks <= 16 ? 1 : Math.ceil(g.totalWeeks / 16);
  const ticks = Array.from({ length: g.totalWeeks + 1 }, (_, i) => i).filter((i) => i % step === 0 || i === g.totalWeeks);
  const usedKinds = new Set(g.rows.map((r) => r.kind));
  const groups = [...new Set(g.rows.map((r) => r.group))];

  return (
    <div className={compact ? "" : "bg-white border border-gray-200 rounded-lg p-6"}>
      {!compact && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-xl font-bold text-gray-900">📅 Project Timeline (Gantt Chart)</h3>
          <span className="text-sm text-gray-600">{g.totalWeeks} weeks</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Week axis */}
          <div className="flex">
            <div className="w-48 shrink-0" />
            <div className="relative flex-1 h-5 text-[10px] text-gray-500">
              {ticks.map((t) => (
                <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>
                  W{t}
                </span>
              ))}
            </div>
          </div>

          {groups.map((group) => (
            <div key={group} className="mt-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{group}</div>
              {g.rows
                .filter((r) => r.group === group)
                .map((r) => (
                  <div key={r.id} className="flex items-center py-0.5">
                    <div className="w-48 shrink-0 pr-2 text-xs text-gray-800 truncate" title={r.note ? `${r.label}: ${r.note}` : r.label}>
                      {r.label}
                    </div>
                    <div className="relative flex-1 h-6 bg-gray-100 rounded">
                      {ticks.map((t) => (
                        <div key={t} className="absolute top-0 bottom-0 border-l border-white" style={{ left: pct(t) }} />
                      ))}
                      <div
                        className="absolute top-0 h-6 rounded text-[11px] text-white leading-6 px-1.5 overflow-hidden whitespace-nowrap"
                        style={{
                          left: pct(r.start),
                          width: `calc(${pct(r.end)} - ${pct(r.start)})`,
                          background: ganttColor(r.kind),
                        }}
                        title={`${r.label}: week ${r.start} to ${r.end}${r.note ? ` (${r.note})` : ""}`}
                      >
                        {Math.round((r.end - r.start) * 10) / 10} wk
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ))}

          {/* Milestones */}
          <div className="flex mt-2">
            <div className="w-48 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide">Milestones</div>
            <div className="relative flex-1 h-10">
              {g.milestones.map((m, i) => (
                <div key={m.label} className="absolute -translate-x-1/2 text-center" style={{ left: pct(m.week), top: i % 2 ? 18 : 0 }}>
                  <div className="text-amber-600 text-xs leading-none">◆</div>
                  <div className="text-[10px] text-gray-700 whitespace-nowrap">
                    {m.label} (W{m.week})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-600">
        {LEGEND.filter((l) => usedKinds.has(l.kind)).map((l) => (
          <span key={l.kind} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ background: ganttColor(l.kind) }} />
            {l.label}
          </span>
        ))}
      </div>
      {g.approximate && (
        <p className="text-xs text-gray-500 mt-2">
          Approximate phase split: this estimation was made before the team and testing questions existed.
        </p>
      )}
    </div>
  );
}
