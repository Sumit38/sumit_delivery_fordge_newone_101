// Use case flows built from the analysis graph, so the use case covers every decision
// outcome and every Start-to-End path (the same paths behind the 2P test scenarios).
// Code fixes the structure (main success scenario, one extension per decision outcome,
// where it branches, how it ends, which paths it covers); the AI only rewrites the wording.
// Pure functions, no AI calls.

import { uniqueRoutes, type PathEdge } from "./path-scenarios";

export interface FlowStep {
  actor: string;
  action: string;
}

export interface UseCaseExtension {
  id: string; // E01, E02 ...
  label: string; // "3a" when it branches from main step 3, otherwise "E05"
  kind: "Alternative" | "Exception";
  decision: string; // the decision step it branches from
  condition: string; // the outcome taken at that decision
  branchFromStep: number | null; // main-scenario step number, or null when nested in another flow
  graphSteps: string[]; // the steps it follows (graph labels)
  ending: string; // "Rejoins main step 5" / "Returns to main step 2" / "Use case ends"
  rejoinStep: number | null;
  paths: string[]; // P-numbers that take this outcome
  // wording (AI or generated)
  name: string;
  trigger: string;
  steps: FlowStep[];
  acceptanceCriteria: string[];
  rules: string[];
  wording: "AI" | "Generated";
}

export interface TraceRow {
  pathId: string;
  route: string; // short route text
  flows: string[]; // "Main", "3a", "E05" ...
  decisionOutcomes: string[];
  tests: string[]; // P1+, P1-
}

export interface UseCaseStructure {
  mainRoute: string[]; // graph labels of the main success scenario (no Start/End)
  mainPathId: string;
  extensions: UseCaseExtension[];
  traceability: TraceRow[];
  coverage: {
    decisions: number;
    outcomes: number;
    outcomesCovered: number;
    paths: number;
    pathsTraced: number;
    ok: boolean;
  };
}

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const isStart = (s: string) => /^start$/i.test(s);
const isEnd = (s: string) => /^end$/i.test(s);
const isTerminal = (s: string) => isStart(s) || isEnd(s);

const NEGATIVE = /\b(no|not|reject\w*|fail\w*|invalid|error|cancel\w*|timeout|time[- ]?out|den(y|ied)|missing|insufficient|declin\w*|expir\w*|abort\w*|unavailable|incomplete|block\w*|breach\w*|overdue|exceed\w*|mismatch\w*|duplicate|refus\w*|false|disput\w*|escalat\w*|hold|exception)\b/i;
const POSITIVE = /\b(yes|approv\w*|valid|success\w*|pass\w*|accept\w*|complete\w*|available|found|ok|true|confirm\w*|match\w*|within|sufficient|resolved)\b/i;

// +1 for an outcome that reads like success, -2 for one that reads like failure
function outcomeScore(condition: string): number {
  if (NEGATIVE.test(condition)) return -2;
  if (POSITIVE.test(condition)) return 1;
  return 0;
}

function graphMaps(edges: PathEdge[]) {
  const out = new Map<string, string[]>();
  const condition = new Map<string, string>();
  for (const e of edges) {
    const from = norm(e.from);
    const to = norm(e.to);
    if (!from || !to) continue;
    const list = out.get(from) || [];
    if (!list.includes(to)) list.push(to);
    out.set(from, list);
    if (!condition.has(`${from}|${to}`)) condition.set(`${from}|${to}`, norm(e.condition));
  }
  return { out, condition };
}

const conditionOf = (condition: Map<string, string>, from: string, to: string) =>
  condition.get(`${from}|${to}`) || `goes to "${to}"`;

function routeHasEdge(route: string[], from: string, to: string): number {
  for (let i = 0; i < route.length - 1; i++) if (route[i] === from && route[i + 1] === to) return i;
  return -1;
}

