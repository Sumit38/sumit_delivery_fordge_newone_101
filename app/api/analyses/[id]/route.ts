import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    const userId = decoded.sub;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // First try to find by complexity_results ID (new API format)
    const { data: analysis, error: analysisError } = await supabaseServer
      .from("complexity_results")
      .select("requirement_id")
      .eq("id", id)
      .single();

    let requirementId = analysis?.requirement_id;

    // If not found in complexity_results, try requirement ID (backward compatibility)
    if (!requirementId || analysisError) {
      const { data: requirement, error: reqError } = await supabaseServer
        .from("requirements")
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!requirement || reqError) {
        return NextResponse.json(
          { error: "Analysis not found or unauthorized" },
          { status: 404 }
        );
      }
      requirementId = requirement.id;
    }

    // Delete in correct order (children first, then parent)
    // 1. Delete user stories linked to this analysis
    await supabaseServer
      .from("user_stories")
      .delete()
      .eq("requirement_id", requirementId);

    // 2. Delete project timelines linked to this analysis
    await supabaseServer
      .from("project_timelines")
      .delete()
      .eq("requirement_id", requirementId);

    // 3. Delete complexity results
    await supabaseServer
      .from("complexity_results")
      .delete()
      .eq("requirement_id", requirementId);

    // 4. Finally delete the requirement itself
    const { error } = await supabaseServer
      .from("requirements")
      .delete()
      .eq("id", requirementId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete analysis" },
      { status: 500 }
    );
  }
}
