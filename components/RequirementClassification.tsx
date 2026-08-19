"use client";

import { useState } from "react";

interface Classification {
  type: string;
  businessImpact: string;
  technicalRisk: string;
  scope: string;
  complexity: string;
  stakeholders: string[];
  dependencies: string[];
  successMetrics: string[];
  constraints: string;
  keyChallenges: string;
  executiveSummary: string;
}

interface Props {
  requirementText: string;
  onClassificationComplete?: (classification: Classification) => void;
}

export default function RequirementClassification({ requirementText, onClassificationComplete }: Props) {
  const [classification, setClassification] = useState<Classification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const classify = async () => {
    if (!requirementText.trim()) {
      setError("Please enter a requirement");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/classify-requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementText }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Classification failed");
      }

      const data = await response.json();
      setClassification(data.classification);
      if (onClassificationComplete) {
        onClassificationComplete(data.classification);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "Critical": return "bg-red-100 text-red-800";
      case "High": return "bg-orange-100 text-orange-800";
      case "Medium": return "bg-yellow-100 text-yellow-800";
      case "Low": return "bg-green-100 text-green-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "Critical": return "bg-red-50 border-red-200 text-red-900";
      case "High": return "bg-orange-50 border-orange-200 text-orange-900";
      case "Medium": return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "Low": return "bg-green-50 border-green-200 text-green-900";
      default: return "bg-slate-50 border-slate-200 text-slate-900";
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Classifying requirement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">❌ {error}</p>
        <button
          onClick={classify}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry Classification
        </button>
      </div>
    );
  }

  if (!classification) {
    return (
      <button
        onClick={classify}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
      >
        🔍 Analyze & Classify Requirement
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <h3 className="font-bold text-lg text-blue-900 mb-2">Executive Summary</h3>
        <p className="text-slate-700">{classification.executiveSummary}</p>
      </div>

      {/* Classification Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Type</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{classification.type}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Business Impact</p>
          <div className="mt-1">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getImpactColor(classification.businessImpact)}`}>
              {classification.businessImpact}
            </span>
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Technical Risk</p>
          <div className="mt-1">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getImpactColor(classification.technicalRisk)}`}>
              {classification.technicalRisk}
            </span>
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Scope</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{classification.scope}</p>
        </div>
      </div>

      {/* Complexity & Constraints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-lg border ${getRiskColor(classification.complexity)}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Complexity Level</p>
          <p className="text-lg font-bold mt-1">{classification.complexity}</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Key Constraints</p>
          <p className="text-slate-700 mt-1 text-sm">{classification.constraints}</p>
        </div>
      </div>

      {/* Key Challenges */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm font-bold text-red-900 mb-2">⚠️ Key Challenges</p>
        <p className="text-sm text-red-800">{classification.keyChallenges}</p>
      </div>

      {/* Stakeholders */}
      <div className="p-4 bg-white rounded-lg border border-slate-200">
        <p className="text-sm font-bold text-slate-900 mb-3">👥 Stakeholders Affected</p>
        <div className="flex flex-wrap gap-2">
          {classification.stakeholders.map((stakeholder, i) => (
            <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
              {stakeholder}
            </span>
          ))}
        </div>
      </div>

      {/* Dependencies */}
      <div className="p-4 bg-white rounded-lg border border-slate-200">
        <p className="text-sm font-bold text-slate-900 mb-3">🔗 Dependencies</p>
        <ul className="space-y-1">
          {classification.dependencies.map((dep, i) => (
            <li key={i} className="text-sm text-slate-700">
              • {dep}
            </li>
          ))}
        </ul>
      </div>

      {/* Success Metrics */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm font-bold text-green-900 mb-3">✅ Success Metrics</p>
        <ul className="space-y-1">
          {classification.successMetrics.map((metric, i) => (
            <li key={i} className="text-sm text-green-800">
              ✓ {metric}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
