import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { buildGraphBreakdown } from "@/lib/graph-breakdown";
import { latestRound } from "@/lib/qa-status";
import { applyWording, buildPathScenarios, checkScenarioCoverage, uniqueRoutes } from "@/lib/path-scenarios";
import { writeScenarioWording } from "@/lib/scenario-wording";

export const maxDuration = 60;

// Test scenarios are built from the analysis' stored paths: exactly one positive and one
// negative scenario per path (2P). The AI only writes the wording for each one.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const limited = checkRateLimit(auth.userId);
  if (limited) return limited;

  try {
    const body = await request.json();
    const requirementId = typeof body?.requirementId === "string" ? body.requirementId : "";
    if (!requirementId) {
      return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
    }

    const { data: requirement, error: readError } = await supabaseServer
      .from("requirements")
      .select("id, title, document_text, complexity_results (nodes_count, edges_count, complexity_score, analysis_data)")
      .eq("id", requirementId)
      .eq("user_id", auth.userId)
      .single();
    if (readError || !requirement || !requirement.complexity_results?.[0]) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const result = requirement.complexity_results[0];
    const data = result.analysis_data || {};
    const nodes: string[] = Array.isArray(data.nodes) ? data.nodes.map(String) : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    const routes = uniqueRoutes(data.paths);
    if (routes.length === 0 || edges.length === 0) {
      return NextResponse.json(
        { error: "This analysis has no stored paths to build scenarios from. Please re-run the analysis." },
        { status: 422 }
      );
    }

    const n = result.nodes_count;
    const e = result.edges_count;
    const p = data.alternativePaths || routes.length;
    const complexityScore = result.complexity_score;
    console.log(`🧪 Building scenarios from ${routes.length} stored paths (P=${p}, 2P=${2 * p})`);

    // 1. Structure from the paths (code): 2 scenarios per path
    let scenarios = buildPathScenarios(routes, edges);

    // 2. Wording from the AI, per batch of paths; a failed batch keeps the generated wording
    const requirementText = latestRound(String(requirement.document_text || "")).slice(0, 12_000);
    scenarios = applyWording(scenarios, await writeScenarioWording(requirementText, scenarios));
    const aiWorded = scenarios.filter((s) => s.wording === "AI").length;
    console.log(`✅ ${scenarios.length} scenarios (${aiWorded} worded by AI, ${scenarios.length - aiWorded} from the path text)`);

    // 3. Coverage check against the graph
    const breakdown = buildGraphBreakdown(nodes, edges, routes);
    const coverage = checkScenarioCoverage(scenarios, routes, breakdown.paths.uncoveredList);

    return NextResponse.json({
      success: true,
      scenarios,
      coverage,
      // Stored P can differ from the listed paths in some older analyses; scenarios follow the listed paths
      pathCountNote:
        p !== routes.length
          ? `The analysis states P = ${p}, but ${routes.length} distinct paths are stored; scenarios follow the ${routes.length} stored paths.`
          : null,
      complexity: { n, e, p, complexityScore },
    });
  } catch (error) {
    console.error("❌ Error building scenarios:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to build scenarios" },
      { status: 500 }
    );
  }
}
