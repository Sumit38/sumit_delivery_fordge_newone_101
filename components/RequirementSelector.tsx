"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Analysis {
  id: string;
  title: string;
  complexityScore: number;
}

interface RequirementSelectorProps {
  currentAnalysisId?: string;
  onAnalysisSelect: (analysisId: string, title: string) => void;
}

export default function RequirementSelector({
  currentAnalysisId,
  onAnalysisSelect,
}: RequirementSelectorProps) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchAnalyses = async () => {
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

  const currentAnalysis = analyses.find((a) => a.id === currentAnalysisId);

  if (loading) {
    return null;
  }

  if (analyses.length === 0) {
    return null;
  }

  if (analyses.length === 1) {
    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Requirement:</strong> {analyses[0].title}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-blue-700 font-semibold">Select Requirement</p>
          {currentAnalysis && (
            <p className="text-sm text-blue-900 mt-1">
              <strong>Current:</strong> {currentAnalysis.title}
            </p>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {showDropdown ? "Close" : "Switch"} ({analyses.length})
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-blue-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
              <div className="p-2">
                {analyses.map((analysis) => (
                  <button
                    key={analysis.id}
                    onClick={() => {
                      onAnalysisSelect(analysis.id, analysis.title);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left p-3 rounded mb-2 transition-colors ${
                      currentAnalysisId === analysis.id
                        ? "bg-blue-100 border-l-4 border-blue-600"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <div className="font-medium text-slate-900">
                      {analysis.title}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Complexity: {analysis.complexityScore}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
