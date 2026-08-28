import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    // Get auth
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    const userId = decoded.sub;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get requirement ID from query params
    const { searchParams } = new URL(request.url);
    const requirementId = searchParams.get("requirementId");

    if (!requirementId) {
      return NextResponse.json(
        { error: "Requirement ID is required" },
        { status: 400 }
      );
    }

    // Get requirement with full analysis
    const { data: requirement, error: reqError } = await supabaseServer
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
      .eq("id", requirementId)
      .eq("user_id", userId)
      .single();

    if (reqError || !requirement) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    const result = requirement.complexity_results[0];
    const analysisData = result.analysis_data || {};

    // Build comprehensive analysis details
    const analysisDetails = {
      requirement: {
        id: requirement.id,
        title: requirement.title,
        text: requirement.document_text,
        createdAt: requirement.created_at,
      },
      analysis: {
        id: result.id,
        complexityScore: result.complexity_score,
        nodesCount: result.nodes_count,
        edgesCount: result.edges_count,
        testScenarios: result.test_scenarios,
        paths: analysisData.alternativePaths || 1,
      },
      metrics: {
        calculation: `M = E - N + 2P = ${result.edges_count} - ${result.nodes_count} + 2(${analysisData.alternativePaths || 1}) = ${result.complexity_score}`,
        nodes: analysisData.nodes || [],
        edges: analysisData.edges || [],
        paths: analysisData.pathsList || [],
        decisionPoints: analysisData.decisionPoints || [],
      },
      reasoning: {
        analysis: analysisData.analysis || "",
        detailed: analysisData.reasoning || "",
        confidenceScore: analysisData.confidenceScore || 0,
        confidenceReason: analysisData.confidenceReason || "",
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: analysisDetails,
    });
  } catch (error) {
    console.error("Error fetching analysis details:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
