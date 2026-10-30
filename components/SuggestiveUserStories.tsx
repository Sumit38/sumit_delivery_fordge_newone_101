"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/lib/supabase";
import type { PlanningAnswers, SprintPlan } from "@/lib/story-planning";
import StoryPlanningChat, { type QuestionAnswer } from "./StoryPlanningChat";

interface UserStory {
  id: string;
  priority: "Must-Have" | "Should-Have" | "Nice-to-Have";
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  estimatedDays: number;
  // Present for stories made in a Q&A session
  type?: string;
  persona?: string;
  sprint?: number | null;
  dependsOn?: string[];
}

interface PlanningSession {
  planningAnswers: PlanningAnswers;
  questionAnswers: QuestionAnswer[];
}

interface GenerateOptions extends Partial<PlanningSession> {
  previousStories?: UserStory[];
  feedback?: string;
}

interface UserStoriesProps {
  requirementText: string;
  complexityLevel: string;
  analysisId?: string;
}

type EstimationMethod = "fibonacci" | "planning-poker" | "tshirt";

export default function SuggestiveUserStories({ requirementText, complexityLevel, analysisId }: UserStoriesProps) {
  const [stories, setStories] = useState<UserStory[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [estimationMethod, setEstimationMethod] = useState<EstimationMethod>("fibonacci");
  // "qa" shows the planning chat; "stories" shows the generated stories
  const [view, setView] = useState<"qa" | "stories">("qa");
  const [session, setSession] = useState<PlanningSession | null>(null);
  const [sprintPlan, setSprintPlan] = useState<SprintPlan | null>(null);
  const [feedback, setFeedback] = useState("");
  const [refining, setRefining] = useState(false);

  // Create a cache key
  const cacheKey = `stories_${Buffer.from(requirementText).toString('base64').substring(0, 50)}_${complexityLevel}`;

  // Show stories already made in this browser session; otherwise start the Q&A
  useEffect(() => {
    setError("");
    setFeedback("");
    for (const key of [`${cacheKey}_qa`, cacheKey]) {
      const cached = sessionStorage.getItem(key);
      if (!cached) continue;
      try {
        const parsed = JSON.parse(cached);
        setStories(parsed.stories);
        setSummary(parsed.summary);
        setSprintPlan(parsed.sprintPlan || null);
        setSession(parsed.session || null);
        setView("stories");
        return;
      } catch (e) {
        // If cache is corrupted, ignore it
      }
    }
    setStories([]);
    setSummary("");
    setSprintPlan(null);
    setSession(null);
    setView("qa");
  }, [requirementText, complexityLevel]);

  const generateStories = async (options: GenerateOptions = {}) => {
    if (!requirementText.trim()) return;
    const planned = Boolean(options.planningAnswers);

    if (options.feedback) setRefining(true);
    else setLoading(true);
    setError("");

    try {
      const response = await authFetch("/api/generate-user-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement: requirementText,
          complexity: complexityLevel,
          ...(planned
            ? {
                planningAnswers: options.planningAnswers,
                questionAnswers: options.questionAnswers || [],
                previousStories: options.previousStories,
                feedback: options.feedback,
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate user stories");
      }

      const data = await response.json();
      const nextSession = planned
        ? { planningAnswers: options.planningAnswers!, questionAnswers: options.questionAnswers || [] }
        : null;
      setStories(data.stories);
      setSummary(data.summary);
      setSprintPlan(data.sprintPlan || null);
      setSession(nextSession);
      setView("stories");
      setFeedback("");

      // Cache the results (Q&A stories under their own key)
      sessionStorage.setItem(planned ? `${cacheKey}_qa` : cacheKey, JSON.stringify({
        stories: data.stories,
        summary: data.summary,
        sprintPlan: data.sprintPlan || null,
        session: nextSession,
      }));
      if (!planned) sessionStorage.removeItem(`${cacheKey}_qa`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate user stories");
    } finally {
      setLoading(false);
      setRefining(false);
    }
  };

  const refineStories = () => {
    if (!session || !feedback.trim()) return;
    generateStories({ ...session, previousStories: stories, feedback: feedback.trim() });
  };

  const startNewSession = () => {
    setError("");
    setView("qa");
  };

  const saveUserStories = async () => {
    if (!analysisId || stories.length === 0) {
      alert("No stories to save");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("User session not found");
      }

      const response = await authFetch("/api/save-user-stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          analysisId,
          stories,
          summary,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save user stories");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Failed to save: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const convertStoryPoints = (fibonacciPoints: number, method: EstimationMethod): string | number => {
    switch (method) {
      case "fibonacci":
        return fibonacciPoints;
      case "planning-poker":
        // Planning Poker: Spread Fibonacci across full Planning Poker range
        // Fibonacci 1 → Planning Poker 1
        // Fibonacci 2 → Planning Poker 3
        // Fibonacci 3 → Planning Poker 5
        // Fibonacci 5 → Planning Poker 8
        // Fibonacci 8 → Planning Poker 13
        // Fibonacci 13 → Planning Poker 20
        if (fibonacciPoints <= 1) return 1;
        if (fibonacciPoints <= 2) return 3;
        if (fibonacciPoints <= 3) return 5;
        if (fibonacciPoints <= 5) return 8;
        if (fibonacciPoints <= 8) return 13;
        return 20;
      case "tshirt":
        // T-Shirt: XS, S, M, L, XL
        if (fibonacciPoints <= 1) return "XS";
        if (fibonacciPoints <= 2) return "S";
        if (fibonacciPoints <= 5) return "M";
        if (fibonacciPoints <= 8) return "L";
        return "XL";
      default:
        return fibonacciPoints;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Must-Have":
        return "bg-red-50 border-red-200";
      case "Should-Have":
        return "bg-yellow-50 border-yellow-200";
      case "Nice-to-Have":
        return "bg-green-50 border-green-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "Must-Have":
        return "bg-red-100 text-red-800";
      case "Should-Have":
        return "bg-yellow-100 text-yellow-800";
      case "Nice-to-Have":
        return "bg-green-100 text-green-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Generating user stories...</p>
        <p className="text-xs text-slate-500 mt-1">This can take up to a minute.</p>
      </div>
    );
  }

  const errorBox = error ? (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-red-700">❌ {error}</p>
    </div>
  ) : null;

  if (view === "qa" && requirementText.trim()) {
    return (
      <div className="space-y-4">
        {errorBox}
        {stories.length > 0 && (
          <button type="button" onClick={() => setView("stories")} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
            ← Back to current stories
          </button>
        )}
        <StoryPlanningChat
          requirementText={requirementText}
          complexityLevel={complexityLevel}
          initialAnswers={session?.planningAnswers}
          onComplete={(planningAnswers, questionAnswers) => generateStories({ planningAnswers, questionAnswers })}
          onSkip={() => generateStories()}
        />
      </div>
    );
  }

  if (error && stories.length === 0) {
    return errorBox;
  }

  if (stories.length === 0 && !loading) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
        <p className="text-slate-600 mb-4">No records found</p>
        <p className="text-sm text-slate-500">
          Complete an analysis in "Requirement Analysis" tab to generate user stories
        </p>
      </div>
    );
  }

  const sprintWeeks = sprintPlan?.sprintLengthWeeks || 2;

  return (
    <div className="space-y-6">
      {errorBox}

      {/* Planning session bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] text-sm text-slate-700">
          {session ? (
            <>
              🤖 Made in a planning session: {String(session.planningAnswers.sprintLength)} sprints,{" "}
              {String(session.planningAnswers.velocity)} points per sprint, {String(session.planningAnswers.sprintCount)} sprints planned
              {session.questionAnswers.length ? `, ${session.questionAnswers.length} requirement answers` : ""}.
            </>
          ) : (
            <>Generated without a planning session. Answer a few questions to fit the stories to your sprints.</>
          )}
        </div>
        <button
          type="button"
          onClick={startNewSession}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
        >
          🗣️ {session ? "Change answers" : "Start planning Q&A"}
        </button>
      </div>

      {/* Sprint plan */}
      {sprintPlan && (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <p className="font-semibold text-slate-900">🗓️ Sprint plan</p>
            <p className="text-xs text-slate-600">
              {sprintPlan.totalPoints} points in total · capacity {sprintPlan.velocity * sprintPlan.sprintCount} points (
              {sprintPlan.velocity} × {sprintPlan.sprintCount} sprints) · about {sprintPlan.sprintCount * sprintWeeks} weeks
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sprintPlan.sprints.map((s) => {
              const fill = Math.min(100, Math.round((s.points / sprintPlan.velocity) * 100));
              return (
                <div key={s.sprint} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Sprint {s.sprint}</span>
                    <span className={s.points > sprintPlan.velocity ? "text-red-600" : ""}>
                      {s.points}/{sprintPlan.velocity} pts
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 my-2">
                    <div className={`h-1.5 rounded-full ${s.points > sprintPlan.velocity ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${fill}%` }} />
                  </div>
                  <div className="text-xs text-slate-600">{s.storyIds.length ? s.storyIds.join(", ") : "Empty"}</div>
                </div>
              );
            })}
          </div>
          {sprintPlan.backlog.length > 0 && (
            <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              Backlog ({sprintPlan.backlogPoints} points, does not fit in {sprintPlan.sprintCount} sprints): {sprintPlan.backlog.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Estimation Method Selector */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-slate-900 mb-2">📊 Estimation Method</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setEstimationMethod("fibonacci")}
                className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  estimationMethod === "fibonacci"
                    ? "bg-blue-600 text-white ring-2 ring-blue-400"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                }`}
              >
                Fibonacci
              </button>
              <button
                onClick={() => setEstimationMethod("planning-poker")}
                className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  estimationMethod === "planning-poker"
                    ? "bg-blue-600 text-white ring-2 ring-blue-400"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                }`}
              >
                Planning Poker
              </button>
              <button
                onClick={() => setEstimationMethod("tshirt")}
                className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  estimationMethod === "tshirt"
                    ? "bg-blue-600 text-white ring-2 ring-blue-400"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                }`}
              >
                T-Shirt
              </button>
            </div>
          </div>

          {/* Method Explanation */}
          <div className="bg-white rounded-lg p-3 text-xs space-y-2 border border-slate-100">
            {estimationMethod === "fibonacci" && (
              <div>
                <p className="font-semibold text-slate-900">Fibonacci Sequence (1, 2, 3, 5, 8, 13)</p>
                <p className="text-slate-600">
                  ✓ Most popular in Agile. Uses natural numbers that increase exponentially, reflecting uncertainty in larger tasks.
                  <br/>ℹ️ <strong>Use when:</strong> You want precise estimation with built-in uncertainty accommodation.
                </p>
              </div>
            )}
            {estimationMethod === "planning-poker" && (
              <div>
                <p className="font-semibold text-slate-900">Planning Poker (0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100)</p>
                <p className="text-slate-600">
                  ✓ Used in formal Planning Poker sessions. Includes fractional and very large values for extreme cases.
                  <br/>ℹ️ <strong>Use when:</strong> Team uses Planning Poker game for collaborative estimation.
                </p>
              </div>
            )}
            {estimationMethod === "tshirt" && (
              <div>
                <p className="font-semibold text-slate-900">T-Shirt Sizing (XS, S, M, L, XL)</p>
                <p className="text-slate-600">
                  ✓ Simple & intuitive. Great for initial rough estimation or non-technical stakeholders.
                  <br/>ℹ️ <strong>Use when:</strong> You want quick, easy-to-understand sizing without numeric details.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Overview:</strong> {summary}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-slate-900">{stories.length}</p>
          <p className="text-xs text-slate-600 mt-1">Total Stories</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-slate-900">
            {estimationMethod === "tshirt"
              ? `${stories.filter(s => convertStoryPoints(s.storyPoints, estimationMethod) === "XS").length}XS, ${stories.filter(s => convertStoryPoints(s.storyPoints, estimationMethod) === "S").length}S, ${stories.filter(s => convertStoryPoints(s.storyPoints, estimationMethod) === "M").length}M, ${stories.filter(s => convertStoryPoints(s.storyPoints, estimationMethod) === "L").length}L, ${stories.filter(s => convertStoryPoints(s.storyPoints, estimationMethod) === "XL").length}XL`
              : (() => {
                  let total = 0;
                  for (const story of stories) {
                    const converted = convertStoryPoints(story.storyPoints, estimationMethod);
                    if (typeof converted === 'number') {
                      total += converted;
                    }
                  }
                  return total;
                })()
            }
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Total Story Points {estimationMethod === "tshirt" ? "(Distribution)" : ""}
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-slate-900">
            {stories.reduce((sum, s) => sum + s.estimatedDays, 0).toFixed(1)}
          </p>
          <p className="text-xs text-slate-600 mt-1">Est. Days</p>
        </div>
      </div>

      {/* Stories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-4">
        {stories.map((story) => (
          <div
            key={story.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${getPriorityColor(
              story.priority
            )} ${expandedStory === story.id ? "ring-2 ring-blue-500" : ""}`}
            onClick={() =>
              setExpandedStory(expandedStory === story.id ? null : story.id)
            }
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex gap-2 items-center mb-1">
                  <span className="text-xs font-bold text-slate-600">{story.id}</span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${getPriorityBadgeColor(
                      story.priority
                    )}`}
                  >
                    {story.priority}
                  </span>
                  {story.type && (
                    <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-800">{story.type}</span>
                  )}
                  {story.sprint !== undefined && (
                    <span className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-700">
                      {story.sprint ? `Sprint ${story.sprint}` : "Backlog"}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{story.title}</h3>
              </div>
              <div className="text-right ml-2">
                <p className="text-sm font-bold text-slate-900">
                  {convertStoryPoints(story.storyPoints, estimationMethod)}
                  {estimationMethod === "fibonacci" ? "pt" : estimationMethod === "planning-poker" ? "pt" : ""}
                </p>
                <p className="text-xs text-slate-600">{story.estimatedDays}d</p>
              </div>
            </div>

            {/* Description (always visible) */}
            <p className="text-xs text-slate-600 mb-2 italic">{story.description}</p>

            {/* Acceptance Criteria (expanded) */}
            {expandedStory === story.id && (
              <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                {(story.persona || (story.dependsOn && story.dependsOn.length > 0)) && (
                  <p className="text-xs text-slate-600 mb-2">
                    {story.persona && <>👤 {story.persona}</>}
                    {story.persona && story.dependsOn && story.dependsOn.length > 0 && " · "}
                    {story.dependsOn && story.dependsOn.length > 0 && <>Depends on {story.dependsOn.join(", ")}</>}
                  </p>
                )}
                <p className="text-xs font-semibold text-slate-900 mb-2">
                  Acceptance Criteria:
                </p>
                <ul className="space-y-1">
                  {story.acceptanceCriteria.map((criteria, idx) => (
                    <li key={idx} className="text-xs text-slate-700">
                      ✓ {criteria}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Click hint */}
            <p className="text-xs text-slate-500 mt-2">
              {expandedStory === story.id ? "▼" : "▶"} Click to{" "}
              {expandedStory === story.id ? "collapse" : "expand"}
            </p>
          </div>
        ))}
      </div>

      {/* Refine with the agent */}
      {session && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="font-semibold text-slate-900 text-sm mb-2">🤖 Ask the agent to change the stories</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") refineStories();
              }}
              placeholder='e.g. "Split US-003", "Add a story for audit logging", "Move reporting to Nice-to-Have"'
              disabled={refining}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            />
            <button
              type="button"
              onClick={refineStories}
              disabled={refining || !feedback.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:bg-slate-400"
            >
              {refining ? "Updating..." : "Update stories"}
            </button>
          </div>
        </div>
      )}

      {/* Save Button */}
      {analysisId && (
        <button
          onClick={saveUserStories}
          disabled={saving || stories.length === 0}
          className={`w-full px-4 py-3 rounded-lg font-semibold transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400"
          }`}
        >
          {saving ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </div>
          ) : saved ? (
            "✓ Saved Successfully"
          ) : (
            "💾 Save User Stories"
          )}
        </button>
      )}

      {/* Priority Legend */}
      <div className="p-4 bg-slate-50 rounded-lg">
        <p className="text-xs font-semibold text-slate-600 mb-2">Priority Levels:</p>
        <div className="flex gap-4 text-xs text-slate-600">
          <span>🔴 Must-Have (Critical)</span>
          <span>🟡 Should-Have (Important)</span>
          <span>🟢 Nice-to-Have (Optional)</span>
        </div>
      </div>
    </div>
  );
}
