"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface EstimationData {
  id: string;
  requirementId: string;
  title: string;
  complexityScore: number;
  paths: number;
  nodesCount: number;
  edgesCount: number;
  createdAt: string;
  qaManDays: number;
  devManDays: number;
  totalManDays: number;
  devTeamDays: number;
  qaTeamDays: number;
}

export default function EstimationHistory() {
  const [estimations, setEstimations] = useState<EstimationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  useEffect(() => {
    const fetchEstimations = async () => {
      try {
        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
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
          const estimatedData = data.map((req: any) => {
            const qaHoursPerScenario = getQAHoursPerScenario(req.complexityScore);
            const totalScenarios = 2 * (req.paths || 1);
            const totalQAHours = totalScenarios * qaHoursPerScenario;
            const qaManDays = totalQAHours / 8;

            const devManDays = getDevEstimation(
              req.complexityScore,
              req.nodesCount,
              req.edgesCount,
              req.paths || 1
            );

            const totalManDays = qaManDays + devManDays;
            const devTeamDays = Math.ceil(devManDays / 2);
            const qaTeamDays = Math.ceil(qaManDays / 1);

            return {
              id: req.id,
              title: req.title,
              complexityScore: req.complexityScore,
              paths: req.paths || 1,
              nodesCount: req.nodesCount,
              edgesCount: req.edgesCount,
              createdAt: req.createdAt,
              qaManDays,
              devManDays,
              totalManDays,
              devTeamDays,
              qaTeamDays,
            };
          });

          setEstimations(estimatedData);
        }
      } catch (err) {
        console.error("Error fetching estimations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEstimations();
  }, []);

  const getQAHoursPerScenario = (complexity: number): number => {
    if (complexity <= 5) return 2;
    if (complexity <= 15) return 2.5;
    if (complexity <= 30) return 3;
    return 4;
  };

  const getDevEstimation = (
    m: number,
    n: number,
    e: number,
    p: number
  ): number => {
    let baseManDays = 0;
    if (m <= 5) {
      baseManDays = 5;
    } else if (m <= 15) {
      baseManDays = 15;
    } else if (m <= 30) {
      baseManDays = 30;
    } else {
      baseManDays = 50;
    }
    const metricsAdjustment = n * 0.1 + e * 0.05 + p * 0.02;
    return baseManDays + metricsAdjustment;
  };

  const getComplexityColor = (complexity: number): string => {
    if (complexity <= 5) return "bg-green-50";
    if (complexity <= 15) return "bg-yellow-50";
    if (complexity <= 30) return "bg-orange-50";
    return "bg-red-50";
  };

  const getComplexityLevel = (complexity: number): string => {
    if (complexity <= 5) return "Low";
    if (complexity <= 15) return "Medium";
    if (complexity <= 30) return "High";
    return "Very High";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading estimations...</p>
      </div>
    );
  }

  const handleDelete = async (estimation: EstimationData) => {
    if (!confirm("Are you sure you want to delete this estimation? This action cannot be undone.")) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/analyses/${estimation.requirementId}`, {
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
        alert("Failed to delete estimation");
      }
    } catch (err) {
      alert("Error deleting estimation: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  if (estimations.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
        <p className="text-slate-600 mb-4">No records found</p>
        <p className="text-sm text-slate-500">
          Go to "Requirement Analysis" tab to create your first analysis
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">⏱️ Estimation History</h2>
        <p className="text-purple-100">
          QA and Development effort estimates for all analyzed requirements
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-200 font-semibold text-sm text-slate-700 sticky top-0">
          <div className="col-span-3">Requirement</div>
          <div className="col-span-1 text-center">Complexity</div>
          <div className="col-span-2 text-right">QA Man Days</div>
          <div className="col-span-2 text-right">Dev Man Days</div>
          <div className="col-span-2 text-right">Total Man Days</div>
          <div className="col-span-2 text-right">Timeline</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-slate-200">
          {estimations.map((est) => (
            <div
              key={est.id}
              className={`${getComplexityColor(est.complexityScore)} transition-colors hover:bg-opacity-80 cursor-pointer`}
              onClick={() => setSelectedRow(selectedRow === est.id ? null : est.id)}
            >
              {/* Main Row */}
              <div className="grid grid-cols-12 gap-4 p-4 items-center">
                <div className="col-span-3">
                  <p className="font-semibold text-slate-900 truncate">
                    {est.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(est.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="col-span-1 text-center">
                  <span className="inline-block px-2 py-1 bg-white rounded text-sm font-semibold text-slate-900">
                    {est.complexityScore}
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    {getComplexityLevel(est.complexityScore)}
                  </p>
                </div>

                <div className="col-span-2 text-right">
                  <p className="font-bold text-lg text-blue-600">
                    ~{Math.round(est.qaManDays)}
                  </p>
                  <p className="text-xs text-slate-600">man days</p>
                </div>

                <div className="col-span-2 text-right">
                  <p className="font-bold text-lg text-green-600">
                    ~{Math.round(est.devManDays)}
                  </p>
                  <p className="text-xs text-slate-600">man days</p>
                </div>

                <div className="col-span-2 text-right">
                  <p className="font-bold text-lg text-purple-600">
                    ~{Math.round(est.totalManDays)}
                  </p>
                  <p className="text-xs text-slate-600">man days</p>
                </div>

                <div className="col-span-2 text-right">
                  <p className="font-semibold text-slate-900">
                    ~{Math.max(est.devTeamDays, est.qaTeamDays)} days
                  </p>
                  <p className="text-xs text-slate-600">parallel execution</p>
                </div>
              </div>

              {/* Expanded Row - Details */}
              {selectedRow === est.id && (
                <div className="border-t border-slate-200 bg-white bg-opacity-50 p-4 space-y-4">
                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 bg-white rounded border border-slate-200">
                      <p className="text-xs text-slate-600 font-semibold">
                        Nodes (N)
                      </p>
                      <p className="text-2xl font-bold text-slate-900">
                        {est.nodesCount}
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded border border-slate-200">
                      <p className="text-xs text-slate-600 font-semibold">
                        Edges (E)
                      </p>
                      <p className="text-2xl font-bold text-slate-900">
                        {est.edgesCount}
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded border border-slate-200">
                      <p className="text-xs text-slate-600 font-semibold">
                        Paths (P)
                      </p>
                      <p className="text-2xl font-bold text-slate-900">
                        {est.paths}
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded border border-slate-200">
                      <p className="text-xs text-slate-600 font-semibold">
                        Scenarios (2P)
                      </p>
                      <p className="text-2xl font-bold text-slate-900">
                        {2 * est.paths}
                      </p>
                    </div>
                  </div>

                  {/* Team Breakdown */}
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                    <div className="p-3 bg-blue-50 rounded">
                      <p className="text-sm font-semibold text-blue-900 mb-2">
                        QA Team (1 engineer)
                      </p>
                      <p className="text-2xl font-bold text-blue-600">
                        {est.qaTeamDays}
                      </p>
                      <p className="text-xs text-blue-700">calendar days</p>
                      <p className="text-xs text-blue-600 mt-2">
                        (~{Math.round(est.qaManDays)} man days)
                      </p>
                    </div>

                    <div className="p-3 bg-green-50 rounded">
                      <p className="text-sm font-semibold text-green-900 mb-2">
                        Dev Team (2 developers)
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {est.devTeamDays}
                      </p>
                      <p className="text-xs text-green-700">calendar days</p>
                      <p className="text-xs text-green-600 mt-2">
                        (~{Math.round(est.devManDays)} man days)
                      </p>
                    </div>

                    <div className="p-3 bg-purple-50 rounded">
                      <p className="text-sm font-semibold text-purple-900 mb-2">
                        Parallel Timeline
                      </p>
                      <p className="text-2xl font-bold text-purple-600">
                        ~{Math.max(est.devTeamDays, est.qaTeamDays)}
                      </p>
                      <p className="text-xs text-purple-700">calendar days</p>
                      <p className="text-xs text-purple-600 mt-2">
                        (with team overlap)
                      </p>
                    </div>
                  </div>

                  {/* Formula */}
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 font-mono">
                    <p className="mb-2">
                      <strong>QA Calculation:</strong> 2P × hrs/scenario ÷ 8 =
                      {" "}
                      ~{Math.round(2 * est.paths * getQAHoursPerScenario(est.complexityScore) / 8)}{" "}
                      man days
                    </p>
                    <p>
                      <strong>Dev Calculation:</strong> Base({est.complexityScore <= 5 ? "5" : est.complexityScore <= 15 ? "15" : est.complexityScore <= 30 ? "30" : "50"}) + (N×0.1 + E×0.05 + P×0.02) ={" "}
                      ~{Math.round(est.devManDays)} man days
                    </p>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(est);
                    }}
                    className="w-full px-4 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors border border-red-200 font-medium"
                  >
                    🗑️ Delete This Estimation
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-xs text-blue-600 font-semibold uppercase">
            Total QA Days
          </p>
          <p className="text-3xl font-bold text-blue-900 mt-2">
            ~{Math.round(estimations.reduce((sum, e) => sum + e.qaManDays, 0))}
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-xs text-green-600 font-semibold uppercase">
            Total Dev Days
          </p>
          <p className="text-3xl font-bold text-green-900 mt-2">
            ~{Math.round(estimations.reduce((sum, e) => sum + e.devManDays, 0))}
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <p className="text-xs text-purple-600 font-semibold uppercase">
            Total Man Days
          </p>
          <p className="text-3xl font-bold text-purple-900 mt-2">
            ~{Math.round(estimations.reduce((sum, e) => sum + e.totalManDays, 0))}
          </p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <p className="text-xs text-orange-600 font-semibold uppercase">
            Avg Timeline
          </p>
          <p className="text-3xl font-bold text-orange-900 mt-2">
            {(
              estimations.reduce((sum, e) => sum + Math.max(e.devTeamDays, e.qaTeamDays), 0) /
              estimations.length
            ).toFixed(0)}
            {" "}
            days
          </p>
        </div>
      </div>
    </div>
  );
}
