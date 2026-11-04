// Explains the numbers behind M = E - N + 2P from the stored graph (nodes, edges, paths).
// It only reads the graph: it never changes N, E, P or M.
//
// - Nodes are split into Start/End, decision nodes (more than one way out) and action steps.
// - Edges are split into forward transitions and loop-backs (retry / rework arrows).
// - Paths are checked: repeated, looping or broken routes are reported, and the number of
//   distinct Start-to-End routes the graph allows is compared with the number listed.

export interface BreakdownEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface GraphBreakdown {
  nodes: {
    total: number;
    startEnd: number;
    decisions: number;
    actions: number;
    decisionList: string[];
    actionList: string[];
    isolated: string[]; // listed but not connected by any edge
  };
  edges: {
    total: number;
    forward: number;
    loopBack: number;
    fromDecisions: number; // edges leaving decision nodes (the branches)
    loopBackList: Array<{ from: string; to: string; condition?: string }>;
  };
  paths: {
    listed: number;
    unique: number;
    repeated: number;
    loops: number;
    broken: number; // do not run Start to End, or take a step that is not an edge
    graphRoutes: number | null; // every combination of outcomes: loop-free Start-to-End routes (null = too many to count)
    uncoveredBranches: number; // forward edges that no listed path takes
    uncoveredList: Array<{ from: string; to: string; condition?: string }>;
  };
  checks: {
    unreachable: string[]; // cannot be reached from Start
    deadEnds: string[]; // not End and no way out
  };
  // Plain-language notes for the reader (empty when the graph is clean)
  notes: string[];
}

const ROUTE_COUNT_CAP = 500;
const SEARCH_STEP_CAP = 200_000;

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const isStart = (s: string) => /^start$/i.test(s);
const isEnd = (s: string) => /^end$/i.test(s);

