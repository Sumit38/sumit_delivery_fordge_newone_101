import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/require-user";
import { buildGraphBreakdown, cleanFormulaText } from "@/lib/graph-breakdown";
import { ambiguityNotes } from "@/lib/qa-status";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const requirementId = searchParams.get("requirementId");

    if (!requirementId) {
      return NextResponse.json(
        { error: "Requirement ID is required" },
        { status: 400 }
      );
    }

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

    const storedNodes = Array.isArray(analysisData.nodes) ? analysisData.nodes : [];
    const storedEdges = Array.isArray(analysisData.edges) ? analysisData.edges : [];
    const storedPaths: unknown[] = Array.isArray(analysisData.paths) ? analysisData.paths : [];
    // Worked out from the stored graph, so older analyses get the breakdown too
    const breakdown = buildGraphBreakdown(storedNodes, storedEdges, storedPaths);
    // Conflicting Q&A answers are shown first under "Checks"
    breakdown.notes = [...ambiguityNotes(analysisData.ambiguities), ...breakdown.notes];
    // Show each route once; older records can list the same route twice or a heading as a "path"
    const seenRoutes = new Set<string>();
    const displayPaths = storedPaths.filter((path) => {
      if (!Array.isArray(path) || path.length < 2) return false;
      const key = path.map((s) => String(s).replace(/\s+/g, " ").trim()).join("|");
      if (seenRoutes.has(key)) return false;
      seenRoutes.add(key);
      return true;
    });

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
        nodes: storedNodes,
        edges: storedEdges,
        paths: displayPaths,
        // Steps where the graph branches (more than one way out)
        decisionPoints: breakdown.nodes.decisionList,
        breakdown,
      },
      reasoning: {
        analysis: cleanFormulaText(analysisData.analysis || ""),
        detailed: cleanFormulaText(analysisData.reasoning || ""),
        confidenceScore: analysisData.confidenceScore || 0,
        confidenceReason: analysisData.confidenceReason || "",
      },
      // Only present for an analysis that combines several documents
      ...(Array.isArray(analysisData.mergedFrom)
        ? {
            merge: {
              documents: analysisData.mergedFrom,
              sharedSteps: Array.isArray(analysisData.sharedSteps) ? analysisData.sharedSteps : [],
            },
          }
        : {}),
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
