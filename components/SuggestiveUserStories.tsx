"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AcceptanceCriteria {
  criteria: string;
}

interface UserStory {
  id: string;
  priority: "Must-Have" | "Should-Have" | "Nice-to-Have";
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  estimatedDays: number;
}

interface UserStoriesProps {
  requirementText: string;
  complexityLevel: string;
  analysisId?: string;
}

export default function SuggestiveUserStories({ requirementText, complexityLevel, analysisId }: UserStoriesProps) {
  const [stories, setStories] = useState<UserStory[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    generateStories();
  }, [requirementText, complexityLevel]);

  const generateStories = async () => {
    if (!requirementText.trim()) return;

    // Create a cache key
    const cacheKey = `stories_${Buffer.from(requirementText).toString('base64').substring(0, 50)}_${complexityLevel}`;

    // Check if stories are already cached in sessionStorage
    const cachedStories = sessionStorage.getItem(cacheKey);
    if (cachedStories) {
      try {
        const parsed = JSON.parse(cachedStories);
        setStories(parsed.stories);
        setSummary(parsed.summary);
        return;
      } catch (e) {
        // If cache is corrupted, continue with API call
      }
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate-user-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement: requirementText,
          complexity: complexityLevel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate user stories");
      }

      const data = await response.json();
      setStories(data.stories);
      setSummary(data.summary);

      // Cache the results
      sessionStorage.setItem(cacheKey, JSON.stringify({
        stories: data.stories,
        summary: data.summary,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate user stories");
    } finally {
      setLoading(false);
    }
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

      const response = await fetch("/api/save-user-stories", {
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">❌ {error}</p>
      </div>
    );
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

  return (
    <div className="space-y-6">
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
            {stories.reduce((sum, s) => sum + s.storyPoints, 0)}
          </p>
          <p className="text-xs text-slate-600 mt-1">Total Story Points</p>
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
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{story.title}</h3>
              </div>
              <div className="text-right ml-2">
                <p className="text-sm font-bold text-slate-900">{story.storyPoints}pt</p>
                <p className="text-xs text-slate-600">{story.estimatedDays}d</p>
              </div>
            </div>

            {/* Description (always visible) */}
            <p className="text-xs text-slate-600 mb-2 italic">{story.description}</p>

            {/* Acceptance Criteria (expanded) */}
            {expandedStory === story.id && (
              <div className="mt-3 pt-3 border-t border-current border-opacity-20">
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
