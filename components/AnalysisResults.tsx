"use client";

import { useState, useEffect } from "react";
import ScenariosExtraction from "./ScenariosExtraction";

interface Result {
  complexityScore: number;
  testScenarios: number;
  nodesCount: number;
  edgesCount: number;
  connectedComponents?: number;
  paths?: number;
  calculation?: string;
  analysis: string;
}

export default function AnalysisResults() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScenarios, setShowScenarios] = useState(false);
  const [requirementText, setRequirementText] = useState("");
  const [requirementTitle, setRequirementTitle] = useState("");

  useEffect(() => {
    const fetchLatestResult = async () => {
      try {
        setLoading(true);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching results:", err);
        setLoading(false);
      }
    };

    fetchLatestResult();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Latest Result</h2>
        <div className="text-center py-12 text-slate-500">
          No analysis results yet
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm sticky top-8 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Quick Start</h2>

        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="text-sm font-bold text-blue-600">1</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Enter Requirement</p>
              <p className="text-xs text-slate-600">Paste, upload (.txt), or web link</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-sm font-bold text-blue-600">2</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Refine with Questions</p>
              <p className="text-xs text-slate-600">Answer AI-generated clarifications</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-sm font-bold text-blue-600">3</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Get Results</p>
              <p className="text-xs text-slate-600">Complexity score, scenarios, metrics</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-sm font-bold text-blue-600">4</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">View Plan</p>
              <p className="text-xs text-slate-600">User stories, timeline, Gantt chart</p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2">You'll Get:</p>
          <ul className="text-xs text-slate-600 space-y-1">
            <li>✓ Complexity Score (M)</li>
            <li>✓ Test Scenarios (2P)</li>
            <li>✓ QA & Dev Estimation</li>
            <li>✓ User Stories</li>
            <li>✓ Project Timeline</li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <p className="text-xs text-blue-900">
            💡 Tip: See full details in the About tab
          </p>
        </div>
      </div>
    );
  }

  if (showScenarios) {
    return (
      <ScenariosExtraction
        requirementId="current"
        requirementText={requirementText}
        requirementTitle={requirementTitle}
        complexity={{
          n: result.nodesCount,
          e: result.edgesCount,
          p: result.alternativePaths || result.connectedComponents || 1,
          complexityScore: result.complexityScore,
        }}
        onClose={() => setShowScenarios(false)}
      />
    );
  }

  const complexityLevel =
    result.complexityScore <= 5
      ? "Low"
      : result.complexityScore <= 15
        ? "Medium"
        : result.complexityScore <= 30
          ? "High"
          : "Very High";

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm sticky top-8">
      <h2 className="text-lg font-bold text-slate-900 mb-6">Latest Result</h2>

      <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <p className="text-sm text-slate-600 mb-1">Complexity Level</p>
        <div className="text-3xl font-bold text-blue-600">
          {result.complexityScore}
        </div>
        <p className="text-sm text-slate-600 mt-2">
          <span className="font-semibold">{complexityLevel}</span> Complexity
        </p>
      </div>

      <div className="mb-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
        <p className="text-sm text-slate-600 mb-1">Test Scenarios Needed</p>
        <div className="text-3xl font-bold text-green-600">
          {result.testScenarios}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Independent test paths to cover
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
          <span className="text-sm text-slate-600">Nodes (N)</span>
          <span className="font-semibold text-slate-900">
            {result.nodesCount}
          </span>
        </div>
        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
          <span className="text-sm text-slate-600">Edges (E)</span>
          <span className="font-semibold text-slate-900">
            {result.edgesCount}
          </span>
        </div>
        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
          <span className="text-sm text-slate-600">Distinct Paths (P)</span>
          <span className="font-semibold text-slate-900">
            {result.paths || result.connectedComponents || 1}
          </span>
        </div>
      </div>

      {result.calculation && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-6">
          <p className="text-xs font-mono text-blue-900">
            <strong>Formula:</strong> {result.calculation}
          </p>
        </div>
      )}

      <button
        onClick={() => setShowScenarios(true)}
        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors mb-4"
      >
        Extract Scenarios & Download Excel
      </button>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          💡 Tip: Use complexity score to justify test scenarios
        </p>
      </div>
    </div>
  );
}
