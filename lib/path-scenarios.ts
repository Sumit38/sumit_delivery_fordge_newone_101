// Test scenarios built from the stored paths, so they stay in sync with the graph:
// exactly one positive and one negative scenario per Start-to-End path (2P in total).
// Code fixes the structure (IDs, path, decision outcomes, count); the AI may only
// rewrite the wording (actors, preconditions, steps, expected result).

export interface PathEdge {
  from: string;
  to: string;
  condition?: string;
}

export type ScenarioLevel = "Low" | "Medium" | "High" | "Very High";

export interface PathScenario {
  id: string; // P1+, P1-, ...
  pathId: string; // P1
  kind: "Positive" | "Negative";
  name: string;
  description: string;
  complexity: ScenarioLevel;
  route: string[]; // the path's steps, Start to End
  decisionOutcomes: string[]; // "Regional owner approval = approved"
  actors: string[];
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  testCases: Array<{ id: string; name: string; steps: string[]; expectedResult: string }>;
  wording: "AI" | "Generated"; // who wrote the text; the structure is always from the path
}

export interface ScenarioCoverage {
  paths: number;
  expected: number; // 2P
  scenarios: number;
  pathsMissing: string[]; // paths without both a positive and a negative scenario
  branchesUntested: string[]; // decision outcomes no scenario takes
  ok: boolean;
}

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const isTerminal = (s: string) => /^(start|end)$/i.test(s);

// Level from the number of decisions the path passes through (documented, deterministic):
// 0-1 Low, 2-3 Medium, 4-6 High, 7+ Very High
export function levelForDecisions(decisions: number): ScenarioLevel {
  if (decisions <= 1) return "Low";
  if (decisions <= 3) return "Medium";
  if (decisions <= 6) return "High";
  return "Very High";
}

// The decision outcomes a path takes: at every step with more than one way out,
// the condition of the edge the path follows.
export function decisionOutcomesOf(route: string[], edges: PathEdge[]): string[] {
  const outCount = new Map<string, number>();
  const condition = new Map<string, string>();
  for (const e of edges) {
    const from = norm(e.from);
    outCount.set(from, (outCount.get(from) || 0) + 1);
    condition.set(`${from}|${norm(e.to)}`, norm(e.condition) || `to ${norm(e.to)}`);
  }
  const outcomes: string[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    const from = norm(route[i]);
    if ((outCount.get(from) || 0) > 1) {
      outcomes.push(`${from} = ${condition.get(`${from}|${norm(route[i + 1])}`) || `to ${norm(route[i + 1])}`}`);
    }
  }
  return outcomes;
}

// Keeps each listed route once (older records can repeat a route or store a heading as a path)
export function uniqueRoutes(paths: unknown): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const raw of Array.isArray(paths) ? paths : []) {
    const route = (Array.isArray(raw) ? raw : []).map(norm).filter(Boolean);
    if (route.length < 2) continue;
    const key = route.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(route);
  }
  return out;
}

function lastStep(route: string[]): string {
  const inner = route.filter((s) => !isTerminal(s));
  return inner[inner.length - 1] || route[route.length - 1];
}

