// Carries each document's own analysis details into a combined analysis, so it shows
// the same pointers as a single analysis: way of analysis, confidence and its reason,
// the reasoning, answer conflicts and requirement gaps. Pure code, no AI.

import { clampConfidence, findingsOf } from "./qa-status";

type Mode = "guided" | "hybrid" | "direct";
const MODE_ORDER: Mode[] = ["direct", "hybrid", "guided"];
const MODE_TEXT: Record<Mode, string> = {
  guided: "Guided (every question answered)",
  hybrid: "Hybrid (some questions answered)",
  direct: "Direct (no questions answered)",
};

export interface SourceDocument {
  title: string;
  data: Record<string, unknown> | null | undefined; // the document's stored analysis_data
}

export interface DocumentDetails {
  title: string;
  analysisMode: Mode | null;
  confidenceScore: number | null;
  confidenceReason: string;
  reasoning: string;
}

export interface CombinedDetails {
  documents: DocumentDetails[];
  // The weakest mode of the documents: the combined result is only as guided as its least guided part
  analysisMode: Mode | null;
  confidenceScore: number;
  confidenceReason: string;
  reasoningSection: string;
  ambiguities: string[];
  requirementGaps: string[];
}

const DEFAULT_CONFIDENCE = 75;

export function combineDocumentDetails(sources: SourceDocument[]): CombinedDetails {
  const documents: DocumentDetails[] = sources.map(({ title, data }) => {
    const mode = MODE_ORDER.includes(data?.analysisMode as Mode) ? (data!.analysisMode as Mode) : null;
    const score = Number(data?.confidenceScore);
    return {
      title,
      analysisMode: mode,
      confidenceScore: Number.isFinite(score) && score > 0 ? clampConfidence(score) : null,
      confidenceReason: String(data?.confidenceReason || "").trim(),
      reasoning: String(data?.reasoning || "").trim(),
    };
  });

  const modes = documents.map((d) => d.analysisMode).filter((m): m is Mode => !!m);
  const analysisMode = modes.length ? MODE_ORDER[Math.min(...modes.map((m) => MODE_ORDER.indexOf(m)))] : null;

  const scored = documents.filter((d) => d.confidenceScore !== null);
  const confidenceScore = scored.length ? Math.min(...scored.map((d) => d.confidenceScore!)) : DEFAULT_CONFIDENCE;
  const confidenceReason = [
    `Lowest confidence of the ${documents.length} combined documents (${confidenceScore}%):`,
    ...documents.map(
      (d) =>
        `   - ${d.title}: ${d.confidenceScore !== null ? `${d.confidenceScore}%` : "not recorded"}` +
        `${d.analysisMode ? `, ${MODE_TEXT[d.analysisMode].split(" (")[0].toLowerCase()} analysis` : ""}` +
        `${d.confidenceReason ? ` - ${d.confidenceReason.split("\n")[0]}` : ""}`
    ),
  ].join("\n");

  const reasoningSection = documents
    .map(
      (d, i) =>
        `Document ${i + 1} "${d.title}"` +
        `${d.analysisMode ? ` - ${MODE_TEXT[d.analysisMode]}` : ""}` +
        `${d.confidenceScore !== null ? `, confidence ${d.confidenceScore}%` : ""}:\n` +
        `${d.reasoning || "No reasoning was recorded for this document."}`
    )
    .join("\n\n");

  const ambiguities: string[] = [];
  const requirementGaps: string[] = [];
  sources.forEach(({ title, data }) => {
    const { conflicts, gaps } = findingsOf(data as Parameters<typeof findingsOf>[0]);
    conflicts.forEach((c) => ambiguities.push(`${title}: ${c}`));
    gaps.forEach((g) => requirementGaps.push(`${title}: ${g}`));
  });

  return { documents, analysisMode, confidenceScore, confidenceReason, reasoningSection, ambiguities, requirementGaps };
}
