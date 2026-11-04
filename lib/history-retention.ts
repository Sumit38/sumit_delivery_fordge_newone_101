import { supabaseServer } from "@/lib/supabase-server";

// Keeps each user's history small: only the latest N items per tab are kept
// (analyses, estimations, user stories, project timelines). Runs after a new
// item is saved. Set HISTORY_KEEP_LATEST=0 to switch it off.
export const HISTORY_KEEP_LATEST = (() => {
  const raw = process.env.HISTORY_KEEP_LATEST;
  const n = raw === undefined || raw === "" ? 5 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5;
})();

// A requirement saved a moment ago may still be waiting for its analysis result
// (e.g. several documents analysed at once), so it is never removed this early.
const IN_PROGRESS_GRACE_MS = 15 * 60 * 1000;

interface RequirementRow {
  id: string;
  created_at: string;
  complexity_results?: Array<{ id: string }> | null;
}

// Which requirements to remove: everything except the latest `keep` analyses.
// A requirement without an analysis result is removed only once it is old
// enough that it can't still be in progress.
export function requirementsToPrune(rows: RequirementRow[], keep: number, now = Date.now()): string[] {
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const analysed = sorted.filter((r) => (r.complexity_results?.length || 0) > 0);
  const keepIds = new Set(analysed.slice(0, keep).map((r) => r.id));
  return sorted
    .filter((r) => !keepIds.has(r.id))
    .filter((r) => (r.complexity_results?.length || 0) > 0 || now - new Date(r.created_at).getTime() > IN_PROGRESS_GRACE_MS)
    .map((r) => r.id);
}

// Ids of rows beyond the latest `keep` (rows sorted newest first by the caller)
export function beyondLatest(rows: Array<{ id: string }>, keep: number): string[] {
  return rows.slice(keep).map((r) => r.id);
}

async function pruneTable(table: "estimations" | "user_stories" | "project_timelines", userId: string, keep: number) {
  const { data, error } = await supabaseServer
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return 0;
  const ids = beyondLatest(data as Array<{ id: string }>, keep);
  if (!ids.length) return 0;
  await supabaseServer.from(table).delete().in("id", ids).eq("user_id", userId);
  return ids.length;
}

// Never throws: a cleanup problem must not fail the save that triggered it.
export async function pruneUserHistory(userId: string, keep = HISTORY_KEEP_LATEST): Promise<void> {
  if (!userId || keep <= 0) return;
  try {
    const { data: rows, error } = await supabaseServer
      .from("requirements")
      .select("id, created_at, complexity_results (id)")
      .eq("user_id", userId);
    if (error) throw error;

    const removeIds = requirementsToPrune((rows || []) as RequirementRow[], keep);
    if (removeIds.length) {
      // Timelines point at the requirement without a foreign key, so remove them first;
      // results, estimations and user stories go with the requirement (cascade).
      await supabaseServer.from("project_timelines").delete().eq("user_id", userId).in("analysis_id", removeIds);
      await supabaseServer.from("requirements").delete().eq("user_id", userId).in("id", removeIds);
    }

    const removed = {
      analyses: removeIds.length,
      estimations: await pruneTable("estimations", userId, keep),
      userStories: await pruneTable("user_stories", userId, keep),
      timelines: await pruneTable("project_timelines", userId, keep),
    };
    if (Object.values(removed).some(Boolean)) {
      console.log(`🧹 History kept to latest ${keep} per tab; removed`, removed);
    }
  } catch (err) {
    console.warn("⚠️ History cleanup skipped:", err instanceof Error ? err.message : err);
  }
}
