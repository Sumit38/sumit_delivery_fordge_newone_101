import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    // Get auth from request
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    try {
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      // Decode JWT to extract user ID
      const parts = token.split('.');
      if (parts.length !== 3) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const decoded = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );
      userId = decoded.sub || null;

      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    } catch (authError) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all requirements and their analysis results
    const { data: requirements, error: reqError } = await supabaseServer
      .from("requirements")
      .select(
        `
        id,
        title,
        document_text,
        created_at,
        complexity_results (
          id,
          nodes_count,
          edges_count,
          complexity_score,
          test_scenarios,
          analysis_data
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (reqError) {
      return NextResponse.json(
        { error: "Failed to fetch analyses" },
        { status: 500 }
      );
    }

    // Get estimations for all requirements
    const { data: estimations, error: estError } = await supabaseServer
      .from("estimations")
      .select("*")
      .eq("user_id", userId);

    if (estError) {
      console.error("Error fetching estimations:", estError);
      // Continue without estimations data
    }

    // Create a map of requirement_id -> latest estimation
    const estimationMap = new Map();
    if (estimations) {
      estimations.forEach((est: any) => {
        const key = est.requirement_id;
        if (!estimationMap.has(key) || new Date(est.created_at) > new Date(estimationMap.get(key).created_at)) {
          estimationMap.set(key, est);
        }
      });
    }

    // Transform data for frontend
    const analyses = requirements
      .filter((req: any) => req.complexity_results.length > 0)
      .map((req: any) => {
        const result = req.complexity_results[0];
        const analysisData = result.analysis_data || {};
        const estimation = estimationMap.get(req.id);

        return {
          id: req.id,
          analysisResultId: result.id,
          title: req.title || "Untitled",
          complexityScore: result.complexity_score,
          testScenarios: result.test_scenarios,
          nodesCount: result.nodes_count,
          edgesCount: result.edges_count,
          paths: analysisData.alternativePaths || 1,
          createdAt: req.created_at,
          requirementText: req.document_text || "",
          estimationData: estimation ? {
            baseEffort: estimation.base_effort || 0,
            totalEffort: estimation.total_effort || 0,
            timeline: estimation.timeline_weeks || 0,
            teamSize: estimation.team_size || 3,
            costPerHour: estimation.cost_per_hour,
            totalBudget: estimation.total_budget,
            riskLevel: estimation.risk_level,
            skillLevel: estimation.skill_level,
            techFamiliarity: estimation.tech_familiarity,
            testingLevel: estimation.testing_level,
            confidence: estimation.confidence_score,
          } : undefined,
        };
      });

    return NextResponse.json(analyses);
  } catch (error) {
    console.error("Error fetching analyses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
