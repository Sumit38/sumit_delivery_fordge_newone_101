"use client";

import { useState } from "react";

interface TestingStrategy {
  testPyramid: { unit: number; integration: number; e2e: number; description: string };
  testTypes: { functional: string[]; nonFunctional: string[]; compliance: string[] };
  automationStrategy: { automatedPercentage: number; toAutomate: string[]; manual: string[]; roi: string };
  coverageTargets: { codeCoverage: string; scenarioCoverage: string; criticalPaths: string[] };
  testingPhases: Array<{ phase: string; duration: string; focus: string }>;
  resources: { qaTeamSize: number; testingDays: number; estimatedCost: string };
  qualityGates: Record<string, string>;
  successCriteria: string[];
  risks: string[];
}

interface Props {
  requirementText: string;
  testingComplexity: string;
  onStrategyComplete?: (strategy: TestingStrategy) => void;
}

export default function TestingStrategyProposal({ requirementText, testingComplexity, onStrategyComplete }: Props) {
  const [strategy, setStrategy] = useState<TestingStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate-testing-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementText, testingComplexity }),
      });

      if (!response.ok) throw new Error("Strategy generation failed");

      const data = await response.json();
      setStrategy(data.strategy);
      if (onStrategyComplete) onStrategyComplete(data.strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div></div>;
  }

  if (!strategy) {
    return (
      <button onClick={generate} className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
        🧪 Generate Testing Strategy
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Pyramid */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <h3 className="font-bold text-lg mb-4">📊 Test Pyramid Distribution</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-semibold text-slate-900">Unit Tests</span>
              <span className="text-sm font-bold text-blue-600">{strategy.testPyramid.unit}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${strategy.testPyramid.unit}%` }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-semibold text-slate-900">Integration Tests</span>
              <span className="text-sm font-bold text-blue-600">{strategy.testPyramid.integration}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${strategy.testPyramid.integration}%` }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-semibold text-slate-900">E2E Tests</span>
              <span className="text-sm font-bold text-blue-600">{strategy.testPyramid.e2e}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${strategy.testPyramid.e2e}%` }}></div>
            </div>
          </div>
          <p className="text-sm text-slate-600 pt-3 border-t border-slate-300">{strategy.testPyramid.description}</p>
        </div>
      </div>

      {/* Test Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="font-bold text-slate-900 mb-2">✓ Functional Tests</p>
          <ul className="space-y-1">
            {strategy.testTypes.functional.map((t, i) => <li key={i} className="text-sm text-slate-700">• {t}</li>)}
          </ul>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="font-bold text-slate-900 mb-2">⚡ Non-Functional Tests</p>
          <ul className="space-y-1">
            {strategy.testTypes.nonFunctional.map((t, i) => <li key={i} className="text-sm text-slate-700">• {t}</li>)}
          </ul>
        </div>
      </div>

      {/* Automation Strategy */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="font-bold text-green-900 mb-3">🤖 Automation Strategy</p>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-green-800 mb-1">Automation Ratio: <strong>{strategy.automationStrategy.automatedPercentage}%</strong></p>
            <div className="w-full bg-green-200 rounded-full h-3">
              <div className="bg-green-600 h-3 rounded-full" style={{ width: `${strategy.automationStrategy.automatedPercentage}%` }}></div>
            </div>
          </div>
          <p className="text-sm text-green-800"><strong>ROI:</strong> {strategy.automationStrategy.roi}</p>
          <div>
            <p className="text-xs font-bold text-green-800 mb-1">Automate:</p>
            <div className="flex flex-wrap gap-2">
              {strategy.automationStrategy.toAutomate.map((a, i) => <span key={i} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">{a}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Coverage & Phases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="font-bold text-blue-900 mb-3">🎯 Coverage Targets</p>
          <p className="text-sm text-blue-800 mb-2"><strong>Code Coverage:</strong> {strategy.coverageTargets.codeCoverage}</p>
          <p className="text-sm text-blue-800"><strong>Scenario Coverage:</strong> {strategy.coverageTargets.scenarioCoverage}</p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="font-bold text-yellow-900 mb-3">⏱️ Resources</p>
          <p className="text-sm text-yellow-800 mb-1"><strong>QA Team:</strong> {strategy.resources.qaTeamSize} engineer(s)</p>
          <p className="text-sm text-yellow-800"><strong>Timeline:</strong> {strategy.resources.testingDays} days</p>
          <p className="text-sm text-yellow-800 mt-2"><strong>Budget:</strong> ${strategy.resources.estimatedCost}</p>
        </div>
      </div>

      {/* Quality Gates */}
      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <p className="font-bold text-purple-900 mb-3">🚪 Quality Gates</p>
        <div className="space-y-1">
          {Object.entries(strategy.qualityGates).map(([gate, criteria], i) => (
            <p key={i} className="text-sm text-purple-800"><strong>{gate}:</strong> {criteria}</p>
          ))}
        </div>
      </div>

      {/* Success Criteria */}
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <p className="font-bold text-green-900 mb-2">✅ Success Criteria</p>
        <ul className="space-y-1">
          {strategy.successCriteria.map((c, i) => <li key={i} className="text-sm text-green-800">✓ {c}</li>)}
        </ul>
      </div>

      {/* Risks */}
      {strategy.risks.length > 0 && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-bold text-red-900 mb-2">⚠️ Testing Risks</p>
          <ul className="space-y-1">
            {strategy.risks.map((r, i) => <li key={i} className="text-sm text-red-800">• {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
