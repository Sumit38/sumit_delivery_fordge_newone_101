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

interface SavedUserStories {
  id: string;
  analysis_id: string;
  stories: UserStory[];
  summary: string;
  created_at: string;
}

interface SavedTimeline {
  id: string;
  analysis_id: string;
  total_days: number;
  qa_man_days: number;
  dev_man_days: number;
  complexity_score: number;
  phases: any;
  created_at: string;
}

export default function ProjectPlansHistory() {
  const [userStories, setUserStories] = useState<SavedUserStories[]>([]);
  const [timelines, setTimelines] = useState<SavedTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"stories" | "timelines">("stories");

  useEffect(() => {
    fetchProjectPlans();
  }, []);

  const fetchProjectPlans = async () => {
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Unauthorized");
        setLoading(false);
        return;
      }

      const headers = {
        "Authorization": `Bearer ${session.access_token}`,
      };

      const [storiesRes, timelinesRes] = await Promise.all([
        fetch("/api/get-user-stories", { headers }),
        fetch("/api/get-project-timelines", { headers }),
      ]);

      if (!storiesRes.ok || !timelinesRes.ok) {
        throw new Error("Failed to fetch project plans");
      }

      const storiesData = await storiesRes.json();
      const timelinesData = await timelinesRes.json();

      setUserStories(storiesData.data || []);
      setTimelines(timelinesData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch project plans");
    } finally {
      setLoading(false);
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

  const getComplexityLevel = (score: number) => {
    if (score <= 5) return "Low";
    if (score <= 15) return "Medium";
    if (score <= 30) return "High";
    return "Very High";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading project plans...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setSelectedTab("stories")}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === "stories"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Saved User Stories ({userStories.length})
        </button>
        <button
          onClick={() => setSelectedTab("timelines")}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === "timelines"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Saved Timelines ({timelines.length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {/* User Stories Tab */}
      {selectedTab === "stories" && (
        <div className="space-y-4">
          {userStories.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-600">No records found</p>
              <p className="text-sm text-slate-500 mt-1">
                Generate and save user stories from an analysis to see them here
              </p>
            </div>
          ) : (
            userStories.map((plan) => (
              <div
                key={plan.id}
                className="p-6 bg-white rounded-lg border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Analysis: {plan.analysis_id}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Saved: {new Date(plan.created_at).toLocaleDateString()} at{" "}
                      {new Date(plan.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                    {plan.stories.length} Stories
                  </span>
                </div>

                {plan.summary && (
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                    {plan.summary}
                  </p>
                )}

                {/* Stories Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                  {plan.stories.map((story) => (
                    <div
                      key={story.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-all text-sm ${getPriorityColor(
                        story.priority
                      )} ${expandedStory === `${plan.id}-${story.id}` ? "ring-2 ring-blue-500" : ""}`}
                      onClick={() =>
                        setExpandedStory(
                          expandedStory === `${plan.id}-${story.id}`
                            ? null
                            : `${plan.id}-${story.id}`
                        )
                      }
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1">
                          <div className="flex gap-2 items-center mb-1">
                            <span className="text-xs font-bold text-slate-600">
                              {story.id}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded ${getPriorityBadgeColor(
                                story.priority
                              )}`}
                            >
                              {story.priority}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900">{story.title}</p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-bold text-slate-900">{story.storyPoints}pt</p>
                          <p className="text-xs text-slate-600">{story.estimatedDays}d</p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 italic">{story.description}</p>

                      {expandedStory === `${plan.id}-${story.id}` && (
                        <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                          <p className="text-xs font-semibold text-slate-900 mb-1">
                            Criteria:
                          </p>
                          <ul className="space-y-0.5">
                            {story.acceptanceCriteria.map((criteria, idx) => (
                              <li key={idx} className="text-xs text-slate-700">
                                ✓ {criteria}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Timelines Tab */}
      {selectedTab === "timelines" && (
        <div className="space-y-4">
          {timelines.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-600">No records found</p>
              <p className="text-sm text-slate-500 mt-1">
                Generate and save project timelines from an analysis to see them here
              </p>
            </div>
          ) : (
            timelines.map((timeline) => (
              <div
                key={timeline.id}
                className="p-6 bg-white rounded-lg border border-slate-200 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Analysis: {timeline.analysis_id}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Saved: {new Date(timeline.created_at).toLocaleDateString()} at{" "}
                      {new Date(timeline.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                    {getComplexityLevel(timeline.complexity_score)} Complexity
                  </span>
                </div>

                {/* Timeline Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded text-center">
                    <p className="text-lg font-bold text-slate-900">
                      {timeline.total_days.toFixed(0)}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">Total Days</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded text-center">
                    <p className="text-lg font-bold text-green-600">
                      {timeline.dev_man_days.toFixed(0)}
                    </p>
                    <p className="text-xs text-green-700 mt-1">Dev Days</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded text-center">
                    <p className="text-lg font-bold text-yellow-600">
                      {timeline.qa_man_days.toFixed(0)}
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">QA Days</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded text-center">
                    <p className="text-lg font-bold text-blue-600">
                      {timeline.complexity_score}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">Complexity</p>
                  </div>
                </div>

                {/* Phases */}
                {timeline.phases && timeline.phases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Phases:</p>
                    <div className="space-y-1">
                      {timeline.phases.map((phase: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">{phase.name}</span>
                          <span className="text-slate-600">{phase.days.toFixed(1)} days</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={fetchProjectPlans}
        className="w-full px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 font-medium transition-colors text-sm"
      >
        🔄 Refresh
      </button>
    </div>
  );
}
