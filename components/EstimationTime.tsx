"use client";

interface EstimationTimeProps {
  complexityScore: number;
  paths: number;
  nodesCount: number;
  edgesCount: number;
}

export default function EstimationTime({
  complexityScore,
  paths,
  nodesCount,
  edgesCount,
}: EstimationTimeProps) {
  const totalScenarios = 2 * paths;

  // QA ESTIMATION CALCULATION
  // Based on complexity level and scenario count
  const getQAHoursPerScenario = (complexity: number): number => {
    if (complexity <= 5) return 2; // Low complexity: 2 hours per scenario
    if (complexity <= 15) return 2.5; // Medium: 2.5 hours
    if (complexity <= 30) return 3; // High: 3 hours
    return 4; // Very High: 4 hours
  };

  const qaHoursPerScenario = getQAHoursPerScenario(complexityScore);
  const totalQAHours = totalScenarios * qaHoursPerScenario;
  const qaManDays = totalQAHours / 8;

  // DEVELOPMENT ESTIMATION CALCULATION
  // Based on complexity score, nodes, edges, paths
  const getDevEstimation = (m: number, n: number, e: number, p: number): number => {
    let baseManDays = 0;

    // Complexity level multiplier
    if (m <= 5) {
      baseManDays = 5;
    } else if (m <= 15) {
      baseManDays = 15;
    } else if (m <= 30) {
      baseManDays = 30;
    } else {
      baseManDays = 50;
    }

    // Adjust for actual complexity metrics
    // Add 0.1 man days per node (implementation complexity)
    // Add 0.05 man days per edge (integration complexity)
    // Add 0.02 man days per path (test coverage complexity)
    const metricsAdjustment = n * 0.1 + e * 0.05 + p * 0.02;

    return baseManDays + metricsAdjustment;
  };

  const devManDays = getDevEstimation(complexityScore, nodesCount, edgesCount, paths);

  // TOTAL ESTIMATION
  const totalManDays = qaManDays + devManDays;

  // TEAM ESTIMATION (assuming standard teams)
  const devTeamDays = Math.ceil(devManDays / 2); // 2 developers
  const qaTeamDays = Math.ceil(qaManDays / 1); // 1 QA engineer
  const totalTeamDays = Math.max(devTeamDays, qaTeamDays); // Parallel work

  const getComplexityLevel = (complexity: number): string => {
    if (complexity <= 5) return "Low";
    if (complexity <= 15) return "Medium";
    if (complexity <= 30) return "High";
    return "Very High";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-purple-900 mb-2">⏱️ Possible Estimation Time</h2>
        <p className="text-sm text-purple-700">
          QA and Development effort estimation based on complexity analysis
        </p>
      </div>

      {/* QA ESTIMATION */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-4">🧪 QA Estimation</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Total Scenarios */}
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <p className="text-xs text-blue-600 font-semibold mb-1">Total Test Scenarios</p>
            <p className="text-2xl font-bold text-blue-900">{totalScenarios}</p>
            <p className="text-xs text-blue-600 mt-1">2P = 2 × {paths}</p>
          </div>

          {/* Hours per Scenario */}
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <p className="text-xs text-blue-600 font-semibold mb-1">Hours per Scenario</p>
            <p className="text-2xl font-bold text-blue-900">{qaHoursPerScenario}</p>
            <p className="text-xs text-blue-600 mt-1">({getComplexityLevel(complexityScore)} complexity)</p>
          </div>

          {/* Total QA Hours */}
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <p className="text-xs text-blue-600 font-semibold mb-1">Total QA Hours</p>
            <p className="text-2xl font-bold text-blue-900">{totalQAHours.toFixed(1)}</p>
            <p className="text-xs text-blue-600 mt-1">{totalScenarios} × {qaHoursPerScenario} hrs</p>
          </div>

          {/* QA Man Days */}
          <div className="bg-blue-100 rounded-lg p-4 border-2 border-blue-400">
            <p className="text-xs text-blue-700 font-bold mb-1">QA Man Days</p>
            <p className="text-3xl font-bold text-blue-900">{qaManDays.toFixed(1)}</p>
            <p className="text-xs text-blue-700 mt-1">{totalQAHours.toFixed(0)} ÷ 8 hrs/day</p>
          </div>
        </div>

        <div className="bg-white bg-opacity-60 rounded p-3 text-xs text-blue-700">
          <p>
            <strong>Calculation:</strong> {totalScenarios} scenarios × {qaHoursPerScenario} hours/scenario = {totalQAHours.toFixed(1)} hours = <strong>{qaManDays.toFixed(1)} man days</strong>
          </p>
        </div>
      </div>

      {/* DEVELOPMENT ESTIMATION */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-green-900 mb-4">💻 Development Estimation</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Complexity Score */}
          <div className="bg-white rounded-lg p-4 border border-green-100">
            <p className="text-xs text-green-600 font-semibold mb-1">Complexity Score (M)</p>
            <p className="text-2xl font-bold text-green-900">{complexityScore}</p>
            <p className="text-xs text-green-600 mt-1">{getComplexityLevel(complexityScore)} Level</p>
          </div>

          {/* Base Estimation */}
          <div className="bg-white rounded-lg p-4 border border-green-100">
            <p className="text-xs text-green-600 font-semibold mb-1">Base Estimate</p>
            <p className="text-2xl font-bold text-green-900">
              {complexityScore <= 5 ? "5" : complexityScore <= 15 ? "15" : complexityScore <= 30 ? "30" : "50"}
            </p>
            <p className="text-xs text-green-600 mt-1">By complexity level</p>
          </div>

          {/* Metrics Adjustment */}
          <div className="bg-white rounded-lg p-4 border border-green-100">
            <p className="text-xs text-green-600 font-semibold mb-1">Metrics Adjustment</p>
            <p className="text-2xl font-bold text-green-900">
              +{(nodesCount * 0.1 + edgesCount * 0.05 + paths * 0.02).toFixed(1)}
            </p>
            <p className="text-xs text-green-600 mt-1">N, E, P factors</p>
          </div>

          {/* Total Dev Man Days */}
          <div className="bg-green-100 rounded-lg p-4 border-2 border-green-400">
            <p className="text-xs text-green-700 font-bold mb-1">Dev Man Days</p>
            <p className="text-3xl font-bold text-green-900">{devManDays.toFixed(1)}</p>
            <p className="text-xs text-green-700 mt-1">Single developer</p>
          </div>
        </div>

        <div className="bg-white bg-opacity-60 rounded p-3 text-xs text-green-700 mb-3">
          <p>
            <strong>Calculation:</strong> Base ({complexityScore <= 5 ? "5" : complexityScore <= 15 ? "15" : complexityScore <= 30 ? "30" : "50"}) + (N×0.1 + E×0.05 + P×0.02) = <strong>{devManDays.toFixed(1)} man days</strong>
          </p>
        </div>
      </div>

      {/* TOTAL ESTIMATION SUMMARY */}
      <div className="bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-400 rounded-lg p-6">
        <h3 className="text-lg font-bold text-purple-900 mb-4">📊 Total Estimation Summary</h3>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* QA */}
          <div className="bg-white rounded-lg p-4 border border-purple-200 text-center">
            <p className="text-xs text-purple-600 font-semibold mb-1">QA</p>
            <p className="text-2xl font-bold text-purple-900">{qaManDays.toFixed(1)}</p>
            <p className="text-xs text-purple-600">man days</p>
          </div>

          {/* Development */}
          <div className="bg-white rounded-lg p-4 border border-purple-200 text-center">
            <p className="text-xs text-purple-600 font-semibold mb-1">Development</p>
            <p className="text-2xl font-bold text-purple-900">{devManDays.toFixed(1)}</p>
            <p className="text-xs text-purple-600">man days</p>
          </div>

          {/* Total */}
          <div className="bg-white rounded-lg p-4 border-2 border-purple-400 text-center">
            <p className="text-xs text-purple-600 font-bold mb-1">Total</p>
            <p className="text-2xl font-bold text-purple-900">{totalManDays.toFixed(1)}</p>
            <p className="text-xs text-purple-600">man days</p>
          </div>
        </div>

        {/* Team Parallel Estimation */}
        <div className="bg-purple-50 rounded p-4 border border-purple-200">
          <p className="text-xs font-semibold text-purple-700 mb-2">📅 Parallel Team Estimate:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-purple-600">Dev Team (2 developers):</p>
              <p className="font-bold text-purple-900">{devTeamDays} days</p>
            </div>
            <div>
              <p className="text-purple-600">QA Team (1 QA engineer):</p>
              <p className="font-bold text-purple-900">{qaTeamDays} days</p>
            </div>
          </div>
          <p className="text-xs text-purple-600 mt-2 border-t border-purple-200 pt-2">
            <strong>Timeline (parallel execution):</strong> ~{totalTeamDays} calendar days (with team overlap)
          </p>
        </div>
      </div>
    </div>
  );
}