export function buildGraphBreakdown(
  nodesIn: unknown,
  edgesIn: unknown,
  pathsIn: unknown
): GraphBreakdown {
  const nodes: string[] = [];
  const seenNodes = new Set<string>();
  for (const n of Array.isArray(nodesIn) ? nodesIn : []) {
    const key = norm(n);
    if (key && !seenNodes.has(key)) {
      seenNodes.add(key);
      nodes.push(key);
    }
  }

  const edges: BreakdownEdge[] = [];
  const edgeKeys = new Set<string>();
  for (const e of Array.isArray(edgesIn) ? edgesIn : []) {
    const from = norm((e as BreakdownEdge)?.from);
    const to = norm((e as BreakdownEdge)?.to);
    if (!from || !to) continue;
    const key = `${from}|${to}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from, to, condition: (e as BreakdownEdge).condition });
    // Edges can name steps that were not in the node list; count them as part of the graph
    for (const n of [from, to]) {
      if (!seenNodes.has(n)) {
        seenNodes.add(n);
        nodes.push(n);
      }
    }
  }

  const out = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const e of edges) {
    out.set(e.from, [...(out.get(e.from) || []), e.to]);
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
  }

  const start = nodes.find(isStart);
  const end = nodes.find(isEnd);

  // Node types
  const decisionList: string[] = [];
  const actionList: string[] = [];
  const isolated: string[] = [];
  let startEnd = 0;
  for (const n of nodes) {
    if (isStart(n) || isEnd(n)) {
      startEnd += 1;
      continue;
    }
    const outs = out.get(n)?.length || 0;
    if (outs === 0 && !inDeg.get(n)) isolated.push(n);
    if (outs > 1) decisionList.push(n);
    else actionList.push(n);
  }

  // Loop-back edges: an edge that returns to a step already on the current route (DFS from Start)
  const loopBackList: BreakdownEdge[] = [];
  const reachable = new Set<string>();
  if (start) {
    const onStack = new Set<string>();
    const visit = (n: string) => {
      reachable.add(n);
      onStack.add(n);
      for (const next of out.get(n) || []) {
        if (onStack.has(next)) {
          const edge = edges.find((e) => e.from === n && e.to === next);
          if (edge) loopBackList.push(edge);
        } else if (!reachable.has(next)) {
          visit(next);
        }
      }
      onStack.delete(n);
    };
    visit(start);
  }
  const fromDecisions = edges.filter((e) => (out.get(e.from)?.length || 0) > 1).length;

  // Checks
  const unreachable = start ? nodes.filter((n) => !reachable.has(n)) : [];
  const deadEnds = nodes.filter((n) => !isEnd(n) && !(out.get(n)?.length) && reachable.has(n));

  // Distinct loop-free Start-to-End routes the graph allows
  let graphRoutes: number | null = null;
  if (start && end) {
    let count = 0;
    let steps = 0;
    let aborted = false;
    const onRoute = new Set<string>([start]);
    const walk = (n: string) => {
      if (aborted) return;
      if (++steps > SEARCH_STEP_CAP || count > ROUTE_COUNT_CAP) {
        aborted = true;
        return;
      }
      if (n === end) {
        count += 1;
        return;
      }
      for (const next of out.get(n) || []) {
        if (onRoute.has(next)) continue;
        onRoute.add(next);
        walk(next);
        onRoute.delete(next);
      }
    };
    walk(start);
    graphRoutes = aborted ? null : count;
  }

  // Listed paths
  const pathsArr = Array.isArray(pathsIn) ? pathsIn : [];
  const routeKeys = new Set<string>();
  let repeated = 0;
  let loops = 0;
  let broken = 0;
  for (const raw of pathsArr) {
    const steps = (Array.isArray(raw) ? raw : []).map(norm).filter(Boolean);
    const key = steps.join("|");
    if (steps.length < 2) {
      broken += 1;
      continue;
    }
    if (routeKeys.has(key)) {
      repeated += 1;
      continue;
    }
    routeKeys.add(key);
    if (new Set(steps).size !== steps.length) {
      loops += 1;
      continue;
    }
    const runsStartToEnd = isStart(steps[0]) && isEnd(steps[steps.length - 1]);
    const followsEdges = steps.every((s, i) => i === 0 || edgeKeys.has(`${steps[i - 1]}|${s}`));
    if (!runsStartToEnd || !followsEdges) broken += 1;
  }
  const unique = pathsArr.length - repeated;

  // Branch coverage: every forward edge (each decision outcome) should be taken by at least one path.
  // Loop-backs are excluded: a loop-free path cannot take them.
  const covered = new Set<string>();
  for (const raw of pathsArr) {
    const steps = (Array.isArray(raw) ? raw : []).map(norm).filter(Boolean);
    for (let i = 1; i < steps.length; i++) covered.add(`${steps[i - 1]}|${steps[i]}`);
  }
  const loopKeys = new Set(loopBackList.map((l) => `${l.from}|${l.to}`));
  // A branch that only leads back into a loop (e.g. "test failed -> retry") cannot be on a
  // loop-free Start-to-End path; it is tested through the loop, so it is not a coverage gap.
  const uncoveredList: BreakdownEdge[] = [];
  let loopOnlyBranches = 0;
  if (start && end) {
    for (const e of edges) {
      const key = `${e.from}|${e.to}`;
      if (!reachable.has(e.from) || loopKeys.has(key) || covered.has(key)) continue;
      if (routeThroughEdge(out, start, end, e)) uncoveredList.push(e);
      else if ((out.get(e.from)?.length || 0) > 1) loopOnlyBranches += 1;
    }
  }

  const notes: string[] = [];
  if (repeated) notes.push(`${repeated} path(s) are listed more than once; each route should be counted once.`);
  if (loops) notes.push(`${loops} listed path(s) visit the same step twice (a loop); a loop is shown as a loop-back edge, not as a separate path.`);
  if (broken) notes.push(`${broken} listed path(s) do not run from Start to End along the drawn edges.`);
  if (unreachable.length) notes.push(`${unreachable.length} step(s) cannot be reached from Start: ${unreachable.slice(0, 5).join(", ")}${unreachable.length > 5 ? ", …" : ""}.`);
  if (deadEnds.length) notes.push(`${deadEnds.length} step(s) have no way out and are not End: ${deadEnds.slice(0, 5).join(", ")}${deadEnds.length > 5 ? ", …" : ""}.`);
  if (uncoveredList.length) {
    const shown = uncoveredList.slice(0, 5).map((e) => `${e.from} → ${e.to}`).join("; ");
    notes.push(`${uncoveredList.length} branch(es) are not taken by any listed path, so their outcome would go untested: ${shown}${uncoveredList.length > 5 ? "; …" : ""}.`);
  }
  if (loopOnlyBranches) {
    notes.push(
      `${loopOnlyBranches} branch(es) never reach End without going round a loop (for example a failure that always retries). ` +
        `They have no Start-to-End path of their own; if the requirement has a way out (give up, reject, escalate), add it so the outcome can be tested.`
    );
  }
  if (!start || !end) notes.push("The graph has no Start or End node.");

  return {
    nodes: {
      total: nodes.length,
      startEnd,
      decisions: decisionList.length,
      actions: actionList.length,
      decisionList,
      actionList,
      isolated,
    },
    edges: {
      total: edges.length,
      forward: edges.length - loopBackList.length,
      loopBack: loopBackList.length,
      fromDecisions,
      loopBackList,
    },
    paths: {
      listed: pathsArr.length,
      unique,
      repeated,
      loops,
      broken,
      graphRoutes,
      uncoveredBranches: uncoveredList.length,
      uncoveredList,
    },
    checks: { unreachable, deadEnds },
    notes,
  };
}

// Shortest route from `from` to `to` that avoids the `blocked` steps (breadth-first).
function shortestRoute(out: Map<string, string[]>, from: string, to: string, blocked: Set<string>): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) {
      const route: string[] = [];
      for (let s: string | null = cur; s !== null; s = prev.get(s) ?? null) route.unshift(s);
      return route;
    }
    for (const next of out.get(cur) || []) {
      if (prev.has(next) || blocked.has(next)) continue;
      prev.set(next, cur);
      queue.push(next);
    }
  }
  return null;
}

// A loop-free Start-to-End route that takes the given edge (shortest way in, then out), or null.
function routeThroughEdge(out: Map<string, string[]>, start: string, end: string, edge: BreakdownEdge): string[] | null {
  const head = shortestRoute(out, start, edge.from, new Set([edge.to]));
  if (!head) return null;
  const tail = shortestRoute(out, edge.to, end, new Set(head));
  return tail ? [...head, ...tail] : null;
}

// Makes sure every branch (forward edge) is taken by at least one listed path: for each
// branch no path takes, adds one loop-free Start-to-End route through it. Branches that only
// lead into a loop are left out. Returns how many paths were added; `paths` is extended.
export function completeBranchCoverage(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
  paths: string[][]
): number {
  const start = nodes.map(norm).find(isStart);
  const end = nodes.map(norm).find(isEnd);
  if (!start || !end) return 0;
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(norm(e.from), [...(out.get(norm(e.from)) || []), norm(e.to)]);

  let added = 0;
  // Each added path covers at least one more branch, so this ends after at most |E| rounds
  for (let round = 0; round < edges.length; round++) {
    const next = buildGraphBreakdown(nodes, edges, paths).paths.uncoveredList[0];
    if (!next) break;
    const route = routeThroughEdge(out, start, end, next);
    if (!route) break;
    paths.push(route);
    added += 1;
  }
  return added;
}

// One formula line: "N=30, E=42, P=9 → M = 42 - 30 + 2(9) = 30"
export function formulaLine(n: number, e: number, p: number): string {
  return `N=${n}, E=${e}, P=${p} → M = ${e} - ${n} + 2(${p}) = ${e - n + 2 * p}`;
}

// Older records repeat the counts ("N=30, E=42, P=9 → N=30, E=42, P=9 → M = ...").
// Collapse any repeated "N=.., E=.., P=.. →" prefix to a single one.
export function cleanFormulaText(text: string): string {
  return String(text ?? "").replace(
    /(N=\d+,\s*E=\d+,\s*P=\d+\s*→\s*)(?:N=\d+,\s*E=\d+,\s*P=\d+\s*→\s*)+/g,
    "$1"
  );
}
