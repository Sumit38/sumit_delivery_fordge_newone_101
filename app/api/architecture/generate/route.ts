import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { listDesigns, loadAnalysisForArchitecture, sanitizeAnswers } from "@/lib/architecture-store";
import { writeArchitectureDesign } from "@/lib/architecture-ai";

export const maxDuration = 120;

// Writes a new design version (draft) from the answers, or from the latest version plus the
// user's requested changes
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const limited = checkRateLimit(auth.userId);
  if (limited) return limited;
  try {
    const body = await request.json().catch(() => ({}));
    const requirementId = typeof body?.requirementId === "string" ? body.requirementId : "";
    if (!requirementId) return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
    const feedback = String(body?.feedback || "").trim().slice(0, 3000);

    const loaded = await loadAnalysisForArchitecture(requirementId, auth.userId);
    if (!loaded) {
      return NextResponse.json({ error: "This analysis has no stored process graph. Please analyse the requirement again." }, { status: 404 });
    }
    const existing = await listDesigns(requirementId, auth.userId);
    const previous = existing[0] || null;
    const answers = Array.isArray(body?.answers) ? sanitizeAnswers(body.answers) : previous?.answers || [];
    if (!answers.length) return NextResponse.json({ error: "Please answer the architecture questions first." }, { status: 400 });

    const design = await writeArchitectureDesign({
      requirement: loaded.requirement,
      title: loaded.title,
      facts: loaded.facts,
      answers,
      feedback: feedback || undefined,
      previous: feedback ? previous?.design : null,
      timeout: 105_000,
    });

    const { data, error } = await supabaseServer
      .from("architecture_designs")
      .insert({
        requirement_id: requirementId,
        user_id: auth.userId,
        version: (previous?.version || 0) + 1,
        status: "draft",
        answers,
        design,
        feedback: feedback || null,
      })
      .select("id, requirement_id, version, status, answers, design, feedback, effort, created_at, approved_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ design: data });
  } catch (err) {
    console.error("Architecture design failed:", err);
    const message = err instanceof Error && /without components/.test(err.message) ? err.message : "Could not write the architecture design. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
