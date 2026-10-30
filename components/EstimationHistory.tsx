"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDuration, getProposedManDays } from "@/lib/estimation-calculator";
import InfoTip from "./InfoTip";
import { calculationNotes } from "@/lib/calculation-notes";
import type { ComprehensiveDetails } from "@/lib/estimation-team";
import EstimationGanttChart from "./EstimationGanttChart";
import { DetailsSections } from "./EstimationReport";

// The latest estimation saved from the Proposed Estimation tab
interface SavedEstimation {
  totalEffort: number;
  timeline: number;
  teamSize: number;
  totalBudget?: number;
  costPerHour?: number;
  confidence?: number;
  riskLevel?: string;
  testingLevel?: string;
  createdAt?: string;
  breakdown?: { details?: ComprehensiveDetails } | null;
}

interface EstimationData {
  id: string;
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
  saved?: SavedEstimation;
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

        const response = await authFetch("/api/analyses", {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const estimatedData = data.map((req: any) => {
            // Same numbers as the Proposed Estimation tab: from the saved
            // detailed estimation when there is one, else M × 0.5 / M × 0.8
            const { qaManDays, devManDays } = getProposedManDays(req.complexityScore, req.estimationData);

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
              saved: req.estimationData && req.estimationData.timeline ? req.estimationData : undefined,
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this estimation? This action cannot be undone.")) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await authFetch(`/api/analyses/${id}`, {
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
                  {est.saved && (
                    <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      📊 Detailed estimation saved
                    </span>
                  )}
                </div>

                <div className="col-span-1 text-center">
                  <span className="inline-block px-2 py-1 bg-white rounded text-sm font-semibold text-slate-900">
                    {est.complexityScore}
                  </span>
                  <InfoTip note={calculationNotes.complexity(est.nodesCount, est.edgesCount, est.paths, est.complexityScore)} />
                  <p className="text-xs text-slate-600 mt-1">
                    {getComplexityLevel(est.complexityScore)}
                  </p>
                </div>

                <div className="col-span-2 text-right">
                  <p className="font-bold text-lg text-blue-600">
                    ~{Math.round(est.qaManDays)}
                    <InfoTip align="right" note={calculationNotes.qa(est.complexityScore, est.saved)} />
                  </p>
                  <p className="text-xs text-slate-600">man days</p>
                </div>

                <div className="col-span-2 text-right">
                  <p className="font-bold text-lg text-green-600">
                    ~{Math.round(est.devManDays)}
                    <InfoTip align="right" note={calculationNotes.dev(est.complexityScore, est.saved)} />
                  </p>
                  <p className="text-xs text-slate-600">man days</p>
                </div>

                <div className="col-span-2 text-right">
                  <p className="font-bold text-lg text-purple-600">
                    ~{Math.round(est.totalManDays)}
                    <InfoTip align="right" note={calculationNotes.total(est.complexityScore, est.saved)} />
                  </p>
                  <p className="text-xs text-slate-600">man days</p>
                </div>

                <div className="col-span-2 text-right">
                  {est.saved ? (
                    <>
                      <p className="font-semibold text-indigo-700">
                        {est.saved.timeline} weeks
                        <InfoTip align="right" note={calculationNotes.timeline(est.saved)} />
                      </p>
                      <p className="text-xs text-slate-600">saved estimation</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900">
                        ~{Math.max(est.devTeamDays, est.qaTeamDays)} days
                        <InfoTip align="right" note={calculationNotes.quickTimeline(est.devManDays, est.qaManDays)} />
                      </p>
                      <p className="text-xs text-slate-600">parallel execution</p>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded Row - Details */}
              {selectedRow === est.id && (
                <div
                  className="border-t border-slate-200 bg-white bg-opacity-50 p-4 space-y-4 cursor-default"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Saved detailed estimation */}
                  {est.saved && (
                    <div className="space-y-4 pb-4 border-b border-slate-200">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-lg font-bold text-slate-900">📊 Saved Estimation</h3>
                        {est.saved.createdAt && (
                          <span className="text-xs text-slate-500">
                            Saved {new Date(est.saved.createdAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-white rounded border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold">
                            Total Effort <InfoTip note={calculationNotes.totalEffort(est.saved)} />
                          </p>
                          <p className="text-2xl font-bold text-blue-600">{est.saved.totalEffort} h</p>
                        </div>
                        <div className="p-3 bg-white rounded border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold">
                            Timeline <InfoTip note={calculationNotes.timeline(est.saved)} />
                          </p>
                          <p className="text-2xl font-bold text-indigo-600">{formatDuration(est.saved.timeline)}</p>
                        </div>
                        <div className="p-3 bg-white rounded border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold">Team</p>
                          <p className="text-2xl font-bold text-slate-900">{est.saved.teamSize} devs</p>
                          {est.saved.breakdown?.details && (
                            <p className="text-xs text-slate-500">{est.saved.breakdown.details.totalPeople} people in total</p>
                          )}
                        </div>
                        <div className="p-3 bg-white rounded border border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold">
                            {est.saved.totalBudget ? "Budget" : "Confidence"}
                            <InfoTip
                              align="right"
                              note={est.saved.totalBudget ? calculationNotes.budget(est.saved) : calculationNotes.confidence(est.saved)}
                            />
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {est.saved.totalBudget ? formatCurrency(est.saved.totalBudget) : `${est.saved.confidence ?? "-"}%`}
                          </p>
                          {est.saved.totalBudget && est.saved.confidence !== undefined && (
                            <p className="text-xs text-slate-500">Confidence {est.saved.confidence}%</p>
                          )}
                        </div>
                      </div>
                      <EstimationGanttChart estimation={est.saved} />
                      {est.saved.breakdown?.details && <DetailsSections details={est.saved.breakdown.details} />}
                    </div>
                  )}

                  {est.saved && (
                    <p className="text-sm font-semibold text-slate-700">Requirement graph</p>
                  )}
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

                  {/* Quick team breakdown: only without a saved detailed estimation */}
                  {!est.saved && (<>
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
                      <strong>QA Calculation:</strong> M × 0.5 = {est.complexityScore} × 0.5 = ~{Math.round(est.qaManDays)} man days
                    </p>
                    <p>
                      <strong>Dev Calculation:</strong> M × 0.8 = {est.complexityScore} × 0.8 = ~{Math.round(est.devManDays)} man days
                    </p>
                  </div>
                  </>)}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(est.id);
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
