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

// Confidence for an analysis whose answers conflict is capped: the baseline is not final
// until the conflicts are resolved.
export const AMBIGUOUS_CONFIDENCE_CAP = 50;

export function ambiguityNotes(ambiguities: unknown): string[] {
  return (Array.isArray(ambiguities) ? ambiguities : [])
    .map((a) => String(a).trim())
    .filter(Boolean)
    .map((a) => `Answer conflict: ${a}`);
}
