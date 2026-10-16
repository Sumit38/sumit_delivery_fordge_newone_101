import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/require-user";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const { analysisId, stories, summary } = await request.json();

    if (!analysisId || !stories || !Array.isArray(stories)) {
      return NextResponse.json(
        { error: "Missing required fields: analysisId, stories" },
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

    const { data: analysisData, error: analysisError } = await supabaseServer
      .from("complexity_results")
      .select("id")
      .eq("requirement_id", analysisId)
      .single();

    if (analysisError || !analysisData) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    const complexityResultsId = analysisData.id;

    const { data, error } = await supabaseServer
      .from("user_stories")
      .insert({
        analysis_id: complexityResultsId,
        requirement_id: analysisId,
        user_id: userId,
        stories: stories,
        summary: summary || "",
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
        { error: "Failed to save user stories" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.[0],
      message: "User stories saved successfully",
    });
  } catch (error) {
    console.error("Error saving user stories:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
