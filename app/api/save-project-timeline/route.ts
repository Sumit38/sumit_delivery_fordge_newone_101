import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    // Extract user ID from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Decode JWT to get user ID
    const parts = token.split(".");
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    const userId = decoded.sub;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    // Insert into project_timelines table
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

      // Handle missing table gracefully (first time users)
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
