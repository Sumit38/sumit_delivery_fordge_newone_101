"use client";

import { useState } from "react";
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
}

export function EstimationTab({
  requirementId,
  complexityScore,
  paths,
  testScenarios,
  onEstimationComplete,
  onViewHistory,
}: EstimationTabProps) {
  const [showForm, setShowForm] = useState(false);
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
          onSubmit={handleGenerateEstimation}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