// The main success scenario: a path without loops whose decisions read most like success,
// then the longest
export function pickMainRoute(routes: string[][], edges: PathEdge[]): number {
  const { out, condition } = graphMaps(edges);
  let best = 0;
  let bestScore = -Infinity;
  routes.forEach((route, i) => {
    let score = 0;
    for (let k = 0; k < route.length - 1; k++) {
      if ((out.get(route[k])?.length || 0) > 1) score += outcomeScore(conditionOf(condition, route[k], route[k + 1]));
    }
    const lastInner = route.filter((s) => !isTerminal(s)).pop() || "";
    if (NEGATIVE.test(lastInner)) score -= 2;
    const loops = new Set(route).size < route.length;
    const total = (loops ? -1_000_000 : 0) + score * 1000 + route.length;
    if (total > bestScore) {
      bestScore = total;
      best = i;
    }
  });
  return best;
}

const shortRoute = (route: string[]) => {
  const inner = route.filter((s) => !isTerminal(s));
  return inner.length <= 6 ? inner.join(" → ") : `${inner.slice(0, 3).join(" → ")} → … → ${inner.slice(-2).join(" → ")}`;
};

export function buildUseCaseStructure(pathsIn: unknown, edgesIn: unknown): UseCaseStructure | null {
  const routes = uniqueRoutes(pathsIn);
  const edges: PathEdge[] = (Array.isArray(edgesIn) ? edgesIn : []).filter((e: any) => e && e.from && e.to);
  if (!routes.length || !edges.length) return null;

  const { out, condition } = graphMaps(edges);
  const mainIdx = pickMainRoute(routes, edges);
  const main = routes[mainIdx];
  const mainInner = main.filter((s) => !isTerminal(s));
  // step number (1-based) of each main step
  const mainStepNo = new Map<string, number>();
  mainInner.forEach((s, i) => !mainStepNo.has(s) && mainStepNo.set(s, i + 1));
  const mainNext = new Map<string, string>();
  for (let i = 0; i < main.length - 1; i++) if (!mainNext.has(main[i])) mainNext.set(main[i], main[i + 1]);

  // Decisions in the order they first appear on the paths
  const decisions: string[] = [];
  for (const route of [main, ...routes]) {
    for (const s of route) if ((out.get(s)?.length || 0) > 1 && !decisions.includes(s)) decisions.push(s);
  }

  const extensions: UseCaseExtension[] = [];
  const letters = new Map<number, number>();
  let outcomes = 0;
  let outcomesCovered = 0;

  for (const d of decisions) {
    const targets = out.get(d) || [];
    outcomes += targets.length;
    for (const t of targets) {
      const takers = routes.map((r, i) => (routeHasEdge(r, d, t) >= 0 ? i : -1)).filter((i) => i >= 0);
      if (takers.length) outcomesCovered++;
      if (mainNext.get(d) === t) continue; // taken by the main success scenario

      // Follow the first path that takes this outcome until it rejoins the main scenario or ends
      const graphSteps: string[] = [];
      let rejoinStep: number | null = null;
      let ending = "Use case ends";
      if (takers.length) {
        const route = routes[takers[0]];
        const at = routeHasEdge(route, d, t);
        for (let k = at + 1; k < route.length; k++) {
          const s = route[k];
          if (isEnd(s)) break;
          if (mainStepNo.has(s)) {
            rejoinStep = mainStepNo.get(s)!;
            break;
          }
          graphSteps.push(s);
        }
      } else {
        graphSteps.push(t);
        ending = "Not taken by any listed path";
      }

      const fromStep = mainStepNo.get(d) ?? null;
      if (rejoinStep !== null) {
        ending = fromStep !== null && rejoinStep <= fromStep ? `Returns to main step ${rejoinStep}` : `Rejoins main step ${rejoinStep}`;
      }
      const cond = conditionOf(condition, d, t);
      const kind: UseCaseExtension["kind"] = NEGATIVE.test(cond) && rejoinStep === null ? "Exception" : "Alternative";

      let label: string;
      if (fromStep !== null) {
        const n = letters.get(fromStep) || 0;
        letters.set(fromStep, n + 1);
        label = `${fromStep}${String.fromCharCode(97 + (n % 26))}${n >= 26 ? Math.floor(n / 26) : ""}`;
      } else {
        label = `E${String(extensions.length + 1).padStart(2, "0")}`;
      }

      const id = `E${String(extensions.length + 1).padStart(2, "0")}`;
      extensions.push({
        id,
        label,
        kind,
        decision: d,
        condition: cond,
        branchFromStep: fromStep,
        graphSteps,
        ending,
        rejoinStep,
        paths: takers.map((i) => `P${i + 1}`),
        name: `${d}: ${cond}`,
        trigger: `At "${d}", the outcome is: ${cond}.`,
        steps: graphSteps.length
          ? graphSteps.map((s) => ({ actor: "System / User", action: s }))
          : [{ actor: "System", action: ending === "Use case ends" ? "Ends the use case" : `Continues at main step ${rejoinStep}` }],
        acceptanceCriteria: [],
        rules: [],
        wording: "Generated",
      });
    }
  }

  // Traceability: which flows each path uses
  const traceability: TraceRow[] = routes.map((route, i) => {
    const flows = extensions.filter((x) => x.paths.includes(`P${i + 1}`)).map((x) => x.label);
    const decisionOutcomes: string[] = [];
    for (let k = 0; k < route.length - 1; k++) {
      if ((out.get(route[k])?.length || 0) > 1) decisionOutcomes.push(`${route[k]} = ${conditionOf(condition, route[k], route[k + 1])}`);
    }
    return {
      pathId: `P${i + 1}`,
      route: shortRoute(route),
      flows: i === mainIdx ? ["Main", ...flows] : flows.length ? flows : ["Main"],
      decisionOutcomes,
      tests: [`P${i + 1}+`, `P${i + 1}-`],
    };
  });

  return {
    mainRoute: mainInner,
    mainPathId: `P${mainIdx + 1}`,
    extensions,
    traceability,
    coverage: {
      decisions: decisions.length,
      outcomes,
      outcomesCovered,
      paths: routes.length,
      pathsTraced: traceability.length,
      ok: outcomesCovered === outcomes,
    },
  };
}

