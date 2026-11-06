import { describe, expect, it } from "vitest";
import {
  answerStatusFor,
  guidedTextFor,
  isAnswered,
  normaliseQuestions,
  questionsFor,
  type CombineQuestion,
} from "@/lib/combine-questions";
import { analysisMode, countAnswersInText } from "@/lib/qa-status";

const raw = [
  { question: "What happens when a quote is rejected?", appliesTo: [1, 2], suggestedAnswer: "Closed", options: ["Closed", "Revised"] },
  { question: "Retry limit for APAC approvals?", appliesTo: [1], suggestedAnswer: "3 times", options: ["1", "3", "No limit"] },
  { question: "Shared escalation rule?", appliesTo: [], suggestedAnswer: "Manager", options: [] },
  { question: "Bad document number", appliesTo: [7], suggestedAnswer: "x", options: ["a"] },
];

describe("combine guided questions", () => {
  it("cleans the AI questions: 1-based documents become 0-based, unknown or missing means all", () => {
    const qs = normaliseQuestions(raw, 2);
    expect(qs.map((q) => q.appliesTo)).toEqual([[0, 1], [0], [0, 1], [0, 1]]);
    expect(qs.every((q) => q.selectedOptions.length === 0 && q.userAnswer === "")).toBe(true);
    expect(normaliseQuestions(Array.from({ length: 14 }, (_, i) => ({ question: `Q${i}` })), 2)).toHaveLength(10);
    expect(normaliseQuestions("nonsense", 2)).toEqual([]);
  });

  it("applies each answer only to its documents, numbered per document", () => {
    const qs = normaliseQuestions(raw, 2);
    expect(questionsFor(1, qs)).toHaveLength(3);
    const status = answerStatusFor(1, qs);
    expect(status.map((s) => s.questionNumber)).toEqual([1, 2, 3]);
    expect(status.every((s) => !s.isAnswered)).toBe(true);
    expect(status[0].answer).toBe("Closed");
  });

  it("puts the answers before the document text and marks the user's own answers", () => {
    const qs: CombineQuestion[] = normaliseQuestions(raw, 2).map((q, i) =>
      i === 0 ? { ...q, selectedOptions: ["Revised"] } : i === 1 ? { ...q, userAnswer: "Twice" } : q
    );
    expect(isAnswered(qs[0])).toBe(true);
    expect(isAnswered(qs[2])).toBe(false);

    const text = guidedTextFor(0, "APAC", "Step 1: do things", qs);
    expect(text.indexOf("CLARIFICATIONS & ANSWERS:")).toBe(0);
    expect(text.indexOf("Step 1: do things")).toBeGreaterThan(text.indexOf("Q: Retry limit"));
    expect(text).toContain("A: Selected: Revised");
    expect(text).toContain("A: Twice");
    expect(text).toContain("REQUIREMENT DOCUMENT: APAC");

    // The text-based counter (used when no metadata is sent) agrees with the metadata
    const status = answerStatusFor(0, qs);
    expect(status.filter((s) => s.isAnswered)).toHaveLength(2);
    expect(countAnswersInText(text).total).toBe(4);
    expect(analysisMode(status.filter((s) => s.isAnswered).length, status.length)).toBe("hybrid");
  });

  it("is guided when every question of a document is answered", () => {
    const qs = normaliseQuestions(raw, 2).map((q) => ({ ...q, selectedOptions: ["NA"] }));
    const status = answerStatusFor(1, qs);
    expect(analysisMode(status.filter((s) => s.isAnswered).length, status.length)).toBe("guided");
  });

  it("leaves a document unchanged when no question applies to it", () => {
    const qs = normaliseQuestions([{ question: "Only doc 1?", appliesTo: [1] }], 2);
    expect(guidedTextFor(1, "AMER", "Original text", qs)).toBe("Original text");
    expect(answerStatusFor(1, qs)).toEqual([]);
  });
});
