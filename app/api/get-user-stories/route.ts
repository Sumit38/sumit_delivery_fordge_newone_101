import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/require-user";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const { data, error } = await supabaseServer
      .from("user_stories")
      .select(
        `
        id,
        analysis_id,
        requirement_id,
        stories,
        summary,
        created_at,
        requirements(id, title)
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      if (error.code === 'PGRST205') {
        return NextResponse.json({
          success: true,
          data: [],
        });
      }
      return NextResponse.json(
        { error: "Failed to fetch user stories" },
        { status: 500 }
      );
    }

    const transformedData = data?.map((story: any) => ({
      id: story.id,
      analysis_id: story.analysis_id,
      requirement_title: story.requirements?.[0]?.title || "Untitled Requirement",
      requirement_id: story.requirements?.[0]?.id || story.requirement_id,
      stories: story.stories,
      summary: story.summary,
      created_at: story.created_at,
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