// Applies the AI's wording to the flows; anything missing keeps the generated text
export function applyFlowWording(
  extensions: UseCaseExtension[],
  wording: Array<{ id?: unknown; name?: unknown; trigger?: unknown; steps?: unknown; acceptanceCriteria?: unknown; rules?: unknown }>
): UseCaseExtension[] {
  const byId = new Map(wording.filter((w) => w && typeof w.id === "string").map((w) => [String(w.id).trim(), w]));
  return extensions.map((x) => {
    const w = byId.get(x.id);
    if (!w) return x;
    const steps = (Array.isArray(w.steps) ? w.steps : [])
      .map((s: any) => ({ actor: norm(s?.actor) || "System", action: norm(s?.action) }))
      .filter((s) => s.action);
    const criteria = (Array.isArray(w.acceptanceCriteria) ? w.acceptanceCriteria : []).map(norm).filter(Boolean);
    if (!steps.length) return x;
    return {
      ...x,
      name: norm(w.name) || x.name,
      trigger: norm(w.trigger) || x.trigger,
      steps,
      acceptanceCriteria: criteria.slice(0, 5),
      rules: (Array.isArray(w.rules) ? w.rules : []).map(norm).filter((r) => /^BR-\d+$/i.test(r)).map((r) => r.toUpperCase()),
      wording: "AI",
    };
  });
}

// When a response is not valid JSON as a whole (cut off, or one bad character), keeps every
// object with an "id" that parses on its own
export function salvageObjects(text: string): any[] {
  const found: any[] = [];
  const stack: number[] = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") stack.push(i);
    else if (c === "}" && stack.length) {
      const start = stack.pop()!;
      try {
        const obj = JSON.parse(text.slice(start, i + 1));
        if (obj && typeof obj.id === "string" && Array.isArray(obj.steps)) found.push(obj);
      } catch {
        // not a whole flow
      }
    }
  }
  return found;
}
