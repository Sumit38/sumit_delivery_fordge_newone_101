import { describe, expect, it } from "vitest";
import {
  architectureMermaid,
  graphFacts,
  normalizeNarrative,
  normalizeQuestions,
  normalizeEffortTasks,
  normalizeStructure,
  effortSizing,
  stepKinds,
  traceability,
  type ArchDesign,
  type ArchEffort,
} from "@/lib/architecture-graph";
import { calculateComprehensive, type TeamAnswers, type TestingAnswers } from "@/lib/estimation-team";
import { riskTolerance } from "@/lib/risk-tolerance";
import { estimationHints } from "@/lib/architecture-estimation-hints";

// Made-up order process
const nodes = ["Start", "Submit order form", "Check stock in SAP?", "Save order record", "Notify customer by email", "Reject order", "End"];
const edges = [
  { from: "Start", to: "Submit order form" },
  { from: "Submit order form", to: "Check stock in SAP?" },
  { from: "Check stock in SAP?", to: "Save order record", condition: "in stock" },
  { from: "Check stock in SAP?", to: "Reject order", condition: "out of stock" },
  { from: "Save order record", to: "Notify customer by email" },
  { from: "Notify customer by email", to: "End" },
  { from: "Reject order", to: "End" },
];

describe("architecture from the analysis graph", () => {
  const facts = graphFacts(nodes, edges, [["a"], ["b"]])!;

  it("numbers the steps (no Start/End), finds decisions and kinds of work", () => {
    expect(facts.steps.map((s) => s.label)).toEqual(["Submit order form", "Check stock in SAP?", "Save order record", "Notify customer by email", "Reject order"]);
    expect(facts.decisions).toBe(1);
    expect(facts.steps[1]).toMatchObject({ no: 2, decision: true, outcomes: 2, points: 2 });
    expect(facts.totalPoints).toBe(6); // 5 steps + 1 extra branch
    expect(stepKinds("Check stock in SAP?")).toContain("integration");
    expect(stepKinds("Notify customer by email")).toContain("notification");
    expect(stepKinds("Do something")).toEqual(["logic"]);
    expect(graphFacts([], [])).toBeNull();
  });

  it("keeps only usable questions and suggestions that are real options", () => {
    const qs = normalizeQuestions(
      {
        questions: [
          { topic: "Hosting", question: "Where?", options: ["Cloud", "On-premise"], suggested: ["Cloud", "Mars"], basedOnSteps: [2, 99, "3"] },
          { question: "No options", options: ["Only one"] },
        ],
      },
      facts.steps.length
    );
    expect(qs).toHaveLength(1);
    expect(qs[0]).toMatchObject({ id: "Q1", suggested: ["Cloud"], basedOnSteps: [2, 3], multiple: false });
  });

  const structure = normalizeStructure(
    {
      components: [
        { name: "Order web app", type: "ui", layer: "channel", steps: [1] },
        { name: "Order service", type: "backend", steps: [1, 3, 5] },
        { name: "SAP connector", type: "integration", steps: [2] },
        { name: "SAP ERP", type: "integration", external: true, steps: [2] },
        { name: "Orders DB", type: "database", layer: "data", steps: [3] },
        { name: "Mystery", type: "quantum", steps: [42] },
      ],
      connections: [
        { from: "Order web app", to: "Order service", label: "REST" },
        { from: "SAP connector", to: "SAP ERP", label: "RFC" },
        { from: "Order service", to: "Nobody" },
      ],
    },
    facts.steps.length
  );
  const design: ArchDesign = {
    title: "Orders",
    summary: "",
    ...structure,
    decisions: [],
    risks: [],
    sections: { integration: "", data: "", security: "", nfr: "", deployment: "" },
    assumptions: [],
    openQuestions: [],
    steps: facts.steps.map((s) => ({ no: s.no, label: s.label, points: s.points })),
  };

  it("cleans the AI's components: known types, valid steps, known connections", () => {
    expect(structure.components.map((c) => c.id)).toEqual(["C1", "C2", "C3", "C4", "C5", "C6"]);
    expect(structure.components[5]).toMatchObject({ type: "backend", layer: "application", steps: [] });
    expect(structure.connections).toEqual([
      { from: "C1", to: "C2", label: "REST" },
      { from: "C3", to: "C4", label: "RFC" },
    ]);
  });

  it("traces every step to the components that build it and flags the rest", () => {
    const t = traceability(design);
    expect(t.rows.find((r) => r.no === 2)!.components).toEqual(["C3"]); // external SAP ERP is not counted
    expect(t.unassigned).toEqual([4]); // the email step has no component
  });

  const effort: ArchEffort = {
    generatedAt: "2026-11-19T00:00:00Z",
    tasks: normalizeEffortTasks(
      {
        tasks: [
          { component: "C1", task: "Order form screens", steps: [1], low: 8, likely: 12, high: 20 },
          { component: "Order service", task: "Order API and rules", steps: [1, 3], likely: 20 }, // by name; low/high defaulted
          { component: "C3", task: "SAP stock call", steps: [2], low: 30, likely: 16, high: 10 }, // out of order -> fixed
          { component: "C4", task: "Should be dropped: external system", likely: 10 },
          { component: "C9", task: "Unknown component", likely: 5 },
          { component: "C5", task: "", likely: 5 },
        ],
      },
      design
    ),
  };

  it("cleans the AI's task hours: known built components, low <= likely <= high", () => {
    expect(effort.tasks.map((t) => t.component)).toEqual(["C1", "C2", "C3"]);
    expect(effort.tasks.map((t) => t.id)).toEqual(["T1", "T2", "T3"]);
    expect(effort.tasks[1]).toMatchObject({ low: 16, likely: 20, high: 28 });
    expect(effort.tasks[2]).toMatchObject({ low: 16, likely: 16, high: 16 });
    // ids stay stable when a task is removed and one is added
    const edited = normalizeEffortTasks([effort.tasks[0], effort.tasks[2], { component: "C5", task: "Schema", likely: 6 }], design);
    expect(edited.map((t) => t.id)).toEqual(["T1", "T3", "T4"]);
  });

  it("sizes each component from its tasks; components without tasks are listed", () => {
    const s = effortSizing(design, effort);
    expect(s.components.map((c) => [c.name, c.likely])).toEqual([
      ["Order web app", 12],
      ["Order service", 20],
      ["SAP connector", 16],
    ]);
    expect(s.likely).toBe(48);
    expect(s.low).toBe(40);
    expect(s.high).toBe(64);
    expect(s.byType).toEqual({ ui: 12, backend: 20, integration: 16 });
    expect(s.withoutTasks).toEqual(["Orders DB", "Mystery"]);
  });

  it("builds the risk tolerance from the design's evidence", () => {
    const rt = riskTolerance({
      likely: 1000,
      taskSpread: { low: 80, likely: 100, high: 130 },
      risks: [
        { risk: "SAP API unknown", impact: "High", likelihood: "High", mitigation: "", steps: [] },
        { risk: "Volumes", impact: "Medium", likelihood: "Low", mitigation: "", steps: [] },
      ],
      skippedAnswers: 2,
      openQuestions: 2,
      unassignedSteps: 1,
      componentsWithoutTasks: 0,
      techShares: { newStack: 0.5, moderate: 0.5 },
      gaps: [{ severity: "high" }, { severity: "low" }],
    });
    // spread 30 + risks (8 + 1) + skipped 6 + open 3 + unassigned 2 + tech (5 + 1.5) + gaps 5 = 61.5
    expect(rt.upPct).toBe(62);
    expect(rt.downPct).toBe(20);
    expect(rt).toMatchObject({ likely: 1000, low: 800, high: 1620, contingencyHours: 620 });
    expect(rt.contributors.map((c) => c.source)).toContain("Architecture risk register");
    expect(rt.confidence).toBe(64); // 90 - 0.8 × (62 - 30) = 64.4
    const calm = riskTolerance({
      likely: 100,
      taskSpread: { low: 90, likely: 100, high: 110 },
      risks: [],
      skippedAnswers: 0,
      openQuestions: 0,
      unassignedSteps: 0,
      componentsWithoutTasks: 0,
      techShares: { newStack: 0, moderate: 0 },
      gaps: [],
    });
    expect(calm).toMatchObject({ downPct: 10, upPct: 10, confidence: 90 });
  });

  it("tells the estimation what the architecture implies", () => {
    const h = estimationHints(
      2,
      { ...design, sections: { ...design.sections, data: "Migrate 5 years of existing orders" } },
      [{ id: "Q1", topic: "Environments", question: "How many environments?", answer: ["Dev, Test, Prod"] }],
      effort
    );
    expect(h.technologies.map((t) => t.key)).toContain("ui (technology not named)");
    expect(h.suggestedTests.map((t) => t.type)).toEqual(
      expect.arrayContaining(["Functional", "API testing", "Data migration", "Cross-browser / device"])
    );
    expect(h.suggestedTests.map((t) => t.type)).not.toContain("Security");
    expect(h.environmentAnswer).toContain("Dev, Test, Prod");
    expect(h.roleNeeds.find((r) => r.area.startsWith("Integrations"))?.hours).toBe(16);
  });

  it("draws a layered diagram with safe labels", () => {
    const code = architectureMermaid({
      components: [...design.components.slice(0, 2), { ...design.components[2], name: 'SAP "connector" [v2]' }, design.components[3]],
      connections: design.connections,
    });
    expect(code).toContain('subgraph L_channel["Users & channels"]');
    expect(code).toContain('C1 -->|"REST"| C2');
    expect(code).toContain("class C4 external");
    expect(code).not.toContain('"connector"');
  });

  it("keeps decisions tied to real answers and risks tied to real steps", () => {
    const n = normalizeNarrative(
      {
        decisions: [{ decision: "Hosting", choice: "Cloud", basedOn: ["q1", "Q9"] }],
        risks: [{ risk: "SAP API unknown", impact: "high", likelihood: "x", steps: [2, 77] }],
      },
      facts.steps.length,
      ["Q1", "Q2"]
    );
    expect(n.decisions[0].basedOn).toEqual(["Q1"]);
    expect(n.risks[0]).toMatchObject({ impact: "High", likelihood: "Medium", steps: [2] });
  });

  it("estimation uses the architecture's task hours, familiarity per technology and the risk tolerance", () => {
    const sizing = effortSizing(design, effort);
    const team: TeamAnswers = {
      workstreams: ["ui"],
      roles: { fullstack: { count: 1, seniority: "Mid" }, integration: { count: 1, seniority: "Mid" } },
      support: {},
    };
    const testing: TestingAnswers = {
      testers: { manual: { count: 1, seniority: "Mid" } },
      testTypes: ["Functional"],
      automationCoverage: 0,
      testCycles: 1,
      approach: "in-sprint",
      environment: "ready",
      testData: "available",
      defectBuffer: 0,
    };
    const base = { complexityScore: 50, availability: 40, techFactor: 1, riskFactor: 1, deadlineFactor: 1, team, testing };
    const withArch = calculateComprehensive({
      ...base,
      architecture: {
        designId: "d1",
        version: 2,
        sizing,
        familiarity: { C3: "New/Complex Stack" },
        evidence: { risks: [], skippedAnswers: 1, openQuestions: 0, unassignedSteps: 1 },
      },
    });
    // 12 + 20 + 16 × 1.3 (SAP connector on a new stack)
    expect(withArch.devBase).toBe(53);
    expect(withArch.details.workstreams.map((w) => w.id).sort()).toEqual(["backend", "integration", "ui"]);
    expect(withArch.details.architecture).toMatchObject({ version: 2, basis: "tasks", taskCount: 3 });
    const rt = withArch.details.riskTolerance!;
    expect(rt.likely).toBe(withArch.totalEffort);
    expect(rt.contributors.map((c) => c.source)).toEqual(
      expect.arrayContaining(["Spread of the task estimates", "Skipped architecture answers", "Components without estimated tasks", "Technology familiarity"])
    );
    expect(withArch.details.range).toMatchObject({ low: rt.low, high: rt.high });
    // Without an architecture the original formula is unchanged
    const legacy = calculateComprehensive(base);
    expect(legacy.devBase).toBe(400);
    expect(legacy.details.architecture).toBeUndefined();
    expect(legacy.details.riskTolerance).toBeUndefined();
  });
});
