import { describe, it, expect } from "vitest";
import { analysisMode, ambiguityNotes, countAnswersInText, latestRound, parseAmbiguities } from "@/lib/qa-status";
import { answerStatusOf } from "@/components/RefineRequirement";

const latest = `REFINED USE CASE: X

CLARIFICATIONS & ANSWERS:
Q: Rollback?
A: Selected: 30-day window only

Q: QMS?
A: Real-time integration (AI suggestion)

Q: Regions?
A: Selected: 4-6 regions`;

const older = `REFINED USE CASE: X (older)

CLARIFICATIONS & ANSWERS:
Q: Rollback?
A: Selected: Full version control
Q: QMS?
A: Selected: Standalone`;

const withHistory = `${latest}\n\n---\nGenerated from raw requirement: "${older}\n\n---\nGenerated from raw requirement: \"raw text\""`;

describe("Q&A counting", () => {
  it("reads only the latest refine round", () => {
    expect(latestRound(withHistory)).toBe(latest);
    expect(countAnswersInText(withHistory)).toEqual({ total: 3, answered: 2 });
  });

  it("returns zero questions for plain text", () => {
    expect(countAnswersInText("A plain requirement with no questions")).toEqual({ total: 0, answered: 0 });
  });
});

describe("analysisMode", () => {
  it("guided only when every question is answered", () => {
    expect(analysisMode(15, 15)).toBe("guided");
    expect(analysisMode(14, 15)).toBe("hybrid");
    expect(analysisMode(8, 15)).toBe("hybrid");
    expect(analysisMode(1, 15)).toBe("hybrid");
    expect(analysisMode(0, 15)).toBe("direct");
    expect(analysisMode(0, 0)).toBe("direct");
  });
});

describe("parseAmbiguities", () => {
  it("reads one conflict per line", () => {
    const text = `CALCULATION:\nN = 5\nE = 6\nP = 2\nM = E - N + 2P = 5\n\nAMBIGUITIES:\n- Rollback: "30 days only" conflicts with "full version control"\n- QMS: "real-time" conflicts with "standalone"\n`;
    expect(parseAmbiguities(text)).toEqual([
      'Rollback: "30 days only" conflicts with "full version control"',
      'QMS: "real-time" conflicts with "standalone"',
    ]);
  });

  it("treats 'none' as no conflicts", () => {
    expect(parseAmbiguities("AMBIGUITIES:\nnone\n")).toEqual([]);
    expect(parseAmbiguities("AMBIGUITIES:\n- None\n")).toEqual([]);
    expect(parseAmbiguities("no section at all")).toEqual([]);
  });

  it("stops at the next section", () => {
    expect(parseAmbiguities("AMBIGUITIES:\n- A vs B conflict\nREASONING:\nsome text")).toEqual(["A vs B conflict"]);
  });

  it("formats notes", () => {
    expect(ambiguityNotes(["A vs B"])).toEqual(["Answer conflict: A vs B"]);
    expect(ambiguityNotes(undefined)).toEqual([]);
  });
});

describe("answerStatusOf (Refine screen)", () => {
  it("marks selected or typed answers as answered and the rest as skipped", () => {
    const status = answerStatusOf([
      { id: "1", question: "Q1", suggestedAnswer: "s1", options: [], selectedOptions: ["a"], userAnswer: "" },
      { id: "2", question: "Q2", suggestedAnswer: "s2", options: [], selectedOptions: [], userAnswer: " typed " },
      { id: "3", question: "Q3", suggestedAnswer: "s3", options: [], selectedOptions: [], userAnswer: "" },
    ]);
    expect(status.map((s) => s.isAnswered)).toEqual([true, true, false]);
    expect(status[0].answer).toBe("Selected: a");
    expect(status[2].answer).toBe("s3");
    expect(status.map((s) => s.questionNumber)).toEqual([1, 2, 3]);
  });
});
