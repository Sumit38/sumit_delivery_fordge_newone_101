import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { calculateEstimation } from "@/lib/estimation-calculator";
import { pruneUserHistory } from "@/lib/history-retention";
import { approvedDesign } from "@/lib/architecture-store";
import { effortSizing, technologyKey, traceability } from "@/lib/architecture-graph";
import { FAMILIARITY_FACTOR } from "@/lib/estimation-team";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [1/4] Validating estimation request...");

    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const limited = checkRateLimit(userId);
    if (limited) return limited;

    // Parse request body
    console.log("🔍 [2/4] Parsing request body...");
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("❌ [2/4] Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { requirementId, complexityScore, estimationAnswers } = body;

    if (!requirementId || !complexityScore || !estimationAnswers) {
      return NextResponse.json(
        { error: "Missing required fields: requirementId, complexityScore, estimationAnswers" },
        { status: 400 }
      );
    }

    // An estimation is made on an approved architecture design only
    const approved = await approvedDesign(requirementId, userId);
    if (!approved) {
      return NextResponse.json(
        { error: "Please approve an architecture design for this requirement first (Architecture tab).", needsArchitecture: true },
        { status: 409 }
      );
    }
    // ...with its build hours estimated (Architecture tab → Estimate hours)
    if (!approved.effort?.tasks?.length) {
      return NextResponse.json(
        { error: `Please estimate the hours of approved architecture v${approved.version} first (Architecture tab).`, needsHours: true },
        { status: 409 }
      );
    }
    // Familiarity is answered per technology; each component takes its technology's answer
    const byTech: Record<string, unknown> =
      estimationAnswers.techByTechnology && typeof estimationAnswers.techByTechnology === "object" ? estimationAnswers.techByTechnology : {};
    const familiarity: Record<string, string> = {};
    for (const c of approved.design.components) {
      const level = String(byTech[technologyKey(c)] ?? "");
      familiarity[c.id] = level in FAMILIARITY_FACTOR ? level : "Moderately Familiar";
    }
    const architecture = {
      designId: approved.id,
      version: approved.version,
      sizing: effortSizing(approved.design, approved.effort),
      familiarity,
      evidence: {
        risks: approved.design.risks || [],
        skippedAnswers: (approved.answers || []).filter((a) => !a.answer?.length).length,
        openQuestions: (approved.design.openQuestions || []).length,
        unassignedSteps: traceability(approved.design).unassigned.length,
      },
    };

    console.log("✅ [2/4] Request validation successful");
    console.log("🔍 [3/4] Calculating estimation...");

    // Calculate estimation
    // paths / testScenarios are optional; they size the testing effort when the
    // team and testing questions were answered.
    const toCount = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 10000) : undefined;
    };
    const estimation = calculateEstimation(complexityScore, estimationAnswers, {
      paths: toCount(body.paths),
      testScenarios: toCount(body.testScenarios),
      architecture,
    });

    console.log("✅ [3/4] Estimation calculated successfully");
    console.log("🔍 [4/4] Saving to database...");

    // Save estimation to database
    const { data: estimationData, error: estimationError } = await supabaseServer
      .from("estimations")
      .insert({
        requirement_id: requirementId,
        user_id: userId,
        complexity_score: complexityScore,
        total_effort: estimation.totalEffort,
        timeline_weeks: estimation.timeline,
        team_size: estimation.teamSize,
        total_budget: estimation.totalBudget,
        cost_per_hour: estimation.costPerHour,
        risk_level: estimation.riskLevel,
        skill_level: estimation.skillLevel,
        tech_familiarity: estimation.techFamiliarity,
        testing_level: estimation.testingLevel,
        answers: estimationAnswers,
        breakdown: estimation.breakdown,
        assumptions: estimation.assumptions,
        confidence_score: estimation.confidence,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (estimationError) {
      console.error("❌ [4/4] Failed to save estimation:", estimationError);
      throw estimationError;
    }

    console.log("✅ [4/4] Estimation saved successfully");
    await pruneUserHistory(userId);
    console.log("✅ ✅ ✅ ALL STEPS COMPLETED ✅ ✅ ✅");

    return NextResponse.json({
      success: true,
      estimationId: estimationData.id,
      estimation: {
        baseEffort: estimation.baseEffort,
        totalEffort: estimation.totalEffort,
        timeline: estimation.timeline,
        teamSize: estimation.teamSize,
        costPerHour: estimation.costPerHour,
        totalBudget: estimation.totalBudget,
        riskLevel: estimation.riskLevel,
        skillLevel: estimation.skillLevel,
        techFamiliarity: estimation.techFamiliarity,
        testingLevel: estimation.testingLevel,
        confidence: estimation.confidence,
        breakdown: estimation.breakdown,
        assumptions: estimation.assumptions,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("❌ ❌ ❌ UNCAUGHT ERROR ❌ ❌ ❌");
    console.error("Message:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate estimation",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