// Builds the 2P scenarios with plain wording taken from the path itself.
export function buildPathScenarios(pathsIn: unknown, edges: PathEdge[]): PathScenario[] {
  const routes = uniqueRoutes(pathsIn);
  const scenarios: PathScenario[] = [];

  routes.forEach((route, i) => {
    const pathId = `P${i + 1}`;
    const outcomes = decisionOutcomesOf(route, edges);
    const level = levelForDecisions(outcomes.length);
    const steps = route.filter((s) => !isTerminal(s));
    const ending = lastStep(route);
    const outcomeText = outcomes.length ? outcomes.join("; ") : "no decisions on this path";

    const positive: PathScenario = {
      id: `${pathId}+`,
      pathId,
      kind: "Positive",
      name: `${pathId} positive: ${outcomes.length ? outcomes[outcomes.length - 1] : ending}`,
      description: `Follows ${pathId} with valid data. Decision outcomes: ${outcomeText}.`,
      complexity: level,
      route,
      decisionOutcomes: outcomes,
      actors: [],
      preconditions: [`Test data set up so that each decision takes the ${pathId} outcome (${outcomeText})`],
      steps: steps.map((s) => `Perform / verify: ${s}`),
      expectedResult: `The flow follows ${pathId} step by step and ends after "${ending}" as specified.`,
      testCases: [],
      wording: "Generated",
    };

    const negative: PathScenario = {
      ...positive,
      id: `${pathId}-`,
      kind: "Negative",
      name: `${pathId} negative: invalid or boundary data at ${pathId}'s decisions`,
      description: `Tests the same decision points as ${pathId} (${outcomeText}) with invalid, missing or boundary data. The system must not wrongly produce ${pathId}'s outcome.`,
      preconditions: [`Test data set up for ${pathId}, with invalid, missing or boundary data at one of its decision points`],
      steps: [
        ...steps.slice(0, Math.max(steps.length - 1, 1)).map((s) => `Perform / verify: ${s}`),
        "At the next decision point, submit invalid, missing or boundary data",
      ],
      expectedResult: `The system does not produce ${pathId}'s outcome for the invalid data: it shows a clear error or takes the correct other branch, and leaves no partial or inconsistent data.`,
    };

    scenarios.push(positive, negative);
  });

  return scenarios.map(withTestCase);
}

// One executable test case per scenario, mirroring it (used by the Excel "Test Cases" sheet)
export function withTestCase(s: PathScenario): PathScenario {
  return {
    ...s,
    testCases: [{ id: `TC-${s.id.replace("+", "POS").replace("-", "NEG")}`, name: s.name, steps: s.steps, expectedResult: s.expectedResult }],
  };
}

// Applies the AI's wording to the fixed scenarios. Only text fields are taken, and only
// for IDs that exist; the AI cannot add, remove or reorder scenarios.
export function applyWording(
  scenarios: PathScenario[],
  wording: Array<{ id?: unknown; name?: unknown; actors?: unknown; preconditions?: unknown; steps?: unknown; expectedResult?: unknown }>
): PathScenario[] {
  const byId = new Map<string, (typeof wording)[number]>();
  for (const w of Array.isArray(wording) ? wording : []) {
    const id = norm(w?.id).replace(/\s+/g, "").replace(/[−–]/g, "-");
    if (id) byId.set(id.toUpperCase(), w);
  }
  const textList = (v: unknown, max: number) =>
    Array.isArray(v) ? v.map(norm).filter((x) => x.length > 0).slice(0, max) : [];

  return scenarios.map((s) => {
    const w = byId.get(s.id.toUpperCase());
    if (!w) return s;
    const steps = textList(w.steps, 15);
    const expected = norm(w.expectedResult);
    if (steps.length < 2 || !expected) return s; // incomplete wording: keep the generated text
    const label = norm(w.name);
    return withTestCase({
      ...s,
      name: label ? `${s.id} ${label}`.slice(0, 160) : s.name,
      actors: textList(w.actors, 8),
      preconditions: textList(w.preconditions, 8).length ? textList(w.preconditions, 8) : s.preconditions,
      steps,
      expectedResult: expected.slice(0, 800),
      wording: "AI",
    });
  });
}

// Confirms the scenarios match the paths: 2 per path, and no branch of the graph left untested.
// `untestedBranches` comes from the graph breakdown (branches no listed path takes).
export function checkScenarioCoverage(
  scenarios: PathScenario[],
  pathsIn: unknown,
  untestedBranches: PathEdge[] = []
): ScenarioCoverage {
  const routes = uniqueRoutes(pathsIn);
  const pathsMissing: string[] = [];
  routes.forEach((_, i) => {
    const id = `P${i + 1}`;
    const kinds = new Set(scenarios.filter((s) => s.pathId === id).map((s) => s.kind));
    if (!kinds.has("Positive") || !kinds.has("Negative")) pathsMissing.push(id);
  });

  const branchesUntested = untestedBranches.map(
    (e) => `${norm(e.from)} = ${norm(e.condition) || `to ${norm(e.to)}`}`
  );

  const expected = 2 * routes.length;
  return {
    paths: routes.length,
    expected,
    scenarios: scenarios.length,
    pathsMissing,
    branchesUntested,
    ok: scenarios.length === expected && pathsMissing.length === 0 && branchesUntested.length === 0,
  };
}
