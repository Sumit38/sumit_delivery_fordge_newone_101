import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/require-user";
import { mergeAnalyses, type MergeInputDocument } from "@/lib/merge-analyses";
import { pruneUserHistory } from "@/lib/history-retention";
import { buildGraphBreakdown } from "@/lib/graph-breakdown";
import { matchSteps } from "@/lib/step-matching";
import { compareDocuments } from "@/lib/merge-compare";
import { combineDocumentDetails } from "@/lib/merge-details";

export const maxDuration = 60;

// Combines 2-3 requirement documents that were already analysed (and saved)
// one by one, and saves the combined analysis as a new history entry.
// The graphs are joined from what is stored; one small AI call per extra document
// suggests steps that are worded differently but mean the same (checked by code).
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const ids: string[] = Array.isArray(body?.requirementIds)
      ? [...new Set<string>(body.requirementIds.map(String))]
      : [];
    if (ids.length < 2 || ids.length > 3) {
      return NextResponse.json({ error: "Select 2 or 3 analysed documents to combine" }, { status: 400 });
    }

    const { data: rows, error: readError } = await supabaseServer
      .from("requirements")
      .select("id, title, document_text, complexity_results (nodes_count, edges_count, complexity_score, analysis_data)")
      .in("id", ids)
      .eq("user_id", userId);

    if (readError) {
      return NextResponse.json({ error: "Could not read the analyses", details: readError.message }, { status: 500 });
    }

    // Keep the order the user chose
    const ordered = ids.map((id) => (rows || []).find((row: any) => String(row.id) === id));
    if (ordered.some((row) => !row || !row.complexity_results?.[0])) {
      return NextResponse.json({ error: "One of the documents has no saved analysis" }, { status: 404 });
    }

    const docs: MergeInputDocument[] = ordered.map((row: any) => {
      const result = row.complexity_results[0];
      const data = result.analysis_data || {};
      return {
        requirementId: String(row.id),
        title: row.title || "Untitled Requirement",
        nodes: Array.isArray(data.nodes) ? data.nodes.map(String) : [],
        edges: Array.isArray(data.edges) ? data.edges : [],
        paths: Array.isArray(data.paths) ? data.paths.filter(Array.isArray) : [],
        nodesCount: result.nodes_count,
        edgesCount: result.edges_count,
        pathsCount: data.alternativePaths,
        complexityScore: result.complexity_score,
      };
    });

    const emptyDoc = docs.find((doc) => doc.nodes.length === 0 || doc.edges.length === 0);
    if (emptyDoc) {
      return NextResponse.json(
        { error: `"${emptyDoc.title}" has no stored graph to combine. Please re-run its analysis.` },
        { status: 422 }
      );
    }

    const stepMatching = await matchSteps(docs);
    const merged = mergeAnalyses(docs, stepMatching.aliases);
    const comparison = compareDocuments(
      docs.map((d) => d.title),
      merged.edges,
      merged.paths,
      merged.origins
    );
    const graphBreakdown = buildGraphBreakdown(merged.nodes, merged.edges, merged.paths);
    // Each document's own way of analysis, confidence, reasoning and findings
    const details = combineDocumentDetails(
      ordered.map((row: any) => ({ title: row.title || "Untitled Requirement", data: row.complexity_results[0].analysis_data }))
    );
    const documentSummaries = merged.documents.map((d, i) => ({
      ...d,
      confidenceScore: details.documents[i].confidenceScore,
      analysisMode: details.documents[i].analysisMode,
    }));

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : `Combined: ${docs.map((d) => d.title).join(" + ")}`.slice(0, 200);

    const documentText = ordered
      .map((row: any, i: number) => `## Document ${i + 1}: ${row.title || "Untitled"}\n\n${row.document_text || ""}`)
      .join("\n\n");

    const breakdown = merged.documents
      .map((d, i) => `Document ${i + 1} "${d.title}": N=${d.n}, E=${d.e}, P=${d.p}, M=${d.m}`)
      .join("\n");
    const analysisText = `Combined analysis of ${docs.length} documents. N=${merged.n}, E=${merged.e}, P=${merged.p} → M = ${merged.e} - ${merged.n} + 2(${merged.p}) = ${merged.m}`;
    const reasoning = [
      `The documents were analysed one by one, then their control-flow graphs were joined.`,
      `Start and End are shared. Steps with the same name in more than one document are counted once` +
        (merged.sharedSteps.length ? ` (${merged.sharedSteps.length} shared: ${merged.sharedSteps.join(", ")}).` : ` (none found).`),
      stepMatching.matches.length
        ? `${stepMatching.matches.length} differently worded step(s) were matched as the same step: ${stepMatching.matches
            .map((m) => `"${m.step}" = "${m.matchedStep}"`)
            .join("; ")}.`
        : stepMatching.failed
          ? `Step matching was not available, so only exact step names were matched.`
          : `No differently worded steps were matched.`,
      `Repeated edges and paths are counted once.`,
      ``,
      breakdown,
      ``,
      `Combined: ${merged.calculation}`,
      ``,
      `How each document was analysed:`,
      ``,
      details.reasoningSection,
    ].join("\n");

    const { data: requirement, error: reqError } = await supabaseServer
      .from("requirements")
      .insert({ user_id: userId, document_text: documentText, title })
      .select()
      .single();
    if (reqError || !requirement) {
      return NextResponse.json({ error: "Failed to save the combined analysis", details: reqError?.message }, { status: 500 });
    }

    const confidenceScore = details.confidenceScore;

    const { data: result, error: resultError } = await supabaseServer
      .from("complexity_results")
      .insert({
        requirement_id: requirement.id,
        nodes_count: merged.n,
        edges_count: merged.e,
        complexity_score: merged.m,
        test_scenarios: merged.testScenarios,
        analysis_data: {
          nodes: merged.nodes,
          edges: merged.edges,
          paths: merged.paths,
          decisionPoints: graphBreakdown.nodes.decisionList,
          breakdown: graphBreakdown,
          alternativePaths: merged.p,
          analysis: analysisText,
          reasoning,
          confidenceScore,
          confidenceReason: details.confidenceReason,
          ...(details.analysisMode ? { analysisMode: details.analysisMode } : {}),
          ambiguities: details.ambiguities,
          requirementGaps: details.requirementGaps,
          mergedFrom: documentSummaries,
          sharedSteps: merged.sharedSteps,
          origins: merged.origins,
          stepMatches: stepMatching.matches,
          comparison,
        },
      })
      .select()
      .single();
    if (resultError || !result) {
      // Don't leave a requirement without a result behind
      await supabaseServer.from("requirements").delete().eq("id", requirement.id).eq("user_id", userId);
      return NextResponse.json({ error: "Failed to save the combined analysis", details: resultError?.message }, { status: 500 });
    }

    await pruneUserHistory(userId);

    return NextResponse.json({
      success: true,
      requirementId: String(requirement.id),
      resultId: String(result.id),
      title,
      analysis: {
        nodesCount: merged.n,
        edgesCount: merged.e,
        paths: merged.p,
        complexityScore: merged.m,
        testScenarios: merged.testScenarios,
        calculation: merged.calculation,
        nodes: merged.nodes,
        edges: merged.edges,
        pathsList: merged.paths,
        sharedSteps: merged.sharedSteps,
        documents: documentSummaries,
        origins: merged.origins,
        stepMatches: stepMatching.matches,
        comparison,
        reasoning,
        confidenceScore,
        confidenceReason: details.confidenceReason,
        analysisMode: details.analysisMode,
        requirementGaps: details.requirementGaps,
        ambiguities: details.ambiguities,
      },
    });
  } catch (error) {
    console.error("Merge analyses error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
