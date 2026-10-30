"use client";

import {
  formatDuration,
  formatCurrency,
  getEstimationCategory,
} from "@/lib/estimation-calculator";
import type { ComprehensiveDetails, StaffLoad } from "@/lib/estimation-team";
import { buildEstimationGantt, ganttHtml } from "@/lib/estimation-gantt";
import EstimationGanttChart from "./EstimationGanttChart";
import InfoTip from "./InfoTip";
import { calculationNotes } from "@/lib/calculation-notes";

interface EstimationReportProps {
  estimation: {
    baseEffort: number;
    totalEffort: number;
    timeline: number;
    teamSize: number;
    costPerHour?: number;
    totalBudget?: number;
    riskLevel: string;
    skillLevel: string;
    techFamiliarity: string;
    testingLevel: string;
    confidence: number;
    breakdown: {
      skillFactor: number;
      techFactor: number;
      testFactor: number;
      riskFactor: number;
      deadlineFactor: number;
      details?: ComprehensiveDetails;
    };
    assumptions: string[];
  };
  onReset: () => void;
  // Shown after a new estimation, which is saved as soon as it is generated
  savedToHistory?: boolean;
  onViewHistory?: () => void;
}

const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Extra report sections for estimations made with the team and testing questions
function detailsHtml(d: ComprehensiveDetails): string {
  const loadRows = (loads: StaffLoad[]) =>
    loads
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.label)}</td><td>${l.count}</td><td>${escapeHtml(l.seniority)}</td><td>${l.hours}</td><td>${l.weeks}</td><td>${escapeHtml(l.tasks.join(", "))}</td></tr>`
      )
      .join("");
  const loadTable = (title: string, loads: StaffLoad[]) =>
    loads.length
      ? `<h3>${title}</h3><table><tr><th>Role</th><th>People</th><th>Seniority</th><th>Hours</th><th>Weeks</th><th>Work</th></tr>${loadRows(loads)}</table>`
      : "";
  return `
      <h2>Effort by Area</h2>
      <table>
        <tr><th>Area</th><th>Hours</th></tr>
        <tr><td>Development</td><td>${d.devHours}</td></tr>
        <tr><td>Defect fixing</td><td>${d.defectFixHours}</td></tr>
        <tr><td>Testing</td><td>${d.testingHours}</td></tr>
        <tr><td>Support roles</td><td>${d.overheadHours}</td></tr>
      </table>
      <h2>Team &amp; Workstreams</h2>
      <table>
        <tr><th>Work area</th><th>Base hours</th><th>Done by</th></tr>
        ${d.workstreams.map((w) => `<tr><td>${escapeHtml(w.label)}</td><td>${w.hours}</td><td>${escapeHtml(w.staffedBy)}${w.fallback ? " (covering)" : ""}</td></tr>`).join("")}
      </table>
      ${loadTable("Developers", d.devLoads)}
      ${loadTable("Support roles", d.supportLoads)}
      <h2>Testing Effort</h2>
      <p>${d.scenarios} scenarios → ${d.testCases} test cases (${d.automatedTestCases} automated). Approach: ${escapeHtml(d.testApproach)}.</p>
      <table>
        <tr><th>Activity</th><th>Hours</th><th>How it was counted</th><th>Owner</th><th>When</th></tr>
        ${d.testActivities.map((a) => `<tr><td>${escapeHtml(a.activity)}</td><td>${a.hours}</td><td>${escapeHtml(a.rule)}</td><td>${escapeHtml(a.owner)}</td><td>${a.phase === "end" ? "End phase" : "During sprints"}</td></tr>`).join("")}
      </table>
      ${loadTable("Testers", d.testLoads)}
      <h2>Gaps &amp; Risks</h2>
      ${d.gaps.length ? `<ul>${d.gaps.map((g) => `<li><strong>${g.severity.toUpperCase()}</strong>: ${escapeHtml(g.message)}</li>`).join("")}</ul>` : "<p>No staffing gaps found.</p>"}
  `;
}

function generatePDFContent(estimation: any, category: string): string {
  const details: ComprehensiveDetails | undefined = estimation.breakdown?.details;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Project Estimation Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 20px; }
        .metric-box { margin: 10px 0; padding: 10px; border-left: 4px solid #3498db; background: #ecf0f1; }
        .metric-label { font-weight: bold; color: #2c3e50; }
        .metric-value { font-size: 18px; color: #2980b9; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #bdc3c7; padding: 10px; text-align: left; }
        th { background: #34495e; color: white; }
        .assumption-list { margin-left: 20px; }
        .assumption-list li { margin: 5px 0; }
        .footer { margin-top: 30px; font-size: 12px; color: #7f8c8d; border-top: 1px solid #bdc3c7; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>📊 Project Estimation Report</h1>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

      <h2>Key Metrics</h2>
      <div class="metric-box">
        <div class="metric-label">Project Category:</div>
        <div class="metric-value">${category}</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Total Effort:</div>
        <div class="metric-value">${estimation.totalEffort} hours (${(estimation.totalEffort / 40).toFixed(1)} weeks for 1 dev)</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Estimated Timeline:</div>
        <div class="metric-value">${formatDuration(estimation.timeline)}</div>
      </div>
      <div class="metric-box">
        <div class="metric-label">Team Size:</div>
        <div class="metric-value">${estimation.teamSize} developers${details ? ` (${details.totalPeople} people in total)` : ""}</div>
      </div>
      ${estimation.totalBudget ? `
      <div class="metric-box">
        <div class="metric-label">Total Budget:</div>
        <div class="metric-value">${formatCurrency(estimation.totalBudget)} @ ${formatCurrency(estimation.costPerHour)}/hour</div>
      </div>
      ` : ''}
      <div class="metric-box">
        <div class="metric-label">Estimation Confidence:</div>
        <div class="metric-value">${estimation.confidence}%</div>
      </div>

      <h2>Project Timeline (Gantt Chart)</h2>
      ${ganttHtml(buildEstimationGantt(estimation))}

      ${details ? detailsHtml(details) : `
      <h2>Effort Breakdown</h2>
      <table>
        <tr>
          <th>Component</th>
          <th>Hours</th>
        </tr>
        <tr>
          <td>Base Effort</td>
          <td>${estimation.baseEffort}</td>
        </tr>
        <tr>
          <td>Skill Level Adjustment (${estimation.breakdown.skillFactor}x)</td>
          <td>${Math.round(estimation.baseEffort * (estimation.breakdown.skillFactor - 1))}</td>
        </tr>
        <tr>
          <td>Tech Stack Adjustment (${estimation.breakdown.techFactor}x)</td>
          <td>${Math.round(estimation.baseEffort * (estimation.breakdown.techFactor - 1))}</td>
        </tr>
        <tr>
          <td>Testing Level Adjustment (${estimation.breakdown.testFactor}x)</td>
          <td>${Math.round(estimation.baseEffort * (estimation.breakdown.testFactor - 1))}</td>
        </tr>
        <tr>
          <td><strong>Total Adjusted Effort</strong></td>
          <td><strong>${estimation.totalEffort}</strong></td>
        </tr>
      </table>`}

      <h2>Parameters Used</h2>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
        </tr>
        <tr>
          <td>Team Skill Level</td>
          <td>${estimation.skillLevel}</td>
        </tr>
        <tr>
          <td>Tech Familiarity</td>
          <td>${estimation.techFamiliarity}</td>
        </tr>
        <tr>
          <td>Testing Level</td>
          <td>${estimation.testingLevel}</td>
        </tr>
        <tr>
          <td>Risk Level</td>
          <td>${estimation.riskLevel}</td>
        </tr>
      </table>

      <h2>Key Assumptions</h2>
      <ul class="assumption-list">
        ${estimation.assumptions.map((a: string) => `<li>${escapeHtml(a)}</li>`).join('')}
      </ul>

      <div class="footer">
        <p>This report was generated by DeliveryForge - Complexity Analysis & Estimation Tool</p>
      </div>
    </body>
    </html>
  `;
}

