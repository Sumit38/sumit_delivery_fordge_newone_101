"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ScenariosExtraction from "./ScenariosExtraction";
import { exportUserStoriesToExcel } from "@/lib/export-user-stories";

interface Analysis {
  id: string;
  requirementId: string;
  title: string;
  complexityScore: number;
  testScenarios: number;
  nodesCount: number;
  edgesCount: number;
  paths?: number;
  createdAt: string;
  requirementText?: string;
  qaManDays?: number;
  devManDays?: number;
}

interface AnalysisHistoryProps {
  onAnalysisSelect?: (analysis: {
    id: string;
    title: string;
    requirementText: string;
    complexityScore: number;
    complexityLevel: string;
    qaManDays: number;
    devManDays: number;
    nodesCount?: number;
    edgesCount?: number;
    paths?: number;
    testScenarios?: number;
  }) => void;
  onAnalysisDelete?: (deletedId: string) => void;
}

export default function AnalysisHistory({ onAnalysisSelect, onAnalysisDelete }: AnalysisHistoryProps) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(
    null
  );
  const [showScenarios, setShowScenarios] = useState(false);
  const [scenarios, setScenarios] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setLoading(true);

        // Get session for auth
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.error("Not authenticated");
          setLoading(false);
          return;
        }

        const response = await fetch("/api/analyses", {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAnalyses(data);
        }
      } catch (err) {
        console.error("Error fetching analyses:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, []);

  const getComplexityColor = (complexity: number) => {
    if (complexity <= 5) return "bg-green-50 border-green-200";
    if (complexity <= 15) return "bg-yellow-50 border-yellow-200";
    if (complexity <= 30) return "bg-orange-50 border-orange-200";
    return "bg-red-50 border-red-200";
  };

  const getComplexityLevel = (complexity: number) => {
    if (complexity <= 5) return "Low";
    if (complexity <= 15) return "Medium";
    if (complexity <= 30) return "High";
    return "Very High";
  };

  const calculateComplexityDistribution = () => {
    const p = selectedAnalysis?.paths || 1;
    const totalScenarios = 2 * p;

    if (scenarios.length === 0) {
      // Before extraction, distribute 2P across complexity levels proportionally
      // Assume: 20% Low, 35% Medium, 30% High, 15% Very High
      const proportions = {
        low: Math.round(totalScenarios * 0.20),
        medium: Math.round(totalScenarios * 0.35),
        high: Math.round(totalScenarios * 0.30),
        veryHigh: Math.round(totalScenarios * 0.15),
      };

      return {
        low: proportions.low,
        medium: proportions.medium,
        high: proportions.high,
        veryHigh: proportions.veryHigh,
        total: totalScenarios,
        extracted: false,
        message: "Estimated distribution (before extraction)",
      };
    }

    const distribution = {
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0,
    };

    scenarios.forEach((s: any) => {
      const complexity = s.complexity?.toLowerCase() || "medium";
      if (complexity === "low") distribution.low++;
      else if (complexity === "medium") distribution.medium++;
      else if (complexity === "high") distribution.high++;
      else if (complexity === "very high" || complexity === "veryhigh")
        distribution.veryHigh++;
    });

    // Each scenario represents 2 paths (positive + negative)
    return {
      low: distribution.low * 2,
      medium: distribution.medium * 2,
      high: distribution.high * 2,
      veryHigh: distribution.veryHigh * 2,
      total: totalScenarios,
      extracted: true,
      message: "Actual distribution (from extracted scenarios)",
    };
  };

  const downloadExcel = async () => {
    if (!selectedAnalysis || scenarios.length === 0) {
      alert("Please extract scenarios first");
      return;
    }

    try {
      const response = await fetch("/api/export-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarios,
          requirementTitle: selectedAnalysis.title,
          requirementText: selectedAnalysis.requirementText,
          complexity: {
            n: selectedAnalysis.nodesCount,
            e: selectedAnalysis.edgesCount,
            p: selectedAnalysis.paths || 1,
            complexityScore: selectedAnalysis.complexityScore,
          },
        }),
      });

      if (!response.ok) throw new Error("Download failed");

      const contentDisposition = response.headers.get("content-disposition");
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1].replace(/"/g, "")
        : "complexity-analysis.csv";

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Download failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading analyses...</p>
      </div>
    );
  }

  const handleDelete = async (analysis: Analysis) => {
    if (!confirm("Are you sure you want to delete this analysis? This action cannot be undone.")) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/analyses/${analysis.requirementId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        // Refresh page to sync with latest data
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        alert("Failed to delete analysis");
      }
    } catch (err) {
      alert("Error deleting analysis: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  if (analyses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">No records found</p>
        <p className="text-sm text-slate-500">
          Go to "Requirement Analysis" tab to create your first analysis
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* List */}
      <div className="lg:col-span-2">
        <div className="space-y-3">
          {analyses.map((analysis) => (
            <div
              key={analysis.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedAnalysis?.id === analysis.id
                  ? "border-blue-500 bg-blue-50"
                  : `border-slate-200 ${getComplexityColor(analysis.complexityScore)} hover:border-slate-300`
              }`}
            >
              <button
                onClick={() => {
                  setSelectedAnalysis(analysis);
                  if (onAnalysisSelect) {
                    const complexityLevel =
                      analysis.complexityScore <= 5
                        ? "Low"
                        : analysis.complexityScore <= 15
                          ? "Medium"
                          : analysis.complexityScore <= 30
                            ? "High"
                            : "Very High";
                    onAnalysisSelect({
                      id: analysis.id,
                      title: analysis.title,
                      requirementText: analysis.requirementText || "",
                      complexityScore: analysis.complexityScore,
                      complexityLevel,
                      qaManDays: analysis.qaManDays || (analysis.complexityScore * 0.5),
                      devManDays: analysis.devManDays || (analysis.complexityScore * 0.8),
                      nodesCount: analysis.nodesCount,
                      edgesCount: analysis.edgesCount,
                      paths: analysis.paths,
                      testScenarios: analysis.testScenarios,
                    });
                  }
                }}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">
                      {analysis.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(analysis.createdAt).toLocaleDateString()} at{" "}
                      {new Date(analysis.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-slate-900">
                      {analysis.complexityScore}
                    </div>
                    <p className="text-xs text-slate-600">
                      {getComplexityLevel(analysis.complexityScore)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-sm flex-wrap">
                  <span className="text-slate-600">
                    <strong>{analysis.nodesCount}</strong> nodes
                  </span>
                  <span className="text-slate-600">
                    <strong>{analysis.edgesCount}</strong> edges
                  </span>
                  <span className="text-slate-600">
                    <strong>{analysis.paths || 1}</strong> paths
                  </span>
                </div>
              </button>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                      await exportUserStoriesToExcel(analysis.id, analysis.title, session.access_token);
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors border border-blue-200 font-medium"
                >
                  📥 Export Stories
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(analysis);
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors border border-red-200 font-medium"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Details Panel */}
      {selectedAnalysis && !showScenarios && (
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm sticky top-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Details</h2>
                  {/* Extract Scenarios Button */}
                  <button
                    onClick={() => setShowScenarios(true)}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors mb-4"
                  >
                    📋 Extract Scenarios & Download Excel
                  </button>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">
                        Title
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedAnalysis.title}
                      </p>
                    </div>

                    {/* Section 1: Complexity Score */}
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-slate-600 mb-1">📊 Estimated Complexity Score (M)</p>
                      <div className="text-3xl font-bold text-blue-600">
                        {selectedAnalysis.complexityScore}
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        Formula: M = E - N + 2P
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {getComplexityLevel(selectedAnalysis.complexityScore)} Complexity
                      </p>
                    </div>

                    {/* Section 2: Test Scenarios */}
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <p className="text-xs text-slate-600 mb-1">🧪 Estimated Test Scenarios</p>
                      <div className="text-3xl font-bold text-green-600">
                        {2 * (selectedAnalysis.paths || 1)}
                      </div>
                      <p className="text-xs text-slate-600 mt-2 font-mono">
                        Estimated Scenarios = 2P = 2 × {selectedAnalysis.paths || 1}
                      </p>
                      <p className="text-xs text-slate-600 mt-2 bg-white bg-opacity-60 rounded p-2">
                        Each path requires 2 scenarios: positive + negative (distinct)
                      </p>
                    </div>

                    {/* Section 3: Scenario Bifurcation by Complexity Level */}
                    {(() => {
                      const distribution = calculateComplexityDistribution();
                      return (
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                          <p className="text-xs text-slate-600 mb-3">📊 Scenario Bifurcation by Complexity</p>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {/* Low Complexity */}
                            <div className="bg-white rounded p-3 border-l-4 border-green-500">
                              <p className="text-xs text-green-600 font-semibold">Low</p>
                              <p className="text-lg font-bold text-green-700">{distribution.low}</p>
                              <p className="text-xs text-green-600">scenarios</p>
                            </div>
                            {/* Medium Complexity */}
                            <div className="bg-white rounded p-3 border-l-4 border-yellow-500">
                              <p className="text-xs text-yellow-600 font-semibold">Medium</p>
                              <p className="text-lg font-bold text-yellow-700">{distribution.medium}</p>
                              <p className="text-xs text-yellow-600">scenarios</p>
                            </div>
                            {/* High Complexity */}
                            <div className="bg-white rounded p-3 border-l-4 border-orange-500">
                              <p className="text-xs text-orange-600 font-semibold">High</p>
                              <p className="text-lg font-bold text-orange-700">{distribution.high}</p>
                              <p className="text-xs text-orange-600">scenarios</p>
                            </div>
                            {/* Very High Complexity */}
                            <div className="bg-white rounded p-3 border-l-4 border-red-500">
                              <p className="text-xs text-red-600 font-semibold">Very High</p>
                              <p className="text-lg font-bold text-red-700">{distribution.veryHigh}</p>
                              <p className="text-xs text-red-600">scenarios</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 bg-white bg-opacity-60 rounded p-2 mb-3">
                            <strong>Total 2P = {distribution.total} scenarios:</strong> {distribution.low} Low + {distribution.medium} Medium + {distribution.high} High + {distribution.veryHigh} Very High
                          </p>
                          {!distribution.extracted && (
                            <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 mb-3">
                              💡 {distribution.message} - Click "Extract Scenarios" to see actual distribution
                            </p>
                          )}
                          {distribution.extracted && (
                            <p className="text-xs text-green-600 bg-green-50 rounded p-2 mb-3">
                              ✅ {distribution.message} - {scenarios.length} scenarios analyzed
                            </p>
                          )}
                          {/* Download Excel Button */}
                          <button
                            onClick={downloadExcel}
                            disabled={scenarios.length === 0}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 font-semibold text-sm transition-colors"
                          >
                            📥 Download Excel
                          </button>
                        </div>
                      );
                    })()}

                    <div className="space-y-2">
                      <div className="flex justify-between p-2 bg-slate-50 rounded text-sm">
                        <span className="text-slate-600">Nodes (N)</span>
                        <span className="font-semibold">
                          {selectedAnalysis.nodesCount}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded text-sm">
                        <span className="text-slate-600">Edges (E)</span>
                        <span className="font-semibold">
                          {selectedAnalysis.edgesCount}
                        </span>
                      </div>
                      <div className="flex justify-between p-2 bg-slate-50 rounded text-sm">
                        <span className="text-slate-600">Paths (P)</span>
                        <span className="font-semibold">
                          {selectedAnalysis.paths || 1}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      Created:{" "}
                      {new Date(selectedAnalysis.createdAt).toLocaleDateString()}
                    </div>
            </div>
          </div>
        </div>
      )}

      {/* Scenarios Extraction */}
      {selectedAnalysis && showScenarios && (
        <div className="lg:col-span-1">
          <ScenariosExtraction
            requirementId={selectedAnalysis.id}
            requirementText={selectedAnalysis.requirementText || ""}
            requirementTitle={selectedAnalysis.title}
            complexity={{
              n: selectedAnalysis.nodesCount,
              e: selectedAnalysis.edgesCount,
              p: selectedAnalysis.paths || 1,
              complexityScore: selectedAnalysis.complexityScore,
            }}
            onClose={() => setShowScenarios(false)}
            onScenariosExtracted={setScenarios}
          />
        </div>
      )}
    </div>
  );
}
