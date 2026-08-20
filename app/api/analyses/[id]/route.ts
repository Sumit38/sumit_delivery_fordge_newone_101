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

    // Verify the analysis belongs to the user before deleting
    const { data: requirement } = await supabaseServer
      .from("requirements")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!requirement) {
      return NextResponse.json(
        { error: "Analysis not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete in correct order (children first, then parent)
    // 1. Delete user stories linked to this analysis
    await supabaseServer
      .from("user_stories")
      .delete()
      .eq("analysis_id", id);

    // 2. Delete project timelines linked to this analysis
    await supabaseServer
      .from("project_timelines")
      .delete()
      .eq("analysis_id", id);

    // 3. Delete complexity results
    await supabaseServer
      .from("complexity_results")
      .delete()
      .eq("requirement_id", id);

    // 4. Finally delete the requirement itself
    const { error } = await supabaseServer
      .from("requirements")
      .delete()
      .eq("id", id);

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
