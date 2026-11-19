import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { supabaseServer } from "@/lib/supabase-server";

// Approves one design version; an earlier approved version of the same requirement
// becomes "superseded" (kept, not deleted)
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  try {
    const body = await request.json().catch(() => ({}));
    const designId = typeof body?.designId === "string" ? body.designId : "";
    if (!designId) return NextResponse.json({ error: "designId is required" }, { status: 400 });

    const { data: row } = await supabaseServer
      .from("architecture_designs")
      .select("id, requirement_id, status")
      .eq("id", designId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Design not found" }, { status: 404 });

    await supabaseServer
      .from("architecture_designs")
      .update({ status: "superseded" })
      .eq("requirement_id", row.requirement_id)
      .eq("user_id", auth.userId)
      .eq("status", "approved")
      .neq("id", designId);
    const { data, error } = await supabaseServer
      .from("architecture_designs")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", designId)
      .eq("user_id", auth.userId)
      .select("id, requirement_id, version, status, answers, design, feedback, effort, created_at, approved_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ design: data });
  } catch (err) {
    console.error("Architecture approve failed:", err);
    return NextResponse.json({ error: "Could not approve the design. Please try again." }, { status: 500 });
  }
}
