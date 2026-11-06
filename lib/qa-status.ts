// Q&A status for the three analysis modes (guided / hybrid / direct) and the
// ambiguity check. Pure functions, no AI calls.

// Refine adds earlier rounds under this marker for traceability. Answers are
// counted from the latest round only, so older rounds can't inflate the count.
const HISTORY_MARKER = /\n-{3,}\s*\n\s*Generated from raw requirement:/i;

export function latestRound(text: string): string {
  const match = String(text ?? "").match(HISTORY_MARKER);
  return match && match.index !== undefined ? text.slice(0, match.index).trimEnd() : String(text ?? "");
}

// Counts the questions and the answers the user actually selected in the latest round.
// An answer starting with "Selected:" was chosen by the user; anything else is the AI's suggestion.
export function countAnswersInText(text: string): { total: number; answered: number } {
  const latest = latestRound(text);
  const total = (latest.match(/^Q:/gm) || []).length;
  const answered = (latest.match(/^A:\s*Selected:/gm) || []).length;
  return { total, answered: Math.min(answered, total || answered) };
}

// guided = every question answered; hybrid = some answered; direct = none answered (or no Q&A)
export function analysisMode(answered: number, total: number): "guided" | "hybrid" | "direct" {
  if (total > 0 && answered >= total) return "guided";
  if (answered > 0) return "hybrid";
  return "direct";
}

// Reads the AMBIGUITIES section of the analysis answer: one conflict per line, "none" when clean.
export function parseAmbiguities(text: string): string[] {
  const match = String(text ?? "").match(
    /^\s*(?:\*\*|#+\s*)?AMBIGUITIES\s*:?\s*(?:\*\*)?\s*$([\s\S]*?)(?=^\s*(?:\*\*|#+\s*)?(?:REASONING|NODES|EDGES|PATHS|CALCULATION)\s*:|(?![\s\S]))/im
  );
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)]|A\d+\s*[:.)-])\s*/i, "").replace(/\*\*/g, "").trim())
    .filter((line) => line.length > 3 && !/^(none|no ambiguit|n\/a)/i.test(line))
    .slice(0, 20);
}

// Confidence is shown as calculated, kept within 0-100%. Answer conflicts are listed
// for review but do not lower it.
export function clampConfidence(score: unknown): number {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function ambiguityNotes(ambiguities: unknown): string[] {
  return (Array.isArray(ambiguities) ? ambiguities : [])
    .map((a) => String(a).trim())
    .filter(Boolean)
    .map((a) => `Answer conflict: ${a}`);
}

// Remarks about the prompt itself rather than the requirement (the formula convention,
// a missing Q&A section, other documents, the output format). These are never findings.
export function isMetaRemark(line: string): boolean {
  return /CLARIFICATIONS|formula|M\s*=\s*E|connected components|McCabe|not provided|output format|plain[- ]text|graphical output/i.test(
    String(line ?? "")
  );
}

// The AMBIGUITIES section means two different things:
// - with answered Q&A: answers that cannot all be true (listed for review);
// - without answers: gaps in the requirement itself (listed for review).
// Neither changes the confidence score.
export function splitFindings(items: string[], hasAnswers: boolean): { conflicts: string[]; gaps: string[] } {
  const findings = items.filter((line) => !isMetaRemark(line));
  return hasAnswers ? { conflicts: findings, gaps: [] } : { conflicts: [], gaps: findings };
}

export function gapNotes(gaps: unknown): string[] {
  return (Array.isArray(gaps) ? gaps : [])
    .map((g) => String(g).trim())
    .filter(Boolean)
    .map((g) => `Requirement gap: ${g}`);
}

// Notes for the "Checks" list from a stored analysis. Analyses saved before gaps were
// split out stored them as ambiguities; in direct mode those are shown as gaps.
type StoredFindings = { ambiguities?: unknown; requirementGaps?: unknown; analysisMode?: unknown } | null | undefined;

// Answer conflicts and requirement gaps of a stored analysis
export function findingsOf(data: StoredFindings): { conflicts: string[]; gaps: string[] } {
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((x) => !isMetaRemark(x)) : []);
  const stored = list(data?.ambiguities);
  const olderDirect = data?.analysisMode === "direct" && !Array.isArray(data?.requirementGaps);
  return {
    conflicts: olderDirect ? [] : stored,
    gaps: [...list(data?.requirementGaps), ...(olderDirect ? stored : [])],
  };
}

export function findingNotes(data: StoredFindings): string[] {
  const { conflicts, gaps } = findingsOf(data);
  return [...ambiguityNotes(conflicts), ...gapNotes(gaps)];
}
