"use client";

import { useState } from "react";

interface DeliveryPlan {
  executiveSummary: { whatIsBeingDelivered: string; whyItMatters: string; successDefinition: string; timelineWeeks: number; budgetEstimate: number };
  deliveryPhases: Array<{ phase: string; duration: number; team: string[]; deliverables: string[] }>;
  teamStructure: Record<string, { count: number; roles: string[]; cost: number }>;
  milestones: Array<{ milestone: string; week: number; criteria: string }>;
  dependencies: { internal: string[]; external: string[]; blockers: string };
  budget: Record<string, number>;
  risks: Array<{ risk: string; impact: string; mitigation: string }>;
  successCriteria: Record<string, string[]>;
  goLivePlan: { strategy: string; rollbackTime: string; monitoring: string; supportReadiness: string };
}

interface Props {
  requirementText: string;
  classification?: any;
  devComplexity?: string;
  testComplexity?: string;
  onPlanComplete?: (plan: DeliveryPlan) => void;
}

export default function ComprehensiveDeliveryPlan({ requirementText, classification, devComplexity, testComplexity, onPlanComplete }: Props) {
  const [plan, setPlan] = useState<DeliveryPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/generate-delivery-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementText, classification, devComplexity, testComplexity }),
      });
      const data = await response.json();
      setPlan(data.plan);
      if (onPlanComplete) onPlanComplete(data.plan);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div></div>;
  }

  if (!plan) {
    return (
      <button onClick={generate} className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-semibold transition-all">
        📋 Generate Comprehensive Delivery Plan
      </button>
    );
  }

  const totalBudget = Object.values(plan.budget).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-lg border border-blue-200">
        <h3 className="font-bold text-xl text-blue-900 mb-4">📊 Executive Summary</h3>
        <p className="text-slate-700 mb-4">{plan.executiveSummary.whatIsBeingDelivered}</p>
        <p className="text-slate-700 mb-4"><strong>Why It Matters:</strong> {plan.executiveSummary.whyItMatters}</p>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-blue-200">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{plan.executiveSummary.timelineWeeks}</div>
            <p className="text-xs text-slate-600 mt-1">Weeks Timeline</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">${(plan.executiveSummary.budgetEstimate / 1000).toFixed(0)}K</div>
            <p className="text-xs text-slate-600 mt-1">Budget</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{Object.keys(plan.teamStructure).length}</div>
            <p className="text-xs text-slate-600 mt-1">Teams Involved</p>
          </div>
        </div>
      </div>

      {/* Delivery Phases Timeline */}
      <div className="space-y-3">
        <h3 className="font-bold text-lg text-slate-900">📅 Delivery Timeline</h3>
        {plan.deliveryPhases.map((phase, i) => (
          <div key={i} className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-slate-900">{phase.phase}</p>
                <p className="text-xs text-slate-600">Duration: {phase.duration} weeks</p>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded">{phase.duration}w</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div>
                <p className="font-semibold text-slate-700">Team:</p>
                <ul className="space-y-0.5">{phase.team.map((t, j) => <li key={j} className="text-slate-600">• {t}</li>)}</ul>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Deliverables:</p>
                <ul className="space-y-0.5">{phase.deliverables.map((d, j) => <li key={j} className="text-slate-600">✓ {d}</li>)}</ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Milestones */}
      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 className="font-bold text-yellow-900 mb-3">🎯 Key Milestones</h3>
        <div className="space-y-2">
          {plan.milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="px-2 py-1 bg-yellow-200 text-yellow-900 rounded text-xs font-bold">Week {m.week}</span>
              <div>
                <p className="font-semibold text-yellow-900 text-sm">{m.milestone}</p>
                <p className="text-xs text-yellow-800">{m.criteria}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget Breakdown */}
      <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
        <h3 className="font-bold text-green-900 mb-4">💰 Budget Breakdown</h3>
        <div className="space-y-2 mb-4">
          {Object.entries(plan.budget).map(([item, cost], i) => (
            <div key={i} className="flex justify-between items-center">
              <span className="text-sm text-green-800 capitalize">{item}:</span>
              <span className="text-sm font-bold text-green-900">${cost.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-green-300">
          <div className="flex justify-between items-center">
            <span className="font-bold text-green-900">Total Budget:</span>
            <span className="text-2xl font-bold text-green-600">${totalBudget.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Team Structure */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(plan.teamStructure).map(([team, data], i) => (
          <div key={i} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="font-bold text-purple-900 mb-2 capitalize">{team} Team</p>
            <div className="space-y-1 text-sm text-purple-800">
              <p><strong>{data.count}</strong> team member(s)</p>
              {data.roles.map((r, j) => <p key={j} className="text-xs">• {r}</p>)}
              <p className="pt-2 border-t border-purple-300"><strong>${data.cost.toLocaleString()}</strong></p>
            </div>
          </div>
        ))}
      </div>

      {/* Dependencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="font-bold text-blue-900 mb-2">🔗 Internal Dependencies</p>
          <ul className="space-y-1">
            {plan.dependencies.internal.map((d, i) => <li key={i} className="text-sm text-blue-800">→ {d}</li>)}
          </ul>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
          <p className="font-bold text-orange-900 mb-2">🌐 External Dependencies</p>
          <ul className="space-y-1">
            {plan.dependencies.external.map((d, i) => <li key={i} className="text-sm text-orange-800">→ {d}</li>)}
          </ul>
        </div>
      </div>

      {/* Risks */}
      <div className="space-y-2">
        <h3 className="font-bold text-lg text-slate-900">⚠️ Risk Management</h3>
        {plan.risks.map((r, i) => (
          <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start justify-between">
              <p className="font-bold text-red-900 text-sm">{r.risk}</p>
              <span className={`px-2 py-1 text-xs font-bold rounded ${r.impact === 'High' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
                {r.impact}
              </span>
            </div>
            <p className="text-xs text-red-800 mt-1"><strong>Mitigation:</strong> {r.mitigation}</p>
          </div>
        ))}
      </div>

      {/* Success Criteria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(plan.successCriteria).map(([category, criteria], i) => (
          <div key={i} className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="font-bold text-green-900 mb-2 capitalize">{category}</p>
            <ul className="space-y-1">
              {criteria.map((c, j) => <li key={j} className="text-sm text-green-800">✓ {c}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {/* Go-Live Plan */}
      <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
        <h3 className="font-bold text-indigo-900 mb-4">🚀 Go-Live Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-bold text-indigo-900 mb-1">Deployment Strategy</p>
            <p className="text-sm text-indigo-800">{plan.goLivePlan.strategy}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-900 mb-1">Rollback Time</p>
            <p className="text-sm text-indigo-800">{plan.goLivePlan.rollbackTime}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-900 mb-1">Monitoring</p>
            <p className="text-sm text-indigo-800">{plan.goLivePlan.monitoring}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-900 mb-1">Support Readiness</p>
            <p className="text-sm text-indigo-800">{plan.goLivePlan.supportReadiness}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
