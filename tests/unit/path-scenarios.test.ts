import { describe, it, expect } from "vitest";
import {
  applyWording,
  buildPathScenarios,
  checkScenarioCoverage,
  decisionOutcomesOf,
  levelForDecisions,
  uniqueRoutes,
} from "@/lib/path-scenarios";
import { buildGraphBreakdown } from "@/lib/graph-breakdown";

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

describe("buildPathScenarios", () => {
  it("creates exactly one positive and one negative scenario per path (2P)", () => {
    const s = buildPathScenarios(paths, edges);
    expect(s).toHaveLength(4);
    expect(s.map((x) => x.id)).toEqual(["P1+", "P1-", "P2+", "P2-"]);
    expect(s.map((x) => x.kind)).toEqual(["Positive", "Negative", "Positive", "Negative"]);
    expect(s.every((x) => x.testCases.length === 1)).toBe(true);
  });

  it("names the decision outcomes each path takes", () => {
    expect(decisionOutcomesOf(paths[0], edges)).toEqual(["Valid? = yes"]);
    expect(decisionOutcomesOf(paths[1], edges)).toEqual(["Valid? = no", "Retry? = give up"]);
    const s = buildPathScenarios(paths, edges);
    expect(s[2].decisionOutcomes).toEqual(["Valid? = no", "Retry? = give up"]);
    expect(s[2].route).toEqual(paths[1]);
  });

  it("sets the level from the number of decisions on the path", () => {
    expect([0, 1, 2, 3, 4, 6, 7].map(levelForDecisions)).toEqual(["Low", "Low", "Medium", "Medium", "High", "High", "Very High"]);
    const s = buildPathScenarios(paths, edges);
    expect(s[0].complexity).toBe("Low");
    expect(s[2].complexity).toBe("Medium");
  });

  it("ignores repeated routes and headings stored as paths", () => {
    expect(uniqueRoutes([paths[0], paths[0], ["Path 1: happy path"], paths[1]])).toEqual(paths);
    expect(buildPathScenarios([paths[0], paths[0]], edges)).toHaveLength(2);
  });
});

describe("applyWording", () => {
  it("takes AI wording for known IDs only and never changes the structure", () => {
    const base = buildPathScenarios(paths, edges);
    const worded = applyWording(base, [
      { id: "P1+", name: "Valid login", actors: ["User"], steps: ["Open login", "Enter valid credentials", "See dashboard"], expectedResult: "Dashboard shown" },
      { id: "P9+", name: "Invented", steps: ["a", "b"], expectedResult: "x" }, // unknown ID: ignored
      { id: "P2-", steps: ["only one step"], expectedResult: "x" }, // incomplete: ignored
    ]);
    expect(worded).toHaveLength(4);
    expect(worded.map((s) => s.id)).toEqual(["P1+", "P1-", "P2+", "P2-"]);
    expect(worded[0].wording).toBe("AI");
    expect(worded[0].steps).toEqual(["Open login", "Enter valid credentials", "See dashboard"]);
    expect(worded[0].decisionOutcomes).toEqual(["Valid? = yes"]);
    expect(worded[0].testCases[0].steps).toEqual(worded[0].steps);
    expect(worded[3].wording).toBe("Generated");
  });
});

describe("checkScenarioCoverage", () => {
  it("passes when every path has both scenarios and every branch is on a path", () => {
    const s = buildPathScenarios(paths, edges);
    const bd = buildGraphBreakdown(nodes, edges, paths);
    expect(checkScenarioCoverage(s, paths, bd.paths.uncoveredList)).toMatchObject({ paths: 2, expected: 4, scenarios: 4, ok: true });
  });

  it("reports branches no path takes", () => {
    const onlyFirst = [paths[0]];
    const s = buildPathScenarios(onlyFirst, edges);
    const bd = buildGraphBreakdown(nodes, edges, onlyFirst);
    const cov = checkScenarioCoverage(s, onlyFirst, bd.paths.uncoveredList);
    expect(cov.ok).toBe(false);
    expect(cov.branchesUntested).toContain("Valid? = no");
  });

  it("reports a path missing its negative scenario", () => {
    const s = buildPathScenarios(paths, edges).filter((x) => x.id !== "P2-");
    const cov = checkScenarioCoverage(s, paths);
    expect(cov.pathsMissing).toEqual(["P2"]);
    expect(cov.ok).toBe(false);
  });
});
