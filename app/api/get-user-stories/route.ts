import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

function extractTitleFromText(text: string): string {
  if (!text) return "Untitled Requirement";
  // Get first 60 characters or up to first period/newline
  const firstLine = text.split(/[\n\r\.]/)[0].trim().substring(0, 60);
  return firstLine || "Untitled Requirement";
}

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

    // Get all user stories for this user
    // Handles both new data (with requirement_id) and historical data (null requirement_id)
    const { data, error } = await supabaseServer
      .from("user_stories")
      .select(
        `
        id,
        analysis_id,
        requirement_id,
        stories,
        summary,
        created_at
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

    // For stories with requirement_id, fetch requirement details
    // For stories without requirement_id, fetch from complexity_results with full requirement text
    let transformedData: any[] = [];

    if (data && data.length > 0) {
      // Separate into new data (has requirement_id) and historical data (null requirement_id)
      const storiesWithReqId = data.filter((s: any) => s.requirement_id);
      const historicalStories = data.filter((s: any) => !s.requirement_id);

      // Fetch requirement details for new data
      let requirementMap: Record<string, any> = {};
      if (storiesWithReqId.length > 0) {
        const reqIds = [...new Set(storiesWithReqId.map((s: any) => s.requirement_id))];
        const { data: requirements } = await supabaseServer
          .from("requirements")
          .select("id, title, document_text")
          .in("id", reqIds);

        if (requirements) {
          requirements.forEach((req: any) => {
            // Use title if available, otherwise extract from document_text
            const displayTitle = req.title && req.title !== "Untitled Requirement"
              ? req.title
              : extractTitleFromText(req.document_text);
            requirementMap[req.id] = displayTitle;
          });
        }
      }

      // Fetch requirement details for historical data via complexity_results
      let complexityMap: Record<string, any> = {};
      if (historicalStories.length > 0) {
        const analysisIds = [...new Set(historicalStories.map((s: any) => s.analysis_id))];
        const { data: complexityResults } = await supabaseServer
          .from("complexity_results")
          .select("id, requirement_id, requirements(id, title, document_text)")
          .in("id", analysisIds);

        if (complexityResults) {
          complexityResults.forEach((cr: any) => {
            const requirement = cr.requirements?.[0];
            let displayTitle = "Untitled Requirement";

            if (requirement) {
              // Use title if available and not "Untitled Requirement", otherwise extract from text
              displayTitle = requirement.title && requirement.title !== "Untitled Requirement"
                ? requirement.title
                : extractTitleFromText(requirement.document_text);
            }

            complexityMap[cr.id] = {
              requirement_id: cr.requirement_id,
              title: displayTitle
            };
          });
        }
      }

      // Transform all stories
      transformedData = data.map((story: any) => {
        let requirement_title = "Untitled Requirement";
        let requirement_id = story.analysis_id;

        if (story.requirement_id && requirementMap[story.requirement_id]) {
          requirement_title = requirementMap[story.requirement_id];
          requirement_id = story.requirement_id;
        } else if (!story.requirement_id && complexityMap[story.analysis_id]) {
          requirement_title = complexityMap[story.analysis_id].title;
          requirement_id = complexityMap[story.analysis_id].requirement_id;
        }

        return {
          id: story.id,
          analysis_id: story.analysis_id,
          requirement_title,
          requirement_id,
          stories: story.stories,
          summary: story.summary,
          created_at: story.created_at,
        };
      });
    }

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