function LoadTable({ title, loads }: { title: string; loads: StaffLoad[] }) {
  if (!loads.length) return null;
  const slowest = Math.max(...loads.map((l) => l.weeks));
  return (
    <div className="mt-4">
      <div className="text-sm font-semibold text-gray-600 mb-2">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">People</th>
              <th className="py-2 pr-3">Seniority</th>
              <th className="py-2 pr-3">Hours</th>
              <th className="py-2 pr-3">Weeks</th>
              <th className="py-2">Work</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((l) => (
              <tr key={l.role} className={`border-b last:border-b-0 ${l.role === "unstaffed" ? "bg-red-50" : ""}`}>
                <td className="py-2 pr-3 font-medium text-gray-900">{l.label}</td>
                <td className="py-2 pr-3">{l.count}</td>
                <td className="py-2 pr-3">{l.seniority}</td>
                <td className="py-2 pr-3">{l.hours}</td>
                <td className="py-2 pr-3">
                  {l.weeks}
                  {l.weeks === slowest && loads.length > 1 && (
                    <span className="ml-1 text-xs text-orange-600 font-semibold">slowest</span>
                  )}
                </td>
                <td className="py-2 text-gray-600">{l.tasks.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DetailsSections({ details: d }: { details: ComprehensiveDetails }) {
  const areas = [
    { label: "Development", hours: d.devHours, color: "bg-blue-500" },
    { label: "Defect fixing", hours: d.defectFixHours, color: "bg-blue-300" },
    { label: "Testing", hours: d.testingHours, color: "bg-purple-500" },
    { label: "Support roles", hours: d.overheadHours, color: "bg-gray-400" },
  ];
  const total = areas.reduce((s, a) => s + a.hours, 0) || 1;
  const severityStyle = {
    high: "bg-red-50 border-red-200 text-red-800",
    medium: "bg-orange-50 border-orange-200 text-orange-800",
    low: "bg-gray-50 border-gray-200 text-gray-700",
  };

  return (
    <>
      {/* Effort by area */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">📊 Effort by Area</h3>
        <div className="flex h-3 rounded-full overflow-hidden mb-4">
          {areas.map((a) => (
            <div key={a.label} className={a.color} style={{ width: `${(a.hours / total) * 100}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {areas.map((a) => (
            <div key={a.label} className="flex items-center gap-2 text-sm">
              <span className={`w-3 h-3 rounded-sm ${a.color}`} />
              <span className="text-gray-700">
                {a.label}
                <InfoTip
                  note={
                    a.label === "Testing"
                      ? calculationNotes.qa(0, { breakdown: { details: d } })
                      : a.label === "Support roles"
                      ? calculationNotes.total(0, { breakdown: { details: d } })
                      : calculationNotes.dev(0, { breakdown: { details: d } })
                  }
                />
              </span>
              <span className="ml-auto font-semibold text-gray-900">{a.hours} h</span>
            </div>
          ))}
        </div>
      </div>

      {/* Team & workstreams */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">👥 Team &amp; Workstreams</h3>
        <p className="text-sm text-gray-600">
          Development takes about <strong>{d.devWeeks} weeks</strong>, set by the slowest role. {d.totalPeople} people in total.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {d.workstreams.map((w) => (
            <span
              key={w.id}
              className={`text-xs px-2 py-1 rounded border ${
                w.staffedBy === "Not staffed"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : w.fallback
                  ? "bg-orange-50 border-orange-200 text-orange-700"
                  : "bg-green-50 border-green-200 text-green-700"
              }`}
            >
              {w.label}: {w.hours} h → {w.staffedBy}
            </span>
          ))}
        </div>
        <LoadTable title="Developers" loads={d.devLoads} />
        <LoadTable title="Support roles" loads={d.supportLoads} />
      </div>

      {/* Testing */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">🧪 Testing Effort</h3>
        <p className="text-sm text-gray-600">
          {d.scenarios} scenarios → {d.testCases} test cases ({d.automatedTestCases} automated). {d.testApproach}. Testing takes about{" "}
          <strong>{d.testingWeeks} weeks</strong>
          {d.endPhaseWeeks > 0 ? `, of which ${d.endPhaseWeeks} weeks happen at the end` : ""}.
        </p>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Activity</th>
                <th className="py-2 pr-3">Hours</th>
                <th className="py-2 pr-3">How it was counted</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {d.testActivities.map((a) => (
                <tr key={a.activity} className="border-b last:border-b-0">
                  <td className="py-2 pr-3 font-medium text-gray-900">{a.activity}</td>
                  <td className="py-2 pr-3">{a.hours}</td>
                  <td className="py-2 pr-3 text-gray-600">{a.rule}</td>
                  <td className={`py-2 pr-3 ${a.owner === "Not staffed" ? "text-red-600 font-semibold" : ""}`}>{a.owner}</td>
                  <td className="py-2 text-gray-600">{a.phase === "end" ? "End phase" : "During sprints"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadTable title="Testers" loads={d.testLoads} />
      </div>

      {/* Gaps */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">⚠️ Gaps &amp; Risks</h3>
        {d.gaps.length === 0 ? (
          <p className="text-sm text-green-700">No staffing gaps found: every selected area and test type has someone who can do it.</p>
        ) : (
          <ul className="space-y-2">
            {d.gaps.map((g, i) => (
              <li key={i} className={`border rounded-lg px-3 py-2 text-sm ${severityStyle[g.severity]}`}>
                <span className="font-semibold uppercase text-xs mr-2">{g.severity}</span>
                {g.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function EstimationReport({
  estimation,
  onReset,
  savedToHistory = false,
  onViewHistory,
}: EstimationReportProps) {
  const handleDownloadPDF = () => {
    const category = getEstimationCategory(estimation.totalEffort / 8);
    const htmlContent = generatePDFContent(estimation, category);

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estimation-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const details = estimation.breakdown?.details;
  const category = getEstimationCategory(estimation.totalEffort / 8); // Back-calculate complexity
  const effortBreakdown = {
    base: estimation.baseEffort,
    skillAdjustment: Math.round(
      estimation.baseEffort * (estimation.breakdown.skillFactor - 1)
    ),
    techAdjustment: Math.round(
      estimation.baseEffort * (estimation.breakdown.techFactor - 1)
    ),
    testAdjustment: Math.round(
      estimation.baseEffort * (estimation.breakdown.testFactor - 1)
    ),
    riskAdjustment: Math.round(
      estimation.baseEffort * (estimation.breakdown.riskFactor - 1)
    ),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              ✅ Estimation Generated
            </h2>
            <p className="text-gray-600">
              Project Category: <span className="font-semibold">{category}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-green-600 mb-1">
              {estimation.timeline}
            </div>
            <div className="text-sm text-gray-600">weeks</div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className={`grid grid-cols-1 ${estimation.totalBudget ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"} gap-4`}>
        {/* Total Effort */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-blue-900 mb-1">
            Total Effort <InfoTip note={calculationNotes.totalEffort(estimation)} />
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {estimation.totalEffort}
          </div>
          <div className="text-xs text-blue-700 mt-2">
            {(estimation.totalEffort / 40).toFixed(1)} weeks (1 developer)
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-purple-900 mb-1">
            Estimated Timeline <InfoTip note={calculationNotes.timeline(estimation)} />
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {formatDuration(estimation.timeline)}
          </div>
          <div className="text-xs text-purple-700 mt-2">
            {estimation.teamSize} developers available
          </div>
        </div>

        {/* Total Budget - Conditional */}
        {estimation.totalBudget && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-green-900 mb-1">
              Total Budget <InfoTip note={calculationNotes.budget(estimation)} />
            </div>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(estimation.totalBudget)}
            </div>
            <div className="text-xs text-green-700 mt-2">
              @ {formatCurrency(estimation.costPerHour!)}/hour
            </div>
          </div>
        )}

        {/* Confidence */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-orange-900 mb-1">
            Estimation Confidence <InfoTip align="right" note={calculationNotes.confidence(estimation)} />
          </div>
          <div className="text-3xl font-bold text-orange-600">
            {estimation.confidence}%
          </div>
          <div className="w-full bg-orange-200 rounded-full h-2 mt-2">
            <div
              className="bg-orange-600 h-2 rounded-full"
              style={{ width: `${estimation.confidence}%` }}
            ></div>
          </div>
        </div>
      </div>

      {savedToHistory && (
        <div className="flex flex-wrap items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <span className="flex-1">✓ Saved to Estimation History, including the team, testing plan and Gantt chart.</span>
          {onViewHistory && (
            <button
              type="button"
              onClick={onViewHistory}
              className="px-3 py-1.5 bg-white border border-green-300 rounded-lg font-semibold hover:bg-green-100"
            >
              View in Estimation History →
            </button>
          )}
        </div>
      )}

      <EstimationGanttChart estimation={estimation} />

      {details && <DetailsSections details={details} />}

      {/* Detailed Breakdown (estimations made without the team and testing questions) */}
      {!details && (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          📊 Effort Breakdown
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-700">Base Effort</span>
            <span className="font-semibold text-gray-900">
              {estimation.baseEffort} hours
            </span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-700">
              Skill Level Adjustment ({estimation.breakdown.skillFactor}x)
            </span>
            <span className="font-semibold text-gray-900">
              {effortBreakdown.skillAdjustment > 0 ? "+" : ""}
              {effortBreakdown.skillAdjustment} hours
            </span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-700">
              Tech Stack Adjustment ({estimation.breakdown.techFactor}x)
            </span>
            <span className="font-semibold text-gray-900">
              {effortBreakdown.techAdjustment > 0 ? "+" : ""}
              {effortBreakdown.techAdjustment} hours
            </span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-700">
              Testing Level Adjustment ({estimation.breakdown.testFactor}x)
            </span>
            <span className="font-semibold text-gray-900">
              {effortBreakdown.testAdjustment > 0 ? "+" : ""}
              {effortBreakdown.testAdjustment} hours
            </span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-lg font-bold text-gray-900">
              Total Adjusted Effort
            </span>
            <span className="text-lg font-bold text-green-600">
              {estimation.totalEffort} hours
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Parameters Used */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          ⚙️ Parameters Used
        </h3>
        <div className={`grid grid-cols-1 ${estimation.totalBudget ? "md:grid-cols-2" : ""} gap-6`}>
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">
              Team Configuration
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">Team Size:</span>{" "}
                {estimation.teamSize} developers
              </div>
              <div>
                <span className="font-medium">Skill Level:</span>{" "}
                {estimation.skillLevel}
              </div>
              <div>
                <span className="font-medium">Risk Level:</span>{" "}
                {estimation.riskLevel}
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-2">
              Project Requirements
            </div>
            <div className="space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-medium">Tech Familiarity:</span>{" "}
                {estimation.techFamiliarity}
              </div>
              <div>
                <span className="font-medium">Testing Level:</span>{" "}
                {estimation.testingLevel}
              </div>
              {estimation.costPerHour && (
                <div>
                  <span className="font-medium">Cost Per Hour:</span>{" "}
                  {formatCurrency(estimation.costPerHour)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assumptions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          📝 Key Assumptions
        </h3>
        <ul className="space-y-2">
          {estimation.assumptions.map((assumption, idx) => (
            <li key={idx} className="flex gap-3 text-sm text-gray-700">
              <span className="text-blue-600 font-semibold">✓</span>
              <span>{assumption}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          onClick={onReset}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
        >
          🔄 Generate New Estimation
        </button>
        <button
          onClick={handleDownloadPDF}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
        >
          📥 Download Report (HTML/PDF)
        </button>
      </div>
    </div>
  );
}
