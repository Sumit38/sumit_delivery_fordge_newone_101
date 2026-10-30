"use client";

import { useMemo, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/lib/supabase";
import type { ComprehensiveDetails } from "@/lib/estimation-team";
import { buildEstimationGantt, ganttColor } from "@/lib/estimation-gantt";
import EstimationGanttChart from "./EstimationGanttChart";
import InfoTip from "./InfoTip";
import { calculationNotes } from "@/lib/calculation-notes";
import { downloadTimelineExcel } from "@/lib/export-timeline";
import type { TimelineExportInput } from "@/lib/timeline-excel";

// Tailwind colours of the quick timeline's phases, for the Excel download
const PHASE_HEX: Record<string, string> = {
  "bg-blue-500": "#3b82f6",
  "bg-green-500": "#22c55e",
  "bg-yellow-500": "#eab308",
  "bg-purple-500": "#a855f7",
  "bg-orange-500": "#f97316",
  "bg-slate-300": "#cbd5e1",
};

interface TimelineProps {
  qaManDays: number;
  devManDays: number;
  complexityScore: number;
  analysisId?: string;
  requirementTitle?: string;
  estimationData?: {
    totalEffort: number;
    timeline: number;
    teamSize: number;
    breakdown?: { details?: ComprehensiveDetails } | null;
  };
}

export default function ProposedProjectTimeline({
  qaManDays,
  devManDays,
  complexityScore,
  analysisId,
  requirementTitle,
  estimationData,
}: TimelineProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // The Excel download appears once the timeline has been saved
  const [hasSaved, setHasSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Use detailed estimation if available, otherwise use basic metrics.
  // With team and testing answers, Dev and QA come straight from the estimation.
  const details = estimationData?.breakdown?.details;
  const effectiveDevManDays = details
    ? (details.devHours + details.defectFixHours) / 8
    : estimationData ? (estimationData.totalEffort / 8) * 0.7 : devManDays; // 70% for dev
  const effectiveQaManDays = details
    ? details.testingHours / 8
    : estimationData ? (estimationData.totalEffort / 8) * 0.3 : qaManDays; // 30% for QA

  // Get team size for parallel work calculation
  const teamSize = estimationData?.teamSize || 3; // Default to 3 if not specified
  const parallelizationFactor = 0.85; // 85% efficiency due to communication overhead

  const timeline = useMemo(() => {
    // Use estimationData.timeline if available (source of truth with deadlineFactor applied)
    let totalDays: number;

    if (estimationData?.timeline) {
      // Convert weeks to calendar days
      totalDays = Math.ceil(estimationData.timeline * 5);
    } else {
      // Fallback: Calculate from phases if no estimation data
      const designManDays = effectiveDevManDays * 0.15;
      const developmentManDays = effectiveDevManDays * 0.60;
      const testingManDays = effectiveQaManDays;
      const deploymentDays = 3;
      const supportDays = 7;

      const designCalendarDays = Math.ceil((designManDays / teamSize) / parallelizationFactor);
      const developmentCalendarDays = Math.ceil((developmentManDays / teamSize) / parallelizationFactor);
      const testingCalendarDays = Math.ceil((testingManDays / Math.max(teamSize * 0.3, 1)) / parallelizationFactor);
      const bufferDays = Math.ceil((designCalendarDays + developmentCalendarDays + testingCalendarDays) * 0.05);

      totalDays = designCalendarDays + developmentCalendarDays + testingCalendarDays + deploymentDays + supportDays + bufferDays;
    }

    // Distribute totalDays across phases proportionally for Gantt visualization
    const designManDays = effectiveDevManDays * 0.15;
    const developmentManDays = effectiveDevManDays * 0.60;
    const testingManDays = effectiveQaManDays;
    const deploymentDays = 3;
    const supportDays = 7;

    const designCalendarDays = Math.ceil((designManDays / teamSize) / parallelizationFactor);
    const developmentCalendarDays = Math.ceil((developmentManDays / teamSize) / parallelizationFactor);
    const testingCalendarDays = Math.ceil((testingManDays / Math.max(teamSize * 0.3, 1)) / parallelizationFactor);
    const bufferDays = Math.ceil((designCalendarDays + developmentCalendarDays + testingCalendarDays) * 0.05);

    // Calculate scaling factor if using estimationData timeline
    const calculatedDays = designCalendarDays + developmentCalendarDays + testingCalendarDays + deploymentDays + supportDays + bufferDays;
    const scaleFactor = estimationData?.timeline ? totalDays / calculatedDays : 1;

    // Scale phase days to match total from estimationData
    const scaledDesignDays = Math.ceil(designCalendarDays * scaleFactor);
    const scaledDevDays = Math.ceil(developmentCalendarDays * scaleFactor);
    const scaledTestDays = Math.ceil(testingCalendarDays * scaleFactor);
    const scaledDeployDays = Math.ceil(deploymentDays * scaleFactor);
    const scaledSupportDays = Math.ceil(supportDays * scaleFactor);
    const scaledBufferDays = Math.ceil(bufferDays * scaleFactor);

    const phases = [
      {
        name: "Design & Planning",
        days: scaledDesignDays,
        color: "bg-blue-500",
        percentage: (scaledDesignDays / totalDays) * 100,
      },
      {
        name: "Development",
        days: scaledDevDays,
        color: "bg-green-500",
        percentage: (scaledDevDays / totalDays) * 100,
      },
      {
        name: "QA & Testing",
        days: scaledTestDays,
        color: "bg-yellow-500",
        percentage: (scaledTestDays / totalDays) * 100,
      },
      {
        name: "Deployment",
        days: scaledDeployDays,
        color: "bg-purple-500",
        percentage: (scaledDeployDays / totalDays) * 100,
      },
      {
        name: "Support & Monitoring",
        days: scaledSupportDays,
        color: "bg-orange-500",
        percentage: (scaledSupportDays / totalDays) * 100,
      },
      {
        name: "Buffer (5%)",
        days: scaledBufferDays,
        color: "bg-slate-300",
        percentage: (scaledBufferDays / totalDays) * 100,
      },
    ];

    return {
      phases,
      totalDays,
      weeksTotal: Math.ceil(totalDays / 5),
      devTeamDays: Math.ceil(effectiveDevManDays),
      qaTeamDays: Math.ceil(effectiveQaManDays),
    };
  }, [effectiveDevManDays, effectiveQaManDays, teamSize, estimationData?.timeline]);

  const getComplexityRecommendation = (score: number) => {
    if (score <= 5) return "Low complexity - streamlined process recommended";
    if (score <= 15) return "Medium complexity - standard phased approach";
    if (score <= 30) return "High complexity - extended testing cycles recommended";
    return "Very High complexity - consider splitting into multiple releases";
  };

  const saveTimeline = async (
    totalDays: number = timeline.totalDays,
    phases: Array<Record<string, unknown>> = timeline.phases
  ) => {
    if (!analysisId) {
      alert("No analysis to save timeline for");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("User session not found");
      }

      const response = await authFetch("/api/save-project-timeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          analysisId,
          totalDays,
          qaManDays: estimationData ? effectiveQaManDays : qaManDays,
          devManDays: estimationData ? effectiveDevManDays : devManDays,
          complexityScore,
          phases,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save timeline");
      }

      setSaved(true);
      setHasSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const downloadExcel = async (input: Omit<TimelineExportInput, "requirementTitle" | "complexityScore">) => {
    setDownloading(true);
    try {
      await downloadTimelineExcel({ ...input, requirementTitle: requirementTitle || "Project", complexityScore });
    } catch (err) {
      alert("Download failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setDownloading(false);
    }
  };

  const downloadButton = (input: Omit<TimelineExportInput, "requirementTitle" | "complexityScore">) =>
    hasSaved && (
      <button
        type="button"
        onClick={() => downloadExcel(input)}
        disabled={downloading}
        className="w-full px-4 py-3 rounded-lg font-semibold border-2 border-green-600 text-green-700 bg-white hover:bg-green-50 disabled:opacity-50 transition-colors"
      >
        {downloading ? "Preparing Excel..." : "📥 Download Timeline (Excel)"}
      </button>
    );

  const saveButton = (onSave: () => void) =>
    analysisId && (
      <button
        onClick={onSave}
        disabled={saving}
        className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors ${
          saved ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400"
        }`}
      >
        {saving ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Saving...
          </div>
        ) : saved ? (
          "✓ Saved Successfully"
        ) : (
          "💾 Save Project Timeline"
        )}
      </button>
    );

  // Once an estimation exists, show exactly the same Gantt chart and numbers
  // as the estimation report, so the two screens never disagree.
  if (estimationData?.timeline) {
    const gantt = buildEstimationGantt(estimationData);
    const weeks = estimationData.timeline;
    const totalDays = weeks * 5;
    const devRows = gantt.rows.filter((r) => r.kind === "dev" || (r.group === "Development"));
    const testRows = gantt.rows.filter((r) => r.group === "Testing" || r.kind === "test");
    const span = (rows: typeof gantt.rows) =>
      rows.length ? Math.max(...rows.map((r) => r.end)) - Math.min(...rows.map((r) => r.start)) : 0;
    const devDays = Math.ceil(span(devRows) * 5);
    const qaDays = Math.ceil(span(testRows) * 5);
    const testers = details ? details.testLoads.filter((l) => l.role !== "unstaffed").reduce((s, l) => s + l.count, 0) : null;
    const phases = gantt.rows.map((r) => ({
      name: r.label,
      group: r.group,
      startDay: Math.round(r.start * 5),
      days: Math.round((r.end - r.start) * 5 * 10) / 10,
      color: ganttColor(r.kind),
      percentage: ((r.end - r.start) / weeks) * 100,
    }));

    return (
      <div className="space-y-6">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Complexity Level:</strong> {getComplexityRecommendation(complexityScore)}
          </p>
          <p className="text-xs text-blue-800 mt-1">
            This timeline is the same as your saved estimation{details ? " (team, seniority and testing answers)" : ""}.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-900">{totalDays}</p>
            <p className="text-xs text-slate-600 mt-1">Total working days</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-900">
              {weeks}
              <InfoTip note={calculationNotes.timeline(estimationData)} />
            </p>
            <p className="text-xs text-slate-600 mt-1">Weeks (@ 5 days/week)</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-900">
              ~{devDays}
              <InfoTip note={calculationNotes.dev(complexityScore, estimationData)} />
            </p>
            <p className="text-xs text-slate-600 mt-1">Dev calendar days</p>
            <p className="text-xs text-slate-500 mt-1">
              ({estimationData.teamSize} developers · {Math.round(effectiveDevManDays)} man-days)
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-slate-900">
              ~{qaDays}
              <InfoTip align="right" note={calculationNotes.qa(complexityScore, estimationData)} />
            </p>
            <p className="text-xs text-slate-600 mt-1">QA calendar days</p>
            <p className="text-xs text-slate-500 mt-1">
              ({testers !== null ? `${testers} tester${testers === 1 ? "" : "s"} · ` : ""}
              {Math.round(effectiveQaManDays)} man-days)
            </p>
          </div>
        </div>

        <EstimationGanttChart estimation={estimationData} />

        {saveButton(() => saveTimeline(totalDays, phases))}
        {downloadButton({
          totalWeeks: weeks,
          totalDays,
          devManDays: effectiveDevManDays,
          qaManDays: effectiveQaManDays,
          source: details ? "estimation" : "quick",
          rows: gantt.rows.map((r) => ({
            label: r.label,
            group: r.group,
            start: r.start,
            end: r.end,
            color: ganttColor(r.kind),
            note: r.note,
          })),
          milestones: gantt.milestones,
          details,
        })}
      </div>
    );
  }

  // Phases of the quick timeline run one after another
  let cursorDays = 0;
  const quickRows = timeline.phases.map((p) => {
    const start = cursorDays / 5;
    cursorDays += p.days;
    return { label: p.name, group: "Phases", start, end: cursorDays / 5, color: PHASE_HEX[p.color] || "#3b82f6" };
  });

  return (
    <div className="space-y-6">
      {/* Complexity Note */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Complexity Level:</strong> {getComplexityRecommendation(complexityScore)}
        </p>
      </div>

      {/* Timeline Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-2xl font-bold text-slate-900">
            {timeline.totalDays.toFixed(0)}
          </p>
          <p className="text-xs text-slate-600 mt-1">Total Days</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-2xl font-bold text-slate-900">{timeline.weeksTotal}</p>
          <p className="text-xs text-slate-600 mt-1">Weeks (@ 5 days/week)</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-2xl font-bold text-slate-900">~{Math.ceil((effectiveDevManDays / teamSize) / parallelizationFactor)}</p>
          <p className="text-xs text-slate-600 mt-1">Dev Calendar Days</p>
          <p className="text-xs text-slate-500 mt-1">({teamSize} developers)</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-2xl font-bold text-slate-900">~{Math.ceil((effectiveQaManDays / Math.max(teamSize * 0.3, 1)) / parallelizationFactor)}</p>
          <p className="text-xs text-slate-600 mt-1">QA Calendar Days</p>
          <p className="text-xs text-slate-500 mt-1">({Math.max(Math.ceil(teamSize * 0.3), 1)} QA engineers)</p>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-900">Project Timeline (Gantt Chart)</h3>
        {timeline.phases.map((phase, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-900 w-32">
                {phase.name}
              </span>
              <span className="text-xs text-slate-600 text-right w-20">
                {phase.days.toFixed(1)} days
              </span>
            </div>
            <div className="flex-1 h-8 bg-slate-100 rounded overflow-hidden flex">
              <div
                className={`${phase.color} transition-all flex items-center justify-center`}
                style={{ width: `${phase.percentage}%` }}
              >
                {phase.percentage > 8 && (
                  <span className="text-xs font-bold text-white">
                    {phase.percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Breakdown */}
      <div className="p-4 bg-slate-50 rounded-lg">
        <h3 className="font-bold text-slate-900 mb-3">Weekly Schedule</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Weeks 1-2:</span>
            <span className="font-semibold text-slate-900">Design & Planning</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              Weeks 3-{Math.ceil((timeline.totalDays - 17) / 5) + 2}:
            </span>
            <span className="font-semibold text-slate-900">Development</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              Weeks {Math.ceil((timeline.totalDays - 17) / 5) + 3}-{timeline.weeksTotal - 3}:
            </span>
            <span className="font-semibold text-slate-900">QA & Testing</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              Week {timeline.weeksTotal - 2}:
            </span>
            <span className="font-semibold text-slate-900">Deployment</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              Week {timeline.weeksTotal}:
            </span>
            <span className="font-semibold text-slate-900">Support & Monitoring</span>
          </div>
        </div>
      </div>

      {/* Team Allocation */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-semibold text-green-900 mb-2">Development Team</h4>
          <ul className="text-xs text-green-800 space-y-1">
            <li>✓ {teamSize} Developers</li>
            <li>✓ {effectiveDevManDays.toFixed(1)} man days total</li>
            <li>✓ ~{Math.ceil((effectiveDevManDays / teamSize) / parallelizationFactor)} calendar days</li>
            <li className="text-xs text-green-700 mt-2">Efficiency: {(parallelizationFactor * 100).toFixed(0)}% (with overhead)</li>
          </ul>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-900 mb-2">QA Team</h4>
          <ul className="text-xs text-yellow-800 space-y-1">
            <li>✓ {Math.max(Math.ceil(teamSize * 0.3), 1)} QA Engineer{Math.max(Math.ceil(teamSize * 0.3), 1) > 1 ? 's' : ''}</li>
            <li>✓ {effectiveQaManDays.toFixed(1)} man days total</li>
            <li>✓ ~{Math.ceil((effectiveQaManDays / Math.max(teamSize * 0.3, 1)) / parallelizationFactor)} calendar days</li>
            <li className="text-xs text-yellow-700 mt-2">({(teamSize * 0.3 * 100).toFixed(0)}% of dev team)</li>
          </ul>
        </div>
      </div>

      {/* Phase Details */}
      <div className="p-4 bg-slate-50 rounded-lg space-y-3">
        <h3 className="font-bold text-slate-900">Phase Details</h3>
        <div className="text-xs text-slate-700 space-y-2">
          <div>
            <strong className="text-slate-900">Design & Planning (15%):</strong>
            <p>Requirement analysis, architecture, tech stack selection, resource planning</p>
          </div>
          <div>
            <strong className="text-slate-900">Development (60%):</strong>
            <p>Coding, unit testing, code review, integration, documentation</p>
          </div>
          <div>
            <strong className="text-slate-900">QA & Testing:</strong>
            <p>Test case creation, execution, regression testing, bug fixing, UAT</p>
          </div>
          <div>
            <strong className="text-slate-900">Deployment (3 days):</strong>
            <p>Pre-production testing, production deployment, rollback readiness</p>
          </div>
          <div>
            <strong className="text-slate-900">Support (1 week):</strong>
            <p>Production monitoring, critical bug fixes, stakeholder support</p>
          </div>
          <div>
            <strong className="text-slate-900">Buffer (5%):</strong>
            <p>Contingency for risks, unknowns, and unforeseen delays</p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h3 className="font-bold text-amber-900 mb-2">Recommendations</h3>
        <ul className="text-xs text-amber-800 space-y-1">
          <li>✓ Start with design phase to validate approach</li>
          <li>✓ Overlap QA preparation during development</li>
          <li>✓ Reserve buffer time for critical path risks</li>
          <li>✓ Plan for 2-3 rounds of testing cycles</li>
          <li>✓ Include daily standups throughout timeline</li>
          <li>✓ Document progress weekly against milestones</li>
        </ul>
      </div>

      {/* Save Button */}
      {analysisId && (
        <button
          onClick={() => saveTimeline()}
          disabled={saving}
          className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400"
          }`}
        >
          {saving ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </div>
          ) : saved ? (
            "✓ Saved Successfully"
          ) : (
            "💾 Save Project Timeline"
          )}
        </button>
      )}

      {downloadButton({
        totalWeeks: Math.max(timeline.weeksTotal, Math.ceil(cursorDays / 5)),
        totalDays: timeline.totalDays,
        devManDays: effectiveDevManDays,
        qaManDays: effectiveQaManDays,
        source: "quick",
        rows: quickRows,
      })}
    </div>
  );
}
