import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { loadAnalysisForArchitecture } from "@/lib/architecture-store";
import { writeArchitectureQuestions } from "@/lib/architecture-ai";

export const maxDuration = 120;

// Architecture questions drawn from the analysis graph of one requirement
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const limited = checkRateLimit(auth.userId);
  if (limited) return limited;
  try {
    const body = await request.json().catch(() => ({}));
    const requirementId = typeof body?.requirementId === "string" ? body.requirementId : "";
    if (!requirementId) return NextResponse.json({ error: "requirementId is required" }, { status: 400 });

    const loaded = await loadAnalysisForArchitecture(requirementId, auth.userId);
    if (!loaded) {
      return NextResponse.json({ error: "This analysis has no stored process graph. Please analyse the requirement again." }, { status: 404 });
    }
    const questions = await writeArchitectureQuestions(loaded.requirement, loaded.facts, 100_000);
    if (!questions.length) throw new Error("No questions came back");
    const { facts } = loaded;
    return NextResponse.json({
      questions,
      graph: {
        steps: facts.steps.length,
        decisions: facts.decisions,
        points: facts.totalPoints,
        kinds: Object.fromEntries(Object.entries(facts.byKind).map(([k, list]) => [k, list.length])),
        labels: facts.steps.map((s) => s.label),
      },
    });
  } catch (err) {
    console.error("Architecture questions failed:", err);
    return NextResponse.json({ error: "Could not prepare the architecture questions. Please try again." }, { status: 500 });
  }
}
