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

    // Transform data for frontend
    const analyses = requirements
      .filter((req: any) => req.complexity_results.length > 0)
      .map((req: any) => {
        const result = req.complexity_results[0];
        const analysisData = result.analysis_data || {};
        return {
          id: req.id,
          title: req.title || "Untitled",
          complexityScore: result.complexity_score,
          testScenarios: result.test_scenarios,
          nodesCount: result.nodes_count,
          edgesCount: result.edges_count,
          paths: analysisData.alternativePaths || 1,
          createdAt: req.created_at,
          requirementText: req.document_text || "",
          actualNodes: analysisData.nodes || [],
          actualEdges: analysisData.edges || [],
          actualPaths: analysisData.paths || [],
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
