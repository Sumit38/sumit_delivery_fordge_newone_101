import { describe, expect, it } from "vitest";
import { combineDocumentDetails } from "@/lib/merge-details";
import { findingNotes } from "@/lib/qa-status";

const eu = {
  title: "EU",
  data: {
    analysisMode: "direct",
    confidenceScore: 100,
    confidenceReason: "Direct analysis of 3243 words with 7 complexity indicators - DIRECT PATH",
    reasoning: "The flow branches at quote case origin and approval.",
    ambiguities: [],
    requirementGaps: ["The on-hold step has no timeout."],
  },
};
const mea = {
  title: "MEA",
  data: {
    analysisMode: "hybrid",
    confidenceScore: 80,
    confidenceReason: "Partial Q&A with inference",
    reasoning: "The flow has decision points for information completeness.",
    ambiguities: ["Rollback in 30 days vs full version history"],
    requirementGaps: [],
  },
};

describe("combined analysis keeps each document's details", () => {
  const d = combineDocumentDetails([eu, mea]);

  it("takes the lowest confidence and explains it per document", () => {
    expect(d.confidenceScore).toBe(80);
    expect(d.confidenceReason).toContain("EU: 100%, direct analysis");
    expect(d.confidenceReason).toContain("MEA: 80%, hybrid analysis");
  });

  it("uses the least guided way of analysis", () => {
    expect(d.analysisMode).toBe("direct");
    expect(combineDocumentDetails([{ ...eu, data: { ...eu.data, analysisMode: "guided" } }, mea]).analysisMode).toBe("hybrid");
  });

  it("keeps each document's reasoning", () => {
    expect(d.reasoningSection).toContain('Document 1 "EU" - Direct (no questions answered), confidence 100%');
    expect(d.reasoningSection).toContain("The flow has decision points for information completeness.");
  });

  it("carries conflicts and gaps, labelled with the document", () => {
    expect(d.requirementGaps).toEqual(["EU: The on-hold step has no timeout."]);
    expect(d.ambiguities).toEqual(["MEA: Rollback in 30 days vs full version history"]);
    // History's Checks list reads them like a single analysis
    expect(findingNotes({ analysisMode: d.analysisMode, ambiguities: d.ambiguities, requirementGaps: d.requirementGaps })).toEqual([
      "Answer conflict: MEA: Rollback in 30 days vs full version history",
      "Requirement gap: EU: The on-hold step has no timeout.",
    ]);
  });

  it("older documents without these details still combine", () => {
    const old = combineDocumentDetails([{ title: "A", data: {} }, { title: "B", data: null }]);
    expect(old.confidenceScore).toBe(75);
    expect(old.analysisMode).toBeNull();
    expect(old.reasoningSection).toContain("No reasoning was recorded");
  });
});
