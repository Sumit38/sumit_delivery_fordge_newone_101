import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { calculateEstimation } from "@/lib/estimation-calculator";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [1/4] Validating estimation request...");

    // Get auth header
    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;

    try {
      const token = authHeader?.replace("Bearer ", "");
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const parts = token.split(".");
      if (parts.length !== 3) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const decoded = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8")
      );
      userId = decoded.sub || null;

      console.log("✅ [1/4] Auth success. UserId:", userId);
    } catch (authError) {
      console.error("⚠️ [1/4] Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

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

    console.log("✅ [2/4] Request validation successful");
    console.log("🔍 [3/4] Calculating estimation...");

    // Calculate estimation
    const estimation = calculateEstimation(complexityScore, estimationAnswers);

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
