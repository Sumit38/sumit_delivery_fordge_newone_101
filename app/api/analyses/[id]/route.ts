import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/require-user";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const { id } = await params;

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

    await supabaseServer
      .from("user_stories")
      .delete()
      .eq("requirement_id", id);

    await supabaseServer
      .from("project_timelines")
      .delete()
      .eq("requirement_id", id);

    await supabaseServer
      .from("complexity_results")
      .delete()
      .eq("requirement_id", id);

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
