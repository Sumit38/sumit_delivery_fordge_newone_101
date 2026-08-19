"use client";

import { useState } from "react";

interface DevStrategy {
  implementationApproach: { type: string; phases: string[]; rationale: string; releaseStrategy: string };
  architecture: { designOverview: string; componentsToCreate: string[]; componentsToModify: string[]; integrationPoints: string[]; databaseChanges: string[] };
  technology: { languages: string[]; frameworks: string[]; libraries: string[]; patterns: string[]; bestPractices: string[] };
  developmentBreakdown: Array<{ feature: string; priority: string; components: string[]; estimatedDays: number }>;
  developmentPhases: Array<{ phase: string; duration: string; deliverables: string[] }>;
  codeReview: { criticalPaths: string[]; performanceBenchmarks: string; securityRequirements: string[] };
  documentation: Record<string, string>;
  resources: { teamSize: number; seniority: string; estimatedDays: number; estimatedCost: string; dependencies: string[] };
  risks: Array<{ risk: string; impact: string; mitigation: string }>;
  successCriteria: string[];
}

interface Props {
  requirementText: string;
  devComplexity: string;
  onStrategyComplete?: (strategy: DevStrategy) => void;
}

export default function DevelopmentStrategyProposal({ requirementText, devComplexity, onStrategyComplete }: Props) {
  const [strategy, setStrategy] = useState<DevStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/generate-development-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementText, devComplexity }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to generate strategy");
        return;
      }

      if (!data.strategy) {
        setError("No strategy data received");
        return;
      }

      setStrategy(data.strategy);
      if (onStrategyComplete) onStrategyComplete(data.strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Generating development strategy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 mb-4">❌ Error: {error}</p>
        <button onClick={generate} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">
          🔄 Retry
        </button>
      </div>
    );
  }

  if (!strategy) {
    return (
      <button onClick={generate} className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
        💻 Generate Development Strategy
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Implementation Approach */}
      <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
        <h3 className="font-bold text-lg text-green-900 mb-4">🎯 Implementation Approach</h3>
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-green-900 text-lg">{strategy.implementationApproach.type}</p>
            <p className="text-sm text-green-800 mt-1">{strategy.implementationApproach.rationale}</p>
          </div>
          <div className="p-3 bg-white bg-opacity-60 rounded">
            <p className="text-sm font-semibold text-green-900">Release Strategy: <span className="text-green-700">{strategy.implementationApproach.releaseStrategy}</span></p>
          </div>
        </div>
      </div>

      {/* Technology Stack */}
      {strategy.technology && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-bold text-slate-900 mb-2">Languages & Frameworks</p>
            <div className="space-y-1">
              {strategy.technology.languages && (
                <p className="text-sm text-slate-700"><strong>Languages:</strong> {strategy.technology.languages.join(", ")}</p>
              )}
              {strategy.technology.frameworks && (
                <p className="text-sm text-slate-700"><strong>Frameworks:</strong> {strategy.technology.frameworks.join(", ")}</p>
              )}
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-bold text-slate-900 mb-2">Design & Patterns</p>
            {strategy.technology.patterns && (
              <p className="text-sm text-slate-700"><strong>Patterns:</strong> {strategy.technology.patterns.join(", ")}</p>
            )}
          </div>
        </div>
      )}

      {/* Architecture Overview */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="font-bold text-blue-900 mb-3">🏗️ Architecture Overview</p>
        <p className="text-sm text-blue-800 mb-4">{strategy.architecture.designOverview}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-blue-900 mb-2">Components to Create:</p>
            <ul className="space-y-1">
              {strategy.architecture.componentsToCreate.map((c, i) => <li key={i} className="text-xs text-blue-800">✓ {c}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold text-blue-900 mb-2">To Modify:</p>
            <ul className="space-y-1">
              {strategy.architecture.componentsToModify.map((c, i) => <li key={i} className="text-xs text-blue-800">• {c}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Development Phases */}
      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="font-bold text-yellow-900 mb-3">📅 Development Phases</p>
        <div className="space-y-2">
          {strategy.developmentPhases.map((p, i) => (
            <div key={i} className="p-2 bg-white rounded">
              <p className="text-sm font-bold text-yellow-900">{p.phase} ({p.duration})</p>
              <p className="text-xs text-yellow-800 mt-1">{p.deliverables.join(" → ")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team & Resources */}
      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <p className="font-bold text-purple-900 mb-3">👥 Team & Resources</p>
        <div className="space-y-2 text-sm text-purple-800">
          <p><strong>Team Size:</strong> {strategy.resources.teamSize} developers</p>
          <p><strong>Seniority Mix:</strong> {strategy.resources.seniority}</p>
          <p><strong>Timeline:</strong> {strategy.resources.estimatedDays} days</p>
          <p><strong>Budget:</strong> ${strategy.resources.estimatedCost}</p>
          {strategy.resources.dependencies.length > 0 && (
            <div className="pt-2 border-t border-purple-300">
              <p className="font-semibold">Dependencies:</p>
              <ul className="mt-1">
                {strategy.resources.dependencies.map((d, i) => <li key={i} className="text-xs">• {d}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Code Review Requirements */}
      <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
        <p className="font-bold text-indigo-900 mb-3">🔍 Code Review & Quality</p>
        <div className="space-y-2 text-sm text-indigo-800">
          <p><strong>Performance Target:</strong> {strategy.codeReview.performanceBenchmarks}</p>
          <p><strong>Critical Paths (Mandatory Review):</strong></p>
          <ul className="ml-4 space-y-1">
            {strategy.codeReview.criticalPaths.map((p, i) => <li key={i}>• {p}</li>)}
          </ul>
        </div>
      </div>

      {/* Risks & Mitigation */}
      <div className="space-y-2">
        {strategy.risks.map((r, i) => (
          <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="font-bold text-red-900 text-sm">{r.risk}</p>
            <p className="text-xs text-red-800 mt-1"><strong>Impact:</strong> {r.impact} | <strong>Mitigation:</strong> {r.mitigation}</p>
          </div>
        ))}
      </div>

      {/* Success Criteria */}
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <p className="font-bold text-green-900 mb-2">✅ Success Criteria</p>
        <ul className="space-y-1">
          {strategy.successCriteria.map((c, i) => <li key={i} className="text-sm text-green-800">✓ {c}</li>)}
        </ul>
      </div>
    </div>
  );
}
