"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/lib/supabase";
import { downloadTestScenariosExcel } from "@/lib/export-test-scenarios";

import type { PathScenario, ScenarioCoverage } from "@/lib/path-scenarios";

type Scenario = PathScenario;

interface ScenariosExtractionProps {
  requirementId: string;
  requirementText: string;
  requirementTitle: string;
  complexity: {
    n: number;
    e: number;
    p: number;
    complexityScore: number;
  };
  onClose: () => void;
  onScenariosExtracted?: (scenarios: Scenario[]) => void;
}

export default function ScenariosExtraction({
  requirementId,
  requirementText,
  requirementTitle,
  complexity,
  onClose,
  onScenariosExtracted,
}: ScenariosExtractionProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [coverage, setCoverage] = useState<ScenarioCoverage | null>(null);
  const [pathCountNote, setPathCountNote] = useState<string | null>(null);

  const downloadExcel = async () => {
    setDownloading(true);
    setError("");
    try {
      await downloadTestScenariosExcel({ scenarios, requirementTitle, requirementText, complexity });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const extractScenarios = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/extract-scenarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Scenarios are built from this analysis' stored paths (2 per path)
        body: JSON.stringify({ requirementId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract scenarios");
      }

      const data = await response.json();
      setScenarios(data.scenarios);
      setCoverage(data.coverage || null);
      setPathCountNote(data.pathCountNote || null);
      if (onScenariosExtracted) {
        onScenariosExtracted(data.scenarios);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract scenarios");
      console.error("Extraction error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getComplexityColor = (
    complexity: "Low" | "Medium" | "High" | "Very High"
  ) => {
    switch (complexity) {
      case "Low":
        return "bg-green-50 border-green-200 text-green-900";
      case "Medium":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "High":
        return "bg-orange-50 border-orange-200 text-orange-900";
      case "Very High":
        return "bg-red-50 border-red-200 text-red-900";
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Complexity Metrics */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-3">📊 Complexity Metrics</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-blue-600">Nodes (N)</p>
            <p className="font-bold text-lg text-blue-900">{complexity.n}</p>
          </div>
          <div>
            <p className="text-blue-600">Edges (E)</p>
            <p className="font-bold text-lg text-blue-900">{complexity.e}</p>
          </div>
          <div>
            <p className="text-blue-600">Paths (P)</p>
            <p className="font-bold text-lg text-blue-900">{complexity.p}</p>
          </div>
          <div>
            <p className="text-blue-600">Score (M)</p>
            <p className="font-bold text-lg text-blue-900">
              {complexity.complexityScore}
            </p>
          </div>
        </div>
        <p className="text-xs text-blue-700 mt-3 font-mono">
          M = E - N + 2P = {complexity.e} - {complexity.n} + 2({complexity.p}) ={" "}
          {complexity.complexityScore}
        </p>
      </div>


      {/* Section 2: Total Test Scenarios */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-3">🧪 Estimated Test Scenarios</h3>
        <div className="mb-3">
          <p className="text-green-600 text-sm mb-1">Estimated Scenarios (2P):</p>
          <p className="font-bold text-3xl text-green-700">{2 * complexity.p}</p>
        </div>
        <p className="text-xs text-green-700 font-mono mb-2">
          2P = 2 × {complexity.p} paths = {2 * complexity.p} scenarios
        </p>
        <div className="text-xs text-green-700 bg-white bg-opacity-60 rounded p-2 mt-2 space-y-1">
          <p><strong>Breakdown:</strong></p>
          <p>• {complexity.p} positive paths (success scenarios)</p>
          <p>• {complexity.p} negative paths (error/alternative scenarios)</p>
          <p>= {2 * complexity.p} estimated test scenarios for complete coverage</p>
        </div>
      </div>

      {/* Extract Button */}
      {scenarios.length === 0 && (
        <button
          onClick={extractScenarios}
          disabled={loading}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 font-semibold transition-colors"
        >
          {loading
            ? "Extracting Scenarios..."
            : `Build ${2 * complexity.p} Test Scenarios from the ${complexity.p} Paths (Positive + Negative)`}
        </button>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}


      {/* Done Button - Blue to indicate extraction complete */}
      {scenarios.length > 0 && (
        <div className="space-y-3">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="text-sm text-blue-900">
              ✓ <strong>{scenarios.length} scenarios built from {coverage?.paths ?? complexity.p} paths</strong>{" "}
              — one positive (P1+) and one negative (P1−) per path.
            </p>
            {coverage && (
              <p className={`text-xs ${coverage.ok ? "text-green-700" : "text-amber-800"}`}>
                {coverage.ok
                  ? `Coverage check passed: ${coverage.scenarios} = 2P, every path has both scenarios, and every branch of the graph is tested.`
                  : [
                      coverage.scenarios !== coverage.expected ? `${coverage.scenarios} scenarios vs 2P = ${coverage.expected}.` : "",
                      coverage.pathsMissing.length ? `Missing scenarios for ${coverage.pathsMissing.join(", ")}.` : "",
                      coverage.branchesUntested.length
                        ? `${coverage.branchesUntested.length} branch(es) of the graph are on no listed path, so no scenario tests them: ${coverage.branchesUntested.slice(0, 4).join("; ")}${coverage.branchesUntested.length > 4 ? "; …" : ""}.`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
              </p>
            )}
            {pathCountNote && <p className="text-xs text-amber-800">{pathCountNote}</p>}
          </div>
          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg divide-y">
            {scenarios.map((s) => (
              <details key={s.id} className="p-2 text-sm">
                <summary className="cursor-pointer">
                  <strong>{s.id}</strong> {s.name.replace(/^P\d+[+-]\s*/, "")}{" "}
                  <span className="text-xs text-slate-500">({s.complexity})</span>
                </summary>
                <p className="text-xs text-slate-600 mt-1">
                  <strong>Decision outcomes:</strong> {s.decisionOutcomes.join("; ") || "none"}
                </p>
                <ol className="list-decimal pl-5 text-xs text-slate-700 mt-1">
                  {s.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
                <p className="text-xs text-slate-700 mt-1"><strong>Expected:</strong> {s.expectedResult}</p>
              </details>
            ))}
          </div>
          <button
            onClick={downloadExcel}
            disabled={downloading}
            className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 font-semibold transition-colors"
          >
            {downloading ? "Preparing Excel..." : "📥 Download Test Scenarios (Excel)"}
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          >
            ✓ Done - Return to Analysis
          </button>
        </div>
      )}
    </div>
  );
}
