"use client";

import { useState } from "react";

interface ComplexityData {
  nodesCount: number;
  edgesCount: number;
  pathsCount: number;
  complexityScore: number;
  components?: string[];
  estimatedDays: number;
  keyComplexities?: string[];
  testTypes?: string[];
  edgeCases?: string[];
  automationRatio?: string;
}

interface Analysis {
  development: ComplexityData;
  testing: ComplexityData;
  operations: {
    deploymentComplexity: string;
    infrastructureChanges: string[];
    monitoringNeeds: string[];
    estimatedDays: number;
  };
  riskFactors: {
    high: string[];
    medium: string[];
    low: string[];
  };
}

interface Props {
  requirementText: string;
  requirementType: string;
  onAnalysisComplete?: (analysis: Analysis) => void;
}

export default function DualComplexityAnalysis({ requirementText, requirementType, onAnalysisComplete }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyze = async () => {
    if (!requirementText.trim()) {
      setError("Please enter a requirement");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/dual-complexity-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementText, requirementType }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      if (onAnalysisComplete) {
        onAnalysisComplete(data.analysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const getComplexityColor = (score: number) => {
    if (score <= 10) return "bg-green-50 border-green-200 text-green-900";
    if (score <= 20) return "bg-yellow-50 border-yellow-200 text-yellow-900";
    if (score <= 30) return "bg-orange-50 border-orange-200 text-orange-900";
    return "bg-red-50 border-red-200 text-red-900";
  };

  const getComplexityLevel = (score: number) => {
    if (score <= 10) return "Low";
    if (score <= 20) return "Medium";
    if (score <= 30) return "High";
    return "Very High";
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Analyzing complexity...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">❌ {error}</p>
        <button
          onClick={analyze}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <button
        onClick={analyze}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
      >
        📊 Run Dual Complexity Analysis
      </button>
    );
  }

  return (
    <div className="space-y-8">
      {/* Complexity Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Development Complexity */}
        <div className={`p-6 rounded-lg border ${getComplexityColor(analysis.development.complexityScore)}`}>
          <h3 className="font-bold text-lg mb-4">💻 Development Complexity</h3>
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-4xl font-bold">{analysis.development.complexityScore}</div>
              <p className="text-sm opacity-75 mt-1">{getComplexityLevel(analysis.development.complexityScore)}</p>
            </div>
            <div className="pt-3 border-t border-current border-opacity-30 space-y-2 text-sm">
              <p>Nodes (N): <strong>{analysis.development.nodesCount}</strong></p>
              <p>Edges (E): <strong>{analysis.development.edgesCount}</strong></p>
              <p>Paths (P): <strong>{analysis.development.pathsCount}</strong></p>
              <p className="pt-2 border-t border-current border-opacity-30">
                Estimated: <strong>{analysis.development.estimatedDays} days</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Testing Complexity */}
        <div className={`p-6 rounded-lg border ${getComplexityColor(analysis.testing.complexityScore)}`}>
          <h3 className="font-bold text-lg mb-4">🧪 Testing Complexity</h3>
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-4xl font-bold">{analysis.testing.complexityScore}</div>
              <p className="text-sm opacity-75 mt-1">{getComplexityLevel(analysis.testing.complexityScore)}</p>
            </div>
            <div className="pt-3 border-t border-current border-opacity-30 space-y-2 text-sm">
              <p>Nodes (N): <strong>{analysis.testing.nodesCount}</strong></p>
              <p>Edges (E): <strong>{analysis.testing.edgesCount}</strong></p>
              <p>Paths (P): <strong>{analysis.testing.pathsCount}</strong></p>
              <p className="pt-2 border-t border-current border-opacity-30">
                Estimated: <strong>{analysis.testing.estimatedDays} days</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Operations Complexity */}
        <div className="p-6 bg-purple-50 rounded-lg border border-purple-200 text-purple-900">
          <h3 className="font-bold text-lg mb-4">⚙️ Operations Complexity</h3>
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-3xl font-bold">{analysis.operations.deploymentComplexity}</div>
              <p className="text-sm opacity-75 mt-1">Deployment</p>
            </div>
            <div className="pt-3 border-t border-current border-opacity-30 space-y-2 text-sm">
              <p><strong>{analysis.operations.estimatedDays} days</strong> for DevOps</p>
              <p className="pt-2 border-t border-current border-opacity-30">
                Infrastructure & Monitoring setup
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <h3 className="font-bold text-lg text-blue-900 mb-4">📋 Project Totals</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {analysis.development.estimatedDays + analysis.testing.estimatedDays + analysis.operations.estimatedDays}
            </p>
            <p className="text-xs text-slate-600 mt-1">Total Man-Days</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {Math.ceil((analysis.development.estimatedDays + analysis.testing.estimatedDays + analysis.operations.estimatedDays) / 5)}
            </p>
            <p className="text-xs text-slate-600 mt-1">Calendar Weeks</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {analysis.development.complexityScore + analysis.testing.complexityScore}
            </p>
            <p className="text-xs text-slate-600 mt-1">Combined Complexity</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {analysis.riskFactors.high.length + analysis.riskFactors.medium.length}
            </p>
            <p className="text-xs text-slate-600 mt-1">Identified Risks</p>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-slate-900">⚠️ Risk Assessment</h3>

        {analysis.riskFactors.high.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="font-bold text-red-900 mb-2">🔴 High Risk</p>
            <ul className="space-y-1">
              {analysis.riskFactors.high.map((risk, i) => (
                <li key={i} className="text-sm text-red-800">• {risk}</li>
              ))}
            </ul>
          </div>
        )}

        {analysis.riskFactors.medium.length > 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="font-bold text-yellow-900 mb-2">🟡 Medium Risk</p>
            <ul className="space-y-1">
              {analysis.riskFactors.medium.map((risk, i) => (
                <li key={i} className="text-sm text-yellow-800">• {risk}</li>
              ))}
            </ul>
          </div>
        )}

        {analysis.riskFactors.low.length > 0 && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="font-bold text-green-900 mb-2">🟢 Low Risk</p>
            <ul className="space-y-1">
              {analysis.riskFactors.low.map((risk, i) => (
                <li key={i} className="text-sm text-green-800">• {risk}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Development Key Complexities */}
      {analysis.development.keyComplexities && analysis.development.keyComplexities.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="font-bold text-blue-900 mb-3">💻 Development Key Complexities</p>
          <ul className="space-y-1">
            {analysis.development.keyComplexities.map((item, i) => (
              <li key={i} className="text-sm text-blue-800">• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Infrastructure Changes */}
      {analysis.operations.infrastructureChanges.length > 0 && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="font-bold text-purple-900 mb-3">⚙️ Infrastructure Changes Needed</p>
          <ul className="space-y-1">
            {analysis.operations.infrastructureChanges.map((item, i) => (
              <li key={i} className="text-sm text-purple-800">• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Monitoring Needs */}
      {analysis.operations.monitoringNeeds.length > 0 && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="font-bold text-indigo-900 mb-3">📊 Monitoring & Alerting Needs</p>
          <ul className="space-y-1">
            {analysis.operations.monitoringNeeds.map((item, i) => (
              <li key={i} className="text-sm text-indigo-800">• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
