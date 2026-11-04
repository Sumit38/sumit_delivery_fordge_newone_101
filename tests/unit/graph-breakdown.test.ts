import { describe, it, expect } from "vitest";
import { buildGraphBreakdown, cleanFormulaText, completeBranchCoverage, formulaLine } from "@/lib/graph-breakdown";

// Login with a retry loop:
// Start -> Login -> Valid? -(yes)-> Dashboard -> End
//                       -(no)-> Retry? -(again)-> Login (loop-back)
//                                      -(give up)-> End
const nodes = ["Start", "Login", "Valid?", "Dashboard", "Retry?", "End"];
const edges = [
  { from: "Start", to: "Login" },
  { from: "Login", to: "Valid?" },
  { from: "Valid?", to: "Dashboard", condition: "yes" },
  { from: "Valid?", to: "Retry?", condition: "no" },
  { from: "Retry?", to: "Login", condition: "again" },
  { from: "Retry?", to: "End", condition: "give up" },
  { from: "Dashboard", to: "End" },
];
const paths = [
  ["Start", "Login", "Valid?", "Dashboard", "End"],
  ["Start", "Login", "Valid?", "Retry?", "End"],
];

describe("buildGraphBreakdown", () => {
  it("splits N into Start/End, actions and decisions", () => {
    const bd = buildGraphBreakdown(nodes, edges, paths);
    expect(bd.nodes.total).toBe(6);
    expect(bd.nodes.startEnd).toBe(2);
    expect(bd.nodes.decisions).toBe(2);
    expect(bd.nodes.decisionList).toEqual(["Valid?", "Retry?"]);
    expect(bd.nodes.actions).toBe(2);
    expect(bd.nodes.startEnd + bd.nodes.actions + bd.nodes.decisions).toBe(bd.nodes.total);
  });

  it("splits E into forward transitions and loop-backs", () => {
    const bd = buildGraphBreakdown(nodes, edges, paths);
    expect(bd.edges.total).toBe(7);
    expect(bd.edges.loopBack).toBe(1);
    expect(bd.edges.loopBackList[0]).toMatchObject({ from: "Retry?", to: "Login" });
    expect(bd.edges.forward).toBe(6);
    expect(bd.edges.fromDecisions).toBe(4);
  });

  it("finds no problems in a clean graph", () => {
    const bd = buildGraphBreakdown(nodes, edges, paths);
    expect(bd.paths.graphRoutes).toBe(2);
    expect(bd.paths.uncoveredBranches).toBe(0);
    expect(bd.notes).toEqual([]);
  });

  it("reports repeated, looping and broken paths and untested branches", () => {
    const bd = buildGraphBreakdown(nodes, edges, [
      paths[0],
      paths[0],
      ["Start", "Login", "Valid?", "Retry?", "Login", "Valid?", "Dashboard", "End"],
      ["Start", "Dashboard", "End"],
    ]);
    expect(bd.paths.repeated).toBe(1);
    expect(bd.paths.loops).toBe(1);
    expect(bd.paths.broken).toBe(1);
    // Valid? -> Retry? and Retry? -> End are only taken by the looping / broken entries
    expect(bd.paths.uncoveredList.map((e) => `${e.from}>${e.to}`)).toEqual(["Retry?>End"]);
    expect(bd.notes.length).toBe(4);
  });

  it("flags steps that cannot be reached or have no way out", () => {
    const bd = buildGraphBreakdown(
      ["Start", "A", "B", "Orphan", "End"],
      [
        { from: "Start", to: "A" },
        { from: "A", to: "End" },
        { from: "A", to: "B" },
        { from: "Orphan", to: "End" },
      ],
      [["Start", "A", "End"]]
    );
    expect(bd.checks.unreachable).toEqual(["Orphan"]);
    expect(bd.checks.deadEnds).toEqual(["B"]);
  });

  it("handles missing data", () => {
    const bd = buildGraphBreakdown(undefined, null, "x");
    expect(bd.nodes.total).toBe(0);
    expect(bd.paths.listed).toBe(0);
  });
});

describe("completeBranchCoverage", () => {
  it("adds a path for a branch no listed path takes", () => {
    const listed = [paths[0].slice()];
    const added = completeBranchCoverage(nodes, edges, listed);
    expect(added).toBe(1);
    expect(listed).toHaveLength(2);
    expect(listed[1]).toEqual(paths[1]);
    expect(buildGraphBreakdown(nodes, edges, listed).paths.uncoveredBranches).toBe(0);
  });

  it("adds nothing when every branch is covered", () => {
    const listed = paths.map((p) => p.slice());
    expect(completeBranchCoverage(nodes, edges, listed)).toBe(0);
    expect(listed).toHaveLength(2);
  });

  it("covers each outcome once instead of every combination", () => {
    // 7 decisions in a row = 128 combinations, but 2 paths take every branch
    const n: string[] = ["Start"];
    const e: Array<{ from: string; to: string }> = [];
    let prev = "Start";
    for (let i = 0; i < 7; i++) {
      const a = `A${i}`, b = `B${i}`, j = `J${i}`;
      n.push(a, b, j);
      e.push({ from: prev, to: a }, { from: prev, to: b }, { from: a, to: j }, { from: b, to: j });
      prev = j;
    }
    n.push("End");
    e.push({ from: prev, to: "End" });
    const listed: string[][] = [];
    const added = completeBranchCoverage(n, e, listed);
    expect(buildGraphBreakdown(n, e, listed).paths.graphRoutes).toBe(128);
    expect(buildGraphBreakdown(n, e, listed).paths.uncoveredBranches).toBe(0);
    expect(added).toBeLessThanOrEqual(8);
  });
});

describe("formula text", () => {
  it("writes one line", () => {
    expect(formulaLine(30, 42, 9)).toBe("N=30, E=42, P=9 → M = 42 - 30 + 2(9) = 30");
  });

  it("collapses the repeated counts found in older records", () => {
    expect(cleanFormulaText("N=30, E=42, P=9 → N=30, E=42, P=9 → M = 42 - 30 + 2(9) = 30")).toBe(
      "N=30, E=42, P=9 → M = 42 - 30 + 2(9) = 30"
    );
    expect(cleanFormulaText("plain text")).toBe("plain text");
  });
});
