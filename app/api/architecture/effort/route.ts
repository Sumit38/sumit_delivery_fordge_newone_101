import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { DESIGN_COLUMNS, type DesignRow } from "@/lib/architecture-store";
import { normalizeEffortTasks, type ArchEffort } from "@/lib/architecture-graph";
import { writeEffortBreakdown } from "@/lib/architecture-ai";

export const maxDuration = 120;

async function loadRow(designId: string, userId: string): Promise<DesignRow | null> {
  const { data } = await supabaseServer
    .from("architecture_designs")
    .select(DESIGN_COLUMNS)
    .eq("id", designId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as DesignRow) || null;
}

async function saveEffort(row: DesignRow, userId: string, effort: ArchEffort) {
  const { data, error } = await supabaseServer
    .from("architecture_designs")
    .update({ effort })
    .eq("id", row.id)
    .eq("user_id", userId)
    .select(DESIGN_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

const designIdOf = (body: any) => (typeof body?.designId === "string" ? body.designId : "");

// POST: the AI proposes the build tasks and hours of the design (replaces any earlier hours)
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const limited = checkRateLimit(auth.userId);
  if (limited) return limited;
  try {
    const body = await request.json().catch(() => ({}));
    const row = await loadRow(designIdOf(body), auth.userId);
    if (!row) return NextResponse.json({ error: "Design not found" }, { status: 404 });
    if (row.status === "superseded") {
      return NextResponse.json({ error: "This version was replaced by a newer approved one; estimate the newer version." }, { status: 409 });
    }
    const { tasks, missingComponents } = await writeEffortBreakdown(row.design, row.answers || [], 100_000);
    const design = await saveEffort(row, auth.userId, {
      tasks,
      generatedAt: new Date().toISOString(),
      editedAt: null,
      ...(missingComponents.length ? { missingComponents } : {}),
    });
    return NextResponse.json({ design });
  } catch (err) {
    console.error("Architecture effort failed:", err);
    const message = err instanceof Error && /estimated|components/.test(err.message) ? err.message : "Could not estimate the hours. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT: saves the user's edited task list
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  try {
    const body = await request.json().catch(() => ({}));
    const row = await loadRow(designIdOf(body), auth.userId);
    if (!row) return NextResponse.json({ error: "Design not found" }, { status: 404 });
    if (row.status === "superseded") return NextResponse.json({ error: "A superseded version cannot be changed." }, { status: 409 });
    if (!row.effort) return NextResponse.json({ error: "Estimate the hours first." }, { status: 409 });

    // A task counts as edited when its text or hours differ from what was saved before
    const before = new Map(row.effort.tasks.map((t) => [t.id, t]));
    const incoming = Array.isArray(body?.tasks) ? body.tasks : [];
    const marked = incoming.map((t: any) => {
      const prev = before.get(String(t?.id));
      const changed =
        !prev || prev.task !== String(t?.task ?? "").trim() || prev.low !== Number(t?.low) || prev.likely !== Number(t?.likely) || prev.high !== Number(t?.high);
      return { ...t, edited: Boolean(prev?.edited) || changed };
    });
    const tasks = normalizeEffortTasks(marked, row.design);
    if (!tasks.length) return NextResponse.json({ error: "Keep at least one task with hours." }, { status: 400 });
    const covered = new Set(tasks.map((t) => t.component));
    const design = await saveEffort(row, auth.userId, {
      tasks,
      generatedAt: row.effort.generatedAt,
      editedAt: new Date().toISOString(),
      missingComponents: row.design.components.filter((c) => !c.external && !covered.has(c.id)).map((c) => c.name),
    });
    return NextResponse.json({ design });
  } catch (err) {
    console.error("Architecture effort save failed:", err);
    return NextResponse.json({ error: "Could not save the hours. Please try again." }, { status: 500 });
  }
}
