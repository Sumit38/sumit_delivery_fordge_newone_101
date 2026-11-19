import { describe, expect, it } from "vitest";
import { applyFlowWording, buildUseCaseStructure, salvageObjects } from "@/lib/use-case-flows";
import { buildUseCaseHTML } from "@/lib/use-case-generator";

// Made-up leave request process
const edges = [
  { from: "Start", to: "Submit request" },
  { from: "Submit request", to: "Check balance?" },
  { from: "Check balance?", to: "Manager review?", condition: "sufficient" },
  { from: "Check balance?", to: "Reject request", condition: "insufficient" },
  { from: "Reject request", to: "End" },
  { from: "Manager review?", to: "Post to payroll", condition: "approved" },
  { from: "Manager review?", to: "Notify rejection", condition: "rejected" },
  { from: "Manager review?", to: "Edit request", condition: "changes requested" },
  { from: "Edit request", to: "Submit request" },
  { from: "Post to payroll", to: "End" },
  { from: "Notify rejection", to: "End" },
];
const paths = [
  ["Start", "Submit request", "Check balance?", "Reject request", "End"],
  ["Start", "Submit request", "Check balance?", "Manager review?", "Notify rejection", "End"],
  ["Start", "Submit request", "Check balance?", "Manager review?", "Post to payroll", "End"],
  ["Start", "Submit request", "Check balance?", "Manager review?", "Edit request", "Submit request", "Check balance?", "Manager review?", "Post to payroll", "End"],
];

describe("use case flows from the analysis graph", () => {
  const structure = buildUseCaseStructure(paths, edges)!;

  it("picks the success path as the main scenario", () => {
    expect(structure.mainPathId).toBe("P3");
    expect(structure.mainRoute).toEqual(["Submit request", "Check balance?", "Manager review?", "Post to payroll"]);
  });

  it("makes one extension per decision outcome off the main scenario, with branch step and ending", () => {
    const byLabel = Object.fromEntries(structure.extensions.map((x) => [x.label, x]));
    expect(Object.keys(byLabel).sort()).toEqual(["2a", "3a", "3b"]);
    expect(byLabel["2a"]).toMatchObject({ kind: "Exception", condition: "insufficient", ending: "Use case ends", graphSteps: ["Reject request"], paths: ["P1"] });
    expect(byLabel["3a"]).toMatchObject({ kind: "Exception", condition: "rejected", graphSteps: ["Notify rejection"], paths: ["P2"] });
    expect(byLabel["3b"]).toMatchObject({ kind: "Alternative", ending: "Returns to main step 1", rejoinStep: 1, graphSteps: ["Edit request"], paths: ["P4"] });
  });

  it("covers every decision outcome and traces every path to its 2 test scenarios", () => {
    expect(structure.coverage).toEqual({ decisions: 2, outcomes: 5, outcomesCovered: 5, paths: 4, pathsTraced: 4, ok: true });
    expect(structure.traceability.map((t) => t.tests)).toEqual([["P1+", "P1-"], ["P2+", "P2-"], ["P3+", "P3-"], ["P4+", "P4-"]]);
    expect(structure.traceability[2].flows).toEqual(["Main"]);
    expect(structure.traceability[3].flows).toEqual(["3b"]);
  });

  it("returns null without a stored graph", () => {
    expect(buildUseCaseStructure([], edges)).toBeNull();
    expect(buildUseCaseStructure(paths, [])).toBeNull();
  });

  it("applies AI wording by id and keeps generated text for the rest", () => {
    const worded = applyFlowWording(structure.extensions, [
      { id: structure.extensions[0].id, name: "Not enough leave", trigger: "Balance is too low", steps: [{ actor: "System", action: "Rejects the request" }], acceptanceCriteria: ["Given ..., when ..., then ..."], rules: ["br-02", "nonsense"] },
      { id: "E99", name: "unknown" },
    ]);
    expect(worded[0]).toMatchObject({ name: "Not enough leave", wording: "AI", rules: ["BR-02"] });
    expect(worded[1].wording).toBe("Generated");
    expect(worded[0].label).toBe(structure.extensions[0].label); // structure is kept
  });

  it("keeps the whole flows from a broken or cut-off AI response", () => {
    const text = `{"flows":[{"id":"E01","name":"A {x}","steps":[{"actor":"S","action":"say \\"hi\\""}]},{"id":"E02","name":"bad" "steps":[]},{"id":"E03","steps":[{"actor":"S","action":"ok"}]},{"id":"E04","steps":[{"actor":"S","act`;
    expect(salvageObjects(text).map((o) => o.id)).toEqual(["E01", "E03"]);
  });

  it("renders the comprehensive document with all BA sections", () => {
    const html = buildUseCaseHTML("Leave", {
      format: "graph",
      useCaseTitle: "Leave",
      description: "Employees request leave.",
      trigger: "Employee submits a request.",
      primaryActor: { name: "Employee", role: "Requests leave" },
      secondaryActors: [{ name: "Manager", role: "Approves" }],
      stakeholders: [{ name: "HR", interest: "Accurate balances" }],
      actors: [],
      preconditions: ["Employee is signed in"],
      mainFlow: [],
      mainSuccessScenario: [{ step: 1, actor: "Employee", action: "Submits <request>", rules: ["BR-01"] }],
      mainAcceptanceCriteria: ["Given a valid request, when approved, then payroll is updated"],
      extensions: structure.extensions,
      alternativeFlows: [],
      exceptionFlows: [],
      postconditions: [],
      successPostconditions: ["Leave is booked"],
      failurePostconditions: ["No partial data is saved"],
      businessRules: [{ id: "BR-01", rule: "Balance must cover the request" }],
      businessValue: "Faster approvals",
      kpis: [],
      assumptions: ["Balances are up to date"],
      openQuestions: ["Requirement gap: no limit on resubmissions"],
      traceability: structure.traceability,
      coverage: structure.coverage,
    });
    for (const heading of [
      "Trigger",
      "Actors &amp; Stakeholders",
      "Main Success Scenario",
      "Alternative Flows (Extensions)",
      "Exception Flows",
      "Postconditions",
      "Business Rules",
      "Assumptions &amp; Open Questions",
      "Traceability Matrix",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("covers <strong>5 of 5</strong> decision outcomes");
    expect(html).toContain("On failure or cancellation (minimal guarantees)");
    expect(html).toContain("Submits &lt;request&gt;"); // text is escaped
    expect(html).toContain("Returns to main step 1");
    expect(html).not.toContain("Key Performance Indicators"); // empty sections are left out
  });
});
