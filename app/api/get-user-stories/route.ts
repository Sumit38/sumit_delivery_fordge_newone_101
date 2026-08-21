import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    // Get all user stories for this user with requirement details
    const { data, error } = await supabaseServer
      .from("user_stories")
      .select(
        `
        id,
        analysis_id,
        stories,
        summary,
        created_at,
        requirements(id, title, document_text)
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

    // Transform data to include requirement title
    const transformedData = data?.map((story: any) => ({
      id: story.id,
      analysisId: story.analysis_id,
      requirementTitle: story.requirements?.[0]?.title || "Untitled Requirement",
      requirementId: story.requirements?.[0]?.id || story.analysis_id,
      stories: story.stories,
      summary: story.summary,
      createdAt: story.created_at,
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
