// Gantt chart for an estimation. For estimations made with the team and testing
// questions, every bar comes from the calculated role workloads. Older
// estimations get an approximate phase split of their timeline.

import type { ComprehensiveDetails } from "./estimation-team";

export type GanttGroup = "Development" | "Testing" | "Support" | "Phases";

export interface GanttRow {
  id: string;
  label: string;
  group: GanttGroup;
  start: number; // weeks from project start
  end: number;
  kind: "dev" | "test" | "test-end" | "support" | "unstaffed" | "phase";
  note?: string;
}

export interface GanttMilestone {
  label: string;
  week: number;
}

export interface EstimationGantt {
  rows: GanttRow[];
  milestones: GanttMilestone[];
  totalWeeks: number;
  approximate: boolean;
}

interface EstimationLike {
  timeline: number;
  breakdown?: { details?: ComprehensiveDetails } | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildEstimationGantt(estimation: EstimationLike): EstimationGantt {
  const timeline = Math.max(1, Number(estimation.timeline) || 1);
  const d = estimation.breakdown?.details;

  if (!d || d.mode !== "comprehensive") {
    // Approximate split for estimations made without the team and testing questions
    const T = timeline;
    return {
      approximate: true,
      totalWeeks: T,
      rows: [
        { id: "design", label: "Design & planning", group: "Phases", start: 0, end: r1(T * 0.15), kind: "phase" },
        { id: "dev", label: "Development", group: "Phases", start: r1(T * 0.1), end: r1(T * 0.75), kind: "dev" },
        { id: "test", label: "QA & testing", group: "Phases", start: r1(T * 0.45), end: r1(T * 0.95), kind: "test" },
        { id: "deploy", label: "Deployment", group: "Phases", start: r1(T * 0.95), end: T, kind: "phase" },
      ],
      milestones: [{ label: "Release", week: T }],
    };
  }

  const inSprint = d.approach !== "after-dev";
  const devEnd = d.devWeeks;
  const inSprintMax = Math.max(0, ...d.testLoads.map((l) => l.inSprintWeeks ?? 0));
  const coreEnd = inSprint ? Math.max(devEnd, inSprintMax) : devEnd;
  const planned = inSprint ? coreEnd + d.endPhaseWeeks : devEnd + d.testingWeeks;
  // The timeline adds the deadline factor and rounds up; stretch the bars to match it
  const scale = planned > 0 ? timeline / planned : 1;
  const w = (n: number) => r1(n * scale);

  const rows: GanttRow[] = [];

  for (const l of d.devLoads) {
    rows.push({
      id: `dev-${l.role}`,
      label: l.role === "unstaffed" ? "Not staffed (to be hired)" : `${l.label} ×${l.count}`,
      group: "Development",
      start: 0,
      end: w(l.weeks),
      kind: l.role === "unstaffed" ? "unstaffed" : "dev",
      note: l.tasks.join(", "),
    });
  }

  for (const l of d.testLoads) {
    const label = l.role === "unstaffed" ? "Testing not staffed" : `${l.label} ×${l.count}`;
    const kind = l.role === "unstaffed" ? "unstaffed" : "test";
    const sprintWeeks = l.inSprintWeeks ?? l.weeks;
    const endWeeks = l.endWeeks ?? 0;
    if (inSprint) {
      if (sprintWeeks > 0) {
        rows.push({ id: `test-${l.role}`, label, group: "Testing", start: 0, end: w(sprintWeeks), kind, note: "During sprints" });
      }
      if (endWeeks > 0) {
        rows.push({
          id: `test-end-${l.role}`,
          label: `${label} (end phase)`,
          group: "Testing",
          start: w(coreEnd),
          end: w(coreEnd + endWeeks),
          kind: kind === "unstaffed" ? "unstaffed" : "test-end",
          note: "Performance, security, UAT and similar",
        });
      }
    } else if (l.weeks > 0) {
      rows.push({ id: `test-${l.role}`, label, group: "Testing", start: w(devEnd), end: w(devEnd + l.weeks), kind, note: "After development" });
    }
  }

  for (const l of d.supportLoads) {
    rows.push({
      id: `support-${l.role}`,
      label: `${l.label} ×${l.count}`,
      group: "Support",
      start: 0,
      end: timeline,
      kind: "support",
      note: l.tasks.join(", "),
    });
  }

  return {
    approximate: false,
    totalWeeks: timeline,
    rows: rows.filter((r) => r.end > r.start),
    milestones: [
      { label: "Development complete", week: w(devEnd) },
      { label: "Release", week: timeline },
    ],
  };
}

const KIND_COLORS: Record<GanttRow["kind"], string> = {
  dev: "#3b82f6",
  test: "#8b5cf6",
  "test-end": "#6d28d9",
  support: "#94a3b8",
  unstaffed: "#ef4444",
  phase: "#0ea5e9",
};

export function ganttColor(kind: GanttRow["kind"]): string {
  return KIND_COLORS[kind];
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Static HTML version for the downloadable report
export function ganttHtml(g: EstimationGantt): string {
  const pct = (week: number) => `${Math.min(100, (week / g.totalWeeks) * 100).toFixed(2)}%`;
  const ticks = Array.from({ length: g.totalWeeks + 1 }, (_, i) => i).filter(
    (i) => g.totalWeeks <= 20 || i % Math.ceil(g.totalWeeks / 20) === 0 || i === g.totalWeeks
  );
  let lastGroup = "";
  const body = g.rows
    .map((r) => {
      const header = r.group !== lastGroup ? `<div class="g-group">${esc(r.group)}</div>` : "";
      lastGroup = r.group;
      return `${header}<div class="g-row"><div class="g-label" title="${esc(r.note)}">${esc(r.label)}</div><div class="g-track"><div class="g-bar" style="left:${pct(r.start)};width:calc(${pct(r.end)} - ${pct(r.start)});background:${ganttColor(r.kind)}">${r1(r.end - r.start)} wk</div></div></div>`;
    })
    .join("");
  return `
    <style>
      .g-wrap{border:1px solid #cbd5e1;border-radius:6px;padding:10px;margin:12px 0}
      .g-row{display:flex;align-items:center;margin:4px 0}
      .g-label{width:240px;font-size:12px;padding-right:8px}
      .g-track{position:relative;flex:1;height:22px;background:#f1f5f9;border-radius:4px}
      .g-bar{position:absolute;top:0;height:22px;border-radius:4px;color:#fff;font-size:11px;line-height:22px;padding-left:4px;overflow:hidden;white-space:nowrap}
      .g-axis{display:flex;margin-left:240px;position:relative;height:16px;font-size:10px;color:#64748b}
      .g-axis span{position:absolute;transform:translateX(-50%)}
      .g-group{font-weight:bold;font-size:12px;margin-top:8px;color:#334155}
      .g-ms{font-size:12px;color:#334155;margin-top:8px}
    </style>
    <div class="g-wrap">
      <div class="g-axis">${ticks.map((t) => `<span style="left:${pct(t)}">W${t}</span>`).join("")}</div>
      ${body}
      <div class="g-ms">${g.milestones.map((m) => `◆ ${esc(m.label)}: week ${m.week}`).join(" &nbsp; ")}</div>
      ${g.approximate ? '<div class="g-ms">Approximate phase split: this estimation was made without the team and testing questions.</div>' : ""}
    </div>`;
}
