"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import AnalysisResults from "@/components/AnalysisResults";
import RefineRequirement from "@/components/RefineRequirement";
import AnalysisHistory from "@/components/AnalysisHistory";
import EstimationHistory from "@/components/EstimationHistory";
import SuggestiveUserStories from "@/components/SuggestiveUserStories";
import AboutPage from "@/components/AboutPage";
import DownloadUseCaseButton from "@/components/DownloadUseCaseButton";
import RequirementSelector from "@/components/RequirementSelector";

interface LatestAnalysis {
  id?: string;
  requirementText: string;
  complexityScore: number;
  complexityLevel: string;
  qaManDays: number;
  devManDays: number;
  nodesCount?: number;
  edgesCount?: number;
  paths?: number;
  testScenarios?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [activeTab, setActiveTab] = useState<"analyze" | "refine" | "history" | "user-stories" | "proposed-estimation" | "estimation" | "about">("analyze");
  const [refreshHistory, setRefreshHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<LatestAnalysis | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setUserEmail(session.user.email || "User");
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleAnalysisComplete = () => {
    setIsTransitioning(true);
    setRefreshHistory((prev) => !prev);
    setTimeout(() => {
      setActiveTab("history");
      setIsTransitioning(false);
    }, 300);
  };

  const handleRefineRequired = (requirementText: string) => {
    // Switch to Refine tab and pass the requirement
    setActiveTab("refine");
    // Store requirement in sessionStorage to pass to RefineRequirement component
    sessionStorage.setItem("rawRequirementForRefine", requirementText);
  };

  const handleRefinementComplete = (refinedRequirement: string) => {
    // Switch back to Analyze tab with refined requirement
    setIsTransitioning(true);
    sessionStorage.setItem("refinedRequirementText", refinedRequirement);
    setTimeout(() => {
      setActiveTab("analyze");
      setIsTransitioning(false);
    }, 300);
  };

  const handleAnalyzeFromRefinement = async (refinedRequirement: string, title: string): Promise<void> => {
    // Directly analyze from refinement page and go to history
    setIsTransitioning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert("Please sign in first");
        setIsTransitioning(false);
        return;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requirementText: refinedRequirement,
          title: title || "Untitled Requirement",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      // Analysis successful, refresh history and go to it
      setRefreshHistory((prev) => !prev);
      setTimeout(() => {
        setActiveTab("history");
        setIsTransitioning(false);
      }, 300);
    } catch (error) {
      alert("Analysis failed: " + (error instanceof Error ? error.message : "Unknown error"));
      setIsTransitioning(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">🔨</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">DeliveryForge</h1>
              <p className="text-sm text-slate-600 mt-0">Welcome, {userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Download Use Case Button - Show in all tabs except "analyze" and "about" */}
            {latestAnalysis && activeTab !== "analyze" && activeTab !== "about" && (
              <DownloadUseCaseButton
                requirementTitle={latestAnalysis.id || "Untitled"}
                requirementText={latestAnalysis.requirementText}
                complexityScore={latestAnalysis.complexityScore}
                complexityLevel={latestAnalysis.complexityLevel}
                devManDays={latestAnalysis.devManDays}
                qaManDays={latestAnalysis.qaManDays}
                testScenarios={latestAnalysis.testScenarios || latestAnalysis.complexityScore * 2}
                nodesCount={latestAnalysis.nodesCount || 0}
                edgesCount={latestAnalysis.edgesCount || 0}
                paths={latestAnalysis.paths || 1}
              />
            )}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Loading Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-lg text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-900 font-semibold">Processing...</p>
            <p className="text-sm text-slate-600 mt-2">Please wait while we analyze your requirement</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-200 overflow-x-auto">
          {/* Primary workflow tabs */}
          <div className="flex gap-1 border-r border-slate-300 pr-4">
            <button
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveTab("analyze");
                  setIsTransitioning(false);
                }, 300);
              }}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm ${
                activeTab === "analyze"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Requirement Analysis
            </button>
            <button
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveTab("history");
                  setIsTransitioning(false);
                }, 300);
              }}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm ${
                activeTab === "history"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Analysis History
            </button>
            <button
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveTab("user-stories");
                  setIsTransitioning(false);
                }, 300);
              }}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm ${
                activeTab === "user-stories"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              User Stories
            </button>
            <button
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveTab("proposed-estimation");
                  setIsTransitioning(false);
                }, 300);
              }}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm ${
                activeTab === "proposed-estimation"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Proposed Estimation
            </button>
            <button
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setActiveTab("estimation");
                  setIsTransitioning(false);
                }, 300);
              }}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm ${
                activeTab === "estimation"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Estimation History
            </button>
          </div>
          <button
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                setActiveTab("about");
                setIsTransitioning(false);
              }, 300);
            }}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm ${
              activeTab === "about"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            About
          </button>
        </div>

        {/* Requirement Selector - Show in all tabs except analyze and about */}
        {activeTab !== "analyze" && activeTab !== "about" && latestAnalysis && (
          <RequirementSelector
            currentAnalysisId={latestAnalysis?.id}
            onAnalysisSelect={(id, title) => {
              // Fetch the selected analysis data
              const fetchAnalysis = async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;

                  const response = await fetch("/api/analyses", {
                    headers: {
                      "Authorization": `Bearer ${session.access_token}`,
                    },
                  });

                  if (response.ok) {
                    const data = await response.json();
                    const selected = data.find((a: any) => a.id === id);
                    if (selected) {
                      const complexityLevel =
                        selected.complexityScore <= 5
                          ? "Low"
                          : selected.complexityScore <= 15
                            ? "Medium"
                            : selected.complexityScore <= 30
                              ? "High"
                              : "Very High";

                      setLatestAnalysis({
                        id: selected.id,
                        requirementText: selected.requirementText || "",
                        complexityScore: selected.complexityScore,
                        complexityLevel,
                        qaManDays: selected.qaManDays || (selected.complexityScore * 0.5),
                        devManDays: selected.devManDays || (selected.complexityScore * 0.8),
                        nodesCount: selected.nodesCount,
                        edgesCount: selected.edgesCount,
                        paths: selected.paths,
                        testScenarios: selected.testScenarios,
                      });
                    }
                  }
                } catch (err) {
                  console.error("Error fetching analysis:", err);
                }
              };
              fetchAnalysis();
            }}
          />
        )}

        {/* Content */}
        {activeTab === "analyze" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <RefineRequirement
                onRefinementComplete={handleRefinementComplete}
                onAnalyzeRequirement={handleAnalyzeFromRefinement}
              />
            </div>
            <div>
              <AnalysisResults />
            </div>
          </div>
        ) : activeTab === "history" ? (
          <AnalysisHistory
            key={String(refreshHistory)}
            onAnalysisSelect={setLatestAnalysis}
            onAnalysisDelete={(deletedId) => {
              // Clear latestAnalysis if the deleted analysis was selected
              if (latestAnalysis?.id === deletedId) {
                setLatestAnalysis(null);
              }
            }}
          />
        ) : activeTab === "user-stories" ? (
          <div>
            {latestAnalysis ? (
              <SuggestiveUserStories
                requirementText={latestAnalysis.requirementText}
                complexityLevel={latestAnalysis.complexityLevel}
                analysisId={latestAnalysis.id}
              />
            ) : (
              <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
                <p className="text-slate-600">
                  No analysis results yet. Please complete an analysis in the{" "}
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setActiveTab("history");
                        setIsTransitioning(false);
                      }, 300);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Analysis History
                  </button>{" "}
                  tab to view user stories.
                </p>
              </div>
            )}
          </div>
        ) : activeTab === "proposed-estimation" ? (
          <div>
            {latestAnalysis ? (
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">Proposed Estimation</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-slate-600 mb-1">Complexity Score</p>
                      <p className="text-3xl font-bold text-blue-600">{latestAnalysis.complexityScore}</p>
                      <p className="text-xs text-slate-600 mt-2">{latestAnalysis.complexityLevel} Complexity</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-slate-600 mb-1">Dev Estimation</p>
                      <p className="text-3xl font-bold text-green-600">~{Math.round(latestAnalysis.devManDays)}</p>
                      <p className="text-xs text-slate-600 mt-2">Man-days</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-slate-600 mb-1">QA Estimation</p>
                      <p className="text-3xl font-bold text-purple-600">~{Math.round(latestAnalysis.qaManDays)}</p>
                      <p className="text-xs text-slate-600 mt-2">Man-days</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      setActiveTab("estimation");
                      setIsTransitioning(false);
                    }, 300);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                >
                  💾 Save Estimation Details
                </button>
              </div>
            ) : (
              <div className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm">
                <p className="text-slate-600">
                  No analysis results yet. Please complete an analysis in the{" "}
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setActiveTab("history");
                        setIsTransitioning(false);
                      }, 300);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Analysis History
                  </button>{" "}
                  tab to view estimation details.
                </p>
              </div>
            )}
          </div>
        ) : activeTab === "estimation" ? (
          <EstimationHistory key={String(refreshHistory)} />
        ) : activeTab === "about" ? (
          <AboutPage />
        ) : null}
      </main>
    </div>
  );
}
