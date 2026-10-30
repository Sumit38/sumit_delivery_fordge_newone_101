// Plain-language explanations behind the numbers, filled with the actual
// values, for the ⓘ icons next to each figure.

import type { ComprehensiveDetails } from "./estimation-team";

export interface CalcNote {
  title: string;
  lines: string[];
}

interface EstimationLike {
  totalEffort?: number;
  timeline?: number;
  teamSize?: number;
  confidence?: number;
  totalBudget?: number;
  costPerHour?: number;
  breakdown?: { details?: ComprehensiveDetails; skillFactor?: number; techFactor?: number; testFactor?: number; riskFactor?: number; deadlineFactor?: number } | null;
}

const h = (n: number) => `${Math.round(n)} h`;
const md = (hours: number) => `${Math.round(hours / 8)} man-days`;

function detailsOf(e?: EstimationLike | null): ComprehensiveDetails | undefined {
  const d = e?.breakdown?.details;
  return d && d.mode === "comprehensive" ? d : undefined;
}

export const calculationNotes = {
  complexity(n?: number, e?: number, p?: number, m?: number): CalcNote {
    return {
      title: "Complexity score (M)",
      lines: [
        "M = E − N + 2P",
        n !== undefined && e !== undefined && p !== undefined
          ? `= ${e} − ${n} + 2 × ${p} = ${m ?? e - n + 2 * p}`
          : "",
        "N = steps in the requirement flow, E = connections between steps, P = Start-to-End paths.",
      ].filter(Boolean),
    };
  },

  dev(complexityScore: number, estimation?: EstimationLike | null): CalcNote {
    const d = detailsOf(estimation);
    if (!d) {
      return {
        title: "Dev man-days (quick estimate)",
        lines: [
          `Dev = M × 0.8 = ${complexityScore} × 0.8 = ${Math.round(complexityScore * 0.8)} man-days.`,
          "Generate an estimation to replace this with one based on your team and testing plan.",
        ],
      };
    }
    return {
      title: "Dev man-days (from your estimation)",
      lines: [
        `Development base = M × 8 h × technology × risk factors, shared across the work areas you picked.`,
        ...d.workstreams.map((w) => `• ${w.label}: ${h(w.hours)} → ${w.staffedBy}${w.fallback ? " (covering, +25%)" : ""}`),
        "Each role's share × seniority (Junior 1.5, Mid 1.0, Senior 0.8).",
        `Development ${h(d.devHours)} + defect fixing ${h(d.defectFixHours)} = ${h(d.devHours + d.defectFixHours)} ÷ 8 = ${md(d.devHours + d.defectFixHours)}.`,
      ],
    };
  },

  qa(complexityScore: number, estimation?: EstimationLike | null): CalcNote {
    const d = detailsOf(estimation);
    if (!d) {
      return {
        title: "QA man-days (quick estimate)",
        lines: [
          `QA = M × 0.5 = ${complexityScore} × 0.5 = ${Math.round(complexityScore * 0.5)} man-days.`,
          "Generate an estimation to replace this with one based on your testers and test types.",
        ],
      };
    }
    return {
      title: "QA man-days (from your estimation)",
      lines: [
        `${d.scenarios} test scenarios × 3 = ${d.testCases} test cases (${d.automatedTestCases} automated).`,
        ...d.testActivities.map((a) => `• ${a.activity}: ${h(a.hours)} (${a.rule})`),
        "Hours × tester seniority; a non-specialist covering a test type takes 25% longer.",
        `Total ${h(d.testingHours)} ÷ 8 = ${md(d.testingHours)}.`,
      ],
    };
  },

  total(complexityScore: number, estimation?: EstimationLike | null): CalcNote {
    const d = detailsOf(estimation);
    if (!d) {
      return {
        title: "Total man-days",
        lines: [`Dev + QA = M × 0.8 + M × 0.5 = ${Math.round(complexityScore * 1.3)} man-days.`],
      };
    }
    return {
      title: "Total man-days",
      lines: [
        `Dev ${md(d.devHours + d.defectFixHours)} + QA ${md(d.testingHours)}.`,
        d.overheadHours > 0
          ? `Support roles (designer, BA, architect, PM) add ${md(d.overheadHours)} more; they are in Total Effort, not in this column.`
          : "No support roles were added.",
      ],
    };
  },

  totalEffort(estimation: EstimationLike): CalcNote {
    const d = detailsOf(estimation);
    if (!d) {
      const b = estimation.breakdown || {};
      return {
        title: "Total effort",
        lines: [
          "Base effort = M × 8 h.",
          `Total = base × skill ${b.skillFactor ?? 1} × technology ${b.techFactor ?? 1} × testing ${b.testFactor ?? 1} × risk ${b.riskFactor ?? 1} = ${h(estimation.totalEffort || 0)}.`,
        ],
      };
    }
    return {
      title: "Total effort",
      lines: [
        `Development ${h(d.devHours)}`,
        `+ Defect fixing ${h(d.defectFixHours)}`,
        `+ Testing ${h(d.testingHours)}`,
        `+ Support roles ${h(d.overheadHours)}`,
        `= ${h(estimation.totalEffort || 0)}`,
      ],
    };
  },

  timeline(estimation: EstimationLike): CalcNote {
    const d = detailsOf(estimation);
    const deadline = d?.deadlineFactor ?? estimation.breakdown?.deadlineFactor ?? 1;
    if (!d) {
      return {
        title: "Timeline",
        lines: [
          `Weeks = total effort ÷ (${estimation.teamSize ?? "?"} developers × hours per week) × deadline ${deadline}, rounded up.`,
          `= ${estimation.timeline} weeks.`,
        ],
      };
    }
    const slowestDev = d.devLoads[0];
    return {
      title: "Timeline",
      lines: [
        "Each role's weeks = its hours ÷ (people × hours per week). The slowest role sets the pace.",
        slowestDev ? `Development: ${d.devWeeks} weeks (slowest: ${slowestDev.label}).` : "",
        d.approach === "after-dev"
          ? `Testing runs after development: + ${d.testingWeeks} weeks.`
          : `Testing runs inside the sprints; end-phase testing (performance, security, UAT…) adds ${d.endPhaseWeeks} weeks.`,
        `× deadline factor ${deadline}, rounded up = ${estimation.timeline} weeks.`,
      ].filter(Boolean),
    };
  },

  confidence(estimation: EstimationLike): CalcNote {
    const d = detailsOf(estimation);
    return {
      title: "Confidence",
      lines: [
        "Starts at 75%.",
        "+ for senior teams and a conservative risk approach; − for junior teams and an aggressive approach.",
        d ? "+5% when both functional and regression testing are planned." : "+10% for comprehensive testing.",
        d ? `− 8% per high gap and − 4% per medium gap (${d.gaps.filter((g) => g.severity !== "low").length} found).` : "",
        `Kept between 40% and 95% → ${estimation.confidence ?? "-"}%.`,
      ].filter(Boolean),
    };
  },

  budget(estimation: EstimationLike): CalcNote {
    return {
      title: "Budget",
      lines: [`Total effort ${h(estimation.totalEffort || 0)} × $${estimation.costPerHour ?? "-"} per hour.`],
    };
  },

  quickTimeline(devManDays: number, qaManDays: number): CalcNote {
    return {
      title: "Quick timeline",
      lines: [
        `Dev ${Math.round(devManDays)} man-days ÷ 2 developers = ${Math.ceil(devManDays / 2)} days.`,
        `QA ${Math.round(qaManDays)} man-days ÷ 1 tester = ${Math.ceil(qaManDays)} days.`,
        "Dev and QA work in parallel, so the longer one is the timeline.",
      ],
    };
  },
};
