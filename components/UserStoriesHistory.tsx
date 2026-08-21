"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface UserStory {
  id: string;
  priority: "Must-Have" | "Should-Have" | "Nice-to-Have";
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  estimatedDays: number;
}

interface SavedUserStory {
  id: string;
  analysis_id: string;
  requirement_title: string;
  requirement_id: string;
  stories: UserStory[];
  summary: string;
  created_at: string;
}

interface UserStoriesHistoryProps {
  selectedRequirementId?: string;
}

export default function UserStoriesHistory({ selectedRequirementId }: UserStoriesHistoryProps) {
  const [allStories, setAllStories] = useState<SavedUserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [selectedRequirement, setSelectedRequirement] = useState<string>(selectedRequirementId || "all");

  useEffect(() => {
    fetchUserStories();
  }, []);

  useEffect(() => {
    if (selectedRequirementId) {
      setSelectedRequirement(selectedRequirementId);
    }
  }, [selectedRequirementId]);

  const fetchUserStories = async () => {
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Unauthorized");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/get-user-stories", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user stories");
      }

      const data = await response.json();
      setAllStories(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch user stories");
    } finally {
      setLoading(false);
    }
  };

  const getUniqueeRequirements = () => {
    const requirements = new Map();
    allStories.forEach(story => {
      if (!requirements.has(story.requirement_id)) {
        requirements.set(story.requirement_id, story.requirement_title);
      }
    });
    return Array.from(requirements.entries()).map(([id, title]) => ({ id, title }));
  };

  const getFilteredStories = () => {
    if (selectedRequirement === "all") {
      return allStories;
    }
    return allStories.filter(story => story.requirement_id === selectedRequirement);
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

  const filteredStories = getFilteredStories();
  const uniqueRequirements = getUniqueeRequirements();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">Loading user stories history...</p>
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

  if (allStories.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
        <p className="text-slate-600 mb-4">No user stories found</p>
        <p className="text-sm text-slate-500">
          Save user stories from the "Suggestive User Stories" tab to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Requirement Filter */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          📋 Filter by Requirement
        </label>
        <select
          value={selectedRequirement}
          onChange={(e) => setSelectedRequirement(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-900 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Requirements ({allStories.length} saved)</option>
          {uniqueRequirements.map((req) => (
            <option key={req.id} value={req.id}>
              {req.title} ({allStories.filter(s => s.requirement_id === req.id).length} saved)
            </option>
          ))}
        </select>
      </div>

      {/* Requirement Header */}
      {selectedRequirement !== "all" && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="font-semibold text-indigo-900">
            📌 Requirement: {uniqueRequirements.find(r => r.id === selectedRequirement)?.title}
          </p>
          <p className="text-sm text-indigo-700 mt-1">
            Showing {filteredStories.length} saved user stories for this requirement
          </p>
        </div>
      )}

      {/* Stories List */}
      {filteredStories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-slate-600 mb-4">No stories found for this requirement</p>
          <p className="text-sm text-slate-500">
            Create user stories from the "Suggestive User Stories" tab for this requirement
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStories.map((saved) => (
            <div
              key={saved.id}
              className="p-4 bg-white border border-slate-200 rounded-lg space-y-4"
            >
              {/* Saved Entry Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-600">
                    Saved {new Date(saved.created_at).toLocaleDateString()} at{" "}
                    {new Date(saved.created_at).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Analysis: {saved.analysis_id}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {saved.stories.length} stories
                </span>
              </div>

              {/* Summary */}
              {saved.summary && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700">
                    <strong>Summary:</strong> {saved.summary}
                  </p>
                </div>
              )}

              {/* Stories Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {saved.stories.map((story) => (
                  <div
                    key={story.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${getPriorityColor(
                      story.priority
                    )} ${expandedStory === `${saved.id}-${story.id}` ? "ring-2 ring-blue-500" : ""}`}
                    onClick={() =>
                      setExpandedStory(
                        expandedStory === `${saved.id}-${story.id}`
                          ? null
                          : `${saved.id}-${story.id}`
                      )
                    }
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex gap-2 items-center mb-1">
                          <span className="text-xs font-bold text-slate-600">{story.id}</span>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${
                              story.priority === "Must-Have"
                                ? "bg-red-100 text-red-800"
                                : story.priority === "Should-Have"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {story.priority}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{story.title}</h4>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-sm font-bold text-slate-900">{story.storyPoints}pt</p>
                        <p className="text-xs text-slate-600">{story.estimatedDays}d</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 mb-2 italic">{story.description}</p>

                    {/* Acceptance Criteria (expanded) */}
                    {expandedStory === `${saved.id}-${story.id}` && (
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
                      {expandedStory === `${saved.id}-${story.id}` ? "▼" : "▶"} Click to{" "}
                      {expandedStory === `${saved.id}-${story.id}` ? "collapse" : "expand"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
