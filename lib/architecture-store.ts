// Database access for architecture designs (server only). Every query checks the user.

import { supabaseServer } from "@/lib/supabase-server";
import { latestRound } from "@/lib/qa-status";
import { graphFacts, type ArchAnswer, type ArchDesign, type ArchEffort, type GraphFacts } from "@/lib/architecture-graph";

export const DESIGN_COLUMNS = "id, requirement_id, version, status, answers, design, feedback, effort, created_at, approved_at";

export interface DesignRow {
  id: string;
  requirement_id: string;
  version: number;
  status: "draft" | "approved" | "superseded";
  answers: ArchAnswer[];
  design: ArchDesign;
  feedback: string | null;
  effort: ArchEffort | null;
  created_at: string;
  approved_at: string | null;
}

export async function loadAnalysisForArchitecture(
  requirementId: string,
  userId: string
): Promise<{ title: string; requirement: string; facts: GraphFacts } | null> {
  const { data } = await supabaseServer
    .from("requirements")
    .select("id, title, document_text, complexity_results (analysis_data)")
    .eq("id", requirementId)
    .eq("user_id", userId)
    .maybeSingle();
  const analysis = (data as any)?.complexity_results?.[0]?.analysis_data;
  if (!data || !analysis) return null;
  const facts = graphFacts(analysis.nodes, analysis.edges, analysis.paths);
  if (!facts) return null;
  return { title: String((data as any).title || "Solution"), requirement: latestRound(String((data as any).document_text || "")), facts };
}

export async function listDesigns(requirementId: string, userId: string): Promise<DesignRow[]> {
  const { data, error } = await supabaseServer
    .from("architecture_designs")
    .select("id, requirement_id, version, status, answers, design, feedback, effort, created_at, approved_at")
    .eq("requirement_id", requirementId)
    .eq("user_id", userId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data || []) as DesignRow[];
}

export async function approvedDesign(requirementId: string, userId: string): Promise<DesignRow | null> {
  const { data } = await supabaseServer
    .from("architecture_designs")
    .select("id, requirement_id, version, status, answers, design, feedback, effort, created_at, approved_at")
    .eq("requirement_id", requirementId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DesignRow) || null;
}

export function sanitizeAnswers(v: unknown): ArchAnswer[] {
  const s = (x: unknown, max = 500) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return (Array.isArray(v) ? v : [])
    .slice(0, 15)
    .map((a: any) => ({
      id: s(a?.id, 8).toUpperCase(),
      topic: s(a?.topic, 60),
      question: s(a?.question),
      answer: (Array.isArray(a?.answer) ? a.answer : []).map((x: unknown) => s(x, 200)).filter(Boolean).slice(0, 8),
      ...(s(a?.note) ? { note: s(a?.note) } : {}),
    }))
    .filter((a) => /^Q\d+$/.test(a.id) && a.question);
}
