import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/require-user";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const {
      analysisId,
      totalDays,
      qaManDays,
      devManDays,
      complexityScore,
      phases,
    } = await request.json();

    if (!analysisId || totalDays === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: analysisId, totalDays" },
        { status: 400 }
      );
    }

    const { data: owned } = await supabaseServer
      .from("requirements")
      .select("id")
      .eq("id", analysisId)
      .eq("user_id", userId)
      .single();

    if (!owned) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    const { data, error } = await supabaseServer
      .from("project_timelines")
      .insert({
        analysis_id: analysisId,
        user_id: userId,
        total_days: totalDays,
        qa_man_days: qaManDays,
        dev_man_days: devManDays,
        complexity_score: complexityScore,
        phases: phases || {},
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error("Database error:", error);

      if (error.code === "PGRST205") {
        return NextResponse.json(
          { error: "Database table not initialized. Please contact support to set up your workspace." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to save project timeline" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.[0],
      message: "Project timeline saved successfully",
    });
  } catch (error) {
    console.error("Error saving project timeline:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
