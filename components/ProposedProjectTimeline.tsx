"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

interface TimelineProps {
  qaManDays: number;
  devManDays: number;
  complexityScore: number;
  analysisId?: string;
}

export default function ProposedProjectTimeline({
  qaManDays,
  devManDays,
  complexityScore,
  analysisId,
}: TimelineProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timeline = useMemo(() => {
    // Phase breakdown in percentage of dev days
    const designDays = devManDays * 0.15; // 15%
    const developmentDays = devManDays * 0.60; // 60%
    const testingDays = qaManDays; // All QA days
    const deploymentDays = 3; // Fixed 3 days
    const supportDays = 7; // Fixed 7 days (1 week)
    const bufferDays = (devManDays + qaManDays + deploymentDays + supportDays) * 0.05; // 5% buffer

    const totalDays =
      designDays +
      developmentDays +
      testingDays +
      deploymentDays +
      supportDays +
      bufferDays;

    const phases = [
      {
        name: "Design & Planning",
        days: designDays,
        color: "bg-blue-500",
        percentage: (designDays / totalDays) * 100,
      },
      {
        name: "Development",
        days: developmentDays,
        color: "bg-green-500",
        percentage: (developmentDays / totalDays) * 100,
      },
      {
        name: "QA & Testing",
        days: testingDays,
        color: "bg-yellow-500",
        percentage: (testingDays / totalDays) * 100,
      },
      {
        name: "Deployment",
        days: deploymentDays,
        color: "bg-purple-500",
        percentage: (deploymentDays / totalDays) * 100,
      },
      {
        name: "Support & Monitoring",
        days: supportDays,
        color: "bg-orange-500",
        percentage: (supportDays / totalDays) * 100,
      },
      {
        name: "Buffer (5%)",
        days: bufferDays,
        color: "bg-slate-300",
        percentage: (bufferDays / totalDays) * 100,
      },
    ];

    return {
      phases,
      totalDays,
      weeksTotal: Math.ceil(totalDays / 5),
      devTeamDays: Math.ceil(devManDays / 2),
      qaTeamDays: Math.ceil(qaManDays / 1),
    };
  }, [qaManDays, devManDays]);

  const getComplexityRecommendation = (score: number) => {
    if (score <= 5) return "Low complexity - streamlined process recommended";
    if (score <= 15) return "Medium complexity - standard phased approach";
    if (score <= 30) return "High complexity - extended testing cycles recommended";
    return "Very High complexity - consider splitting into multiple releases";
  };

  const saveTimeline = async () => {
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

      const response = await fetch("/api/save-project-timeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          analysisId,
          totalDays: timeline.totalDays,
          qaManDays,
          devManDays,
          complexityScore,
          phases: timeline.phases,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save timeline");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

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
          <p className="text-2xl font-bold text-slate-900">{timeline.devTeamDays}</p>
          <p className="text-xs text-slate-600 mt-1">Dev Team Days</p>
          <p className="text-xs text-slate-500 mt-1">(2 developers)</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-2xl font-bold text-slate-900">{timeline.qaTeamDays}</p>
          <p className="text-xs text-slate-600 mt-1">QA Team Days</p>
          <p className="text-xs text-slate-500 mt-1">(1 QA engineer)</p>
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
            <li>✓ 2 Senior Developers</li>
            <li>✓ {devManDays.toFixed(1)} man days total</li>
            <li>✓ ~{timeline.devTeamDays} calendar days</li>
          </ul>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-900 mb-2">QA Team</h4>
          <ul className="text-xs text-yellow-800 space-y-1">
            <li>✓ 1 QA Engineer</li>
            <li>✓ {qaManDays.toFixed(1)} man days total</li>
            <li>✓ ~{timeline.qaTeamDays} calendar days</li>
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
          onClick={saveTimeline}
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
    </div>
  );
}
