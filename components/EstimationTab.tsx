"use client";

import { useEffect, useState } from "react";
import { estimationHints, type EstimationHints } from "@/lib/architecture-estimation-hints";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/lib/supabase";
import { EstimationQuestionsForm } from "./EstimationQuestionsForm";
import { EstimationReport } from "./EstimationReport";

interface EstimationTabProps {
  requirementId: string;
  complexityScore: number;
  paths?: number;
  testScenarios?: number;
  onEstimationComplete?: (estimation: any) => void;
  onViewHistory?: () => void;
  onOpenArchitecture?: () => void;
}

export function EstimationTab({
  requirementId,
  complexityScore,
  paths,
  testScenarios,
  onEstimationComplete,
  onViewHistory,
  onOpenArchitecture,
}: EstimationTabProps) {
  const [showForm, setShowForm] = useState(false);
  // The estimation is made on the approved architecture of this requirement
  const [architecture, setArchitecture] = useState<EstimationHints | null>(null);
  const [archState, setArchState] = useState<"loading" | "ready" | "missing" | "no-hours" | "error">("loading");
  const [approvedVersion, setApprovedVersion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArchState("loading");
    authFetch(`/api/architecture?requirementId=${encodeURIComponent(requirementId)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "failed");
        if (cancelled) return;
        if (!data.approved) {
          setArchitecture(null);
          setArchState("missing");
          return;
        }
        setApprovedVersion(data.approved.version);
        if (!data.approved.effort?.tasks?.length) {
          setArchitecture(null);
          setArchState("no-hours");
          return;
        }
        setArchitecture(estimationHints(data.approved.version, data.approved.design, data.approved.answers || [], data.approved.effort));
        setArchState("ready");
      })
      .catch(() => {
        if (!cancelled) setArchState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [requirementId]);
  const [estimation, setEstimation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerateEstimation = async (answers: Record<string, any>) => {
    setLoading(true);
    setError("");

    try {
      // Get token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !session.access_token) {
        throw new Error("Please sign in to generate estimation");
      }

      const response = await authFetch("/api/generate-estimation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requirementId,
          complexityScore,
          paths,
          testScenarios,
          estimationAnswers: answers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate estimation");
      }

      setEstimation(data.estimation);
      setShowForm(false);

      // Notify parent component
      if (onEstimationComplete) {
        onEstimationComplete(data.estimation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Estimation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEstimation(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Generating estimation...</p>
        </div>
      </div>
    );
  }

  if (error && !estimation) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">❌ {error}</p>
        </div>
        <button
          onClick={() => {
            setError("");
            setShowForm(false);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Start Over
        </button>
      </div>
    );
  }

  if (archState === "loading") {
    return <div className="p-6 text-gray-600">Checking the approved architecture…</div>;
  }

  if (archState !== "ready") {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {archState === "no-hours" ? "⏱ Estimate the architecture's hours first" : "🏗️ Approve an architecture first"}
          </h2>
          <p className="text-gray-700 mb-4">
            {archState === "error"
              ? "The architecture of this requirement could not be checked. Please try again."
              : archState === "no-hours"
                ? `Architecture v${approvedVersion} is approved, but its build hours are not estimated yet. On the Architecture tab, click "Estimate hours from this architecture", review or edit the hours, then come back.`
                : "Estimations are made on an approved technical architecture and its estimated build hours, so every development hour traces to a task of a component and the process steps it delivers. Answer the architecture questions, review the design and approve it."}
          </p>
          {onOpenArchitecture && (
            <button onClick={onOpenArchitecture} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
              Go to Architecture →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (estimation) {
    return (
      <div className="p-6">
        <EstimationReport
          estimation={estimation}
          onReset={handleReset}
          savedToHistory
          onViewHistory={onViewHistory}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            📊 Generate Project Estimation
          </h2>
          <p className="text-gray-600 mb-2">
            Create a detailed project estimation based on the complexity score of{" "}
            <span className="font-bold text-blue-600">{complexityScore}</span>.
          </p>
          {architecture && (
            <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2 mb-3">
              ✅ Based on approved architecture v{architecture.version}: {architecture.componentCount} components,{" "}
              {Math.round(architecture.likely)} h likely build hours ({Math.round(architecture.low)}–{Math.round(architecture.high)} h) before
              team seniority and technology familiarity.
            </p>
          )}
          <p className="text-gray-600 mb-6">
            Answer questions in three steps: the project, the team you have
            (which developers, how many, how senior) and how you will test.
            Every hour in the result comes from those answers.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-blue-600 mb-1">💼</div>
              <div className="font-semibold text-gray-900">Team Resources</div>
              <div className="text-sm text-gray-600">
                Define your team size and skills
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-green-600 mb-1">⏱️</div>
              <div className="font-semibold text-gray-900">Timeline</div>
              <div className="text-sm text-gray-600">
                Get realistic project duration
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-2xl font-bold text-purple-600 mb-1">💰</div>
              <div className="font-semibold text-gray-900">Budget</div>
              <div className="text-sm text-gray-600">
                Calculate total project cost
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
          >
            🚀 Start Estimation (3 steps)
          </button>
        </div>
      </div>

      {showForm && (
        <EstimationQuestionsForm
          complexityScore={complexityScore}
          testScenarios={testScenarios || (paths ? paths * 2 : undefined)}
          architecture={architecture || undefined}
          onSubmit={handleGenerateEstimation}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
