// Risk tolerance of an estimation made on an approved architecture: how far the actual effort
// may fall below or rise above the likely figure, built from evidence in the design instead of a
// chosen padding. Every contributor is listed with its share so the figure can be challenged.

import type { ArchRisk } from "./architecture-graph";

export interface RiskContributor {
  source: string;
  detail: string;
  downPct: number;
  upPct: number;
}

export interface RiskTolerance {
  downPct: number; // the effort may be this % lower than likely
  upPct: number; // ... or this % higher
  contributors: RiskContributor[];
  low: number;
  likely: number;
  high: number;
  contingencyHours: number; // high - likely: the reserve to hold back
  confidence: number; // how firm the likely figure is (40-90)
  rule: string;
}

export interface RiskInputs {
  likely: number; // total effort (hours) the tolerance applies to
  taskSpread: { low: number; likely: number; high: number }; // sums of the task estimates
  risks: ArchRisk[];
  skippedAnswers: number;
  openQuestions: number;
  unassignedSteps: number;
  componentsWithoutTasks: number;
  techShares: { newStack: number; moderate: number }; // share (0-1) of build hours per familiarity
  gaps: Array<{ severity: "high" | "medium" | "low" }>;
}

// The weights below are the model's assumptions; change them here and the tests show the effect
export const RISK_WEIGHTS = {
  // per register risk, by impact × likelihood score (High 3, Medium 2, Low 1)
  riskByScore: (score: number) => (score >= 9 ? 8 : score >= 6 ? 5 : score >= 4 ? 3 : score >= 3 ? 2 : 1),
  riskCap: 30,
  skippedAnswer: 3,
  skippedCap: 12,
  openQuestion: 1.5,
  openCap: 9,
  unassignedStep: 2,
  unassignedCap: 10,
  componentWithoutTasks: 4,
  componentCap: 16,
  newStack: 10, // × share of hours on a technology new to the team
  moderateStack: 3,
  gapHigh: 5,
  gapMedium: 2,
  gapCap: 15,
};

const SCORE = { High: 3, Medium: 2, Low: 1 } as const;
const pct = (n: number) => Math.round(n * 10) / 10;

export function riskTolerance(input: RiskInputs): RiskTolerance {
  const W = RISK_WEIGHTS;
  const contributors: RiskContributor[] = [];
  const add = (source: string, detail: string, upPct: number, downPct = 0) => {
    if (upPct > 0 || downPct > 0) contributors.push({ source, detail, upPct: pct(upPct), downPct: pct(downPct) });
  };

  const s = input.taskSpread;
  if (s.likely > 0) {
    add(
      "Spread of the task estimates",
      `tasks sum to ${s.low}–${s.likely}–${s.high} h (low–likely–high)`,
      ((s.high - s.likely) / s.likely) * 100,
      ((s.likely - s.low) / s.likely) * 100
    );
  }

  if (input.risks.length) {
    let up = 0;
    const counts: Record<string, number> = {};
    for (const r of input.risks) {
      up += W.riskByScore(SCORE[r.impact] * SCORE[r.likelihood]);
      const k = `${r.impact} impact / ${r.likelihood} likelihood`;
      counts[k] = (counts[k] || 0) + 1;
    }
    add(
      "Architecture risk register",
      `${input.risks.length} risk(s): ${Object.entries(counts).map(([k, n]) => `${n} × ${k}`).join("; ")}`,
      Math.min(up, W.riskCap)
    );
  }
  if (input.skippedAnswers > 0) {
    add("Skipped architecture answers", `${input.skippedAnswers} decision(s) left as assumptions`, Math.min(input.skippedAnswers * W.skippedAnswer, W.skippedCap));
  }
  if (input.openQuestions > 0) {
    add("Open questions in the design", `${input.openQuestions} question(s) still to be decided by the business`, Math.min(input.openQuestions * W.openQuestion, W.openCap));
  }
  if (input.unassignedSteps > 0) {
    add("Process steps without a component", `${input.unassignedSteps} step(s) of the analysis graph not delivered by any component`, Math.min(input.unassignedSteps * W.unassignedStep, W.unassignedCap));
  }
  if (input.componentsWithoutTasks > 0) {
    add("Components without estimated tasks", `${input.componentsWithoutTasks} component(s) have no hours yet`, Math.min(input.componentsWithoutTasks * W.componentWithoutTasks, W.componentCap));
  }
  const techUp = input.techShares.newStack * W.newStack + input.techShares.moderate * W.moderateStack;
  if (techUp > 0) {
    add(
      "Technology familiarity",
      `${Math.round(input.techShares.newStack * 100)}% of build hours on technology new to the team, ${Math.round(input.techShares.moderate * 100)}% moderately familiar`,
      techUp
    );
  }
  const high = input.gaps.filter((g) => g.severity === "high").length;
  const medium = input.gaps.filter((g) => g.severity === "medium").length;
  if (high + medium > 0) {
    add("Team gaps", `${high} high and ${medium} medium staffing gap(s)`, Math.min(high * W.gapHigh + medium * W.gapMedium, W.gapCap));
  }

  const upPct = Math.round(contributors.reduce((a, c) => a + c.upPct, 0));
  const downPct = Math.round(contributors.reduce((a, c) => a + c.downPct, 0));
  const likely = Math.round(input.likely);
  const low = Math.round(likely * (1 - downPct / 100));
  const highHours = Math.round(likely * (1 + upPct / 100));
  // Firmness of the likely figure: the evidence beyond the normal spread of the tasks lowers it
  const evidenceUp = upPct - (contributors.find((c) => c.source === "Spread of the task estimates")?.upPct || 0);
  const confidence = Math.max(40, Math.min(90, Math.round(90 - evidenceUp * 0.8)));

  return {
    downPct,
    upPct,
    contributors,
    low,
    likely,
    high: highHours,
    contingencyHours: highHours - likely,
    confidence,
    rule: `−${downPct}% / +${upPct}%: the sum of the contributors below`,
  };
}
