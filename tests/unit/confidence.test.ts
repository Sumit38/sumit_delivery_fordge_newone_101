import { describe, expect, it } from "vitest";
import { clampConfidence } from "@/lib/qa-status";
import { combineDocumentDetails } from "@/lib/merge-details";

describe("confidence score", () => {
  it("is shown as calculated, kept within 0-100%", () => {
    expect(clampConfidence(100)).toBe(100);
    expect(clampConfidence(87.6)).toBe(88);
    expect(clampConfidence(135)).toBe(100);
    expect(clampConfidence(-5)).toBe(0);
    expect(clampConfidence("abc")).toBe(0);
  });

  it("combined analysis keeps each document's own score (no 50% cap for conflicts)", () => {
    const details = combineDocumentDetails([
      { title: "Case 1", data: { confidenceScore: 100, analysisMode: "guided", ambiguities: ["Q6 conflicts with Section 14"] } },
      { title: "Case 2", data: { confidenceScore: 120, analysisMode: "guided", ambiguities: ["Q4 conflicts with Section 6"] } },
    ]);
    expect(details.documents.map((d) => d.confidenceScore)).toEqual([100, 100]);
    expect(details.confidenceScore).toBe(100);
    expect(details.ambiguities).toHaveLength(2);
  });
});
