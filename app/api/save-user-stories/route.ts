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

    const { analysisId, stories, summary } = await request.json();

    if (!analysisId || !stories || !Array.isArray(stories)) {
      return NextResponse.json(
        { error: "Missing required fields: analysisId, stories" },
        { status: 400 }
      );
    }

    // Fetch the analysis to get requirement_id
    const { data: analysisData, error: analysisError } = await supabaseServer
      .from("complexity_results")
      .select("requirement_id")
      .eq("id", analysisId)
      .single();

    if (analysisError || !analysisData) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    // Insert into user_stories table with requirement_id
    const { data, error } = await supabaseServer
      .from("user_stories")
      .insert({
        analysis_id: analysisId,
        requirement_id: analysisData.requirement_id,
        user_id: userId,
        stories: stories,
        summary: summary || "",
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
