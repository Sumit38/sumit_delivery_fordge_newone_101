// Compares the documents inside a combined analysis (for example two regions):
// which steps and paths they share, where similar paths split, and which shared
// decisions lead to different outcomes. Pure code, no AI. Nothing here changes N, E, P or M.

import type { MergeInputEdge, MergeOrigins } from "./merge-analyses";

// One place where two paths differ: after the shared step `after`, this path takes
// `thisSteps` and the other path takes `otherSteps`, then they meet again at `rejoin`.
export interface PathDifference {
  after: string;
  thisSteps: string[];
  otherSteps: string[];
  rejoin: string;
}

export interface PathComparison {
  path: string; // "P3"
  doc: number;
  closestPath: string | null; // closest path in the other document
  otherDoc: number;
  sharedSteps: number; // steps both paths take in the same order (Start/End excluded)
  steps: number; // steps in this path (Start/End excluded)
  differences: PathDifference[];
}

export interface DecisionDifference {
  step: string;
  outcomes: Array<{ doc: number; outcomes: string[] }>; // "condition → next step"
}

export interface DocumentComparison {
  docTitles: string[];
  commonPaths: string[]; // "P2" — the same Start-to-End route in more than one document
  onlySteps: Array<{ doc: number; steps: string[] }>; // steps only one document has
  paths: PathComparison[];
  decisions: DecisionDifference[];
}

const isTerminal = (s: string) => /^(start|end)$/i.test(s.trim());

const MAX_DIFFERENCES = 8;
const MAX_STEPS_SHOWN = 8;

// Longest common subsequence alignment of two routes (both run Start to End)
function align(a: string[], b: string[]): Array<{ type: "same" | "this" | "other"; step: string }> {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Array<{ type: "same" | "this" | "other"; step: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      ops.push({ type: "same", step: a[i] });
      i++;
      j++;
    } else if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) {
      ops.push({ type: "this", step: a[i++] });
    } else {
      ops.push({ type: "other", step: b[j++] });
    }
  }
  return ops;
}

// The stretches where two routes differ, between steps they share
export function pathDifferences(a: string[], b: string[]): { same: number; differences: PathDifference[] } {
  const ops = align(a, b);
  const differences: PathDifference[] = [];
  let after = a[0] || "Start";
  let current: PathDifference | null = null;
  let same = 0;
  for (const op of ops) {
    if (op.type === "same") {
      if (!isTerminal(op.step)) same++;
      if (current) {
        current.rejoin = op.step;
        differences.push(current);
        current = null;
      }
      after = op.step;
    } else {
      current = current || { after, thisSteps: [], otherSteps: [], rejoin: "End" };
      (op.type === "this" ? current.thisSteps : current.otherSteps).push(op.step);
    }
  }
  if (current) differences.push(current);
  return {
    same,
    differences: differences.slice(0, MAX_DIFFERENCES).map((d) => ({
      ...d,
      thisSteps: d.thisSteps.slice(0, MAX_STEPS_SHOWN),
      otherSteps: d.otherSteps.slice(0, MAX_STEPS_SHOWN),
    })),
  };
}

export function compareDocuments(
  docTitles: string[],
  edges: MergeInputEdge[],
  paths: string[][],
  origins: MergeOrigins
): DocumentComparison {
  const docs = docTitles.map((_, i) => i);
  const pathName = (i: number) => `P${i + 1}`;

  // Each path's owners; a path is "common" when more than one document lists it
  const commonPaths = paths.map((_, i) => i).filter((i) => (origins.paths[i] || []).length > 1).map(pathName);

  const onlySteps = docs.map((doc) => ({
    doc,
    steps: Object.entries(origins.nodes)
      .filter(([label, owners]) => !isTerminal(label) && owners.length === 1 && owners[0] === doc)
      .map(([label]) => label),
  }));

  // For each path, the most similar path of every other document and where they split
  const pathsOf = (doc: number) => paths.map((p, i) => ({ p, i })).filter(({ i }) => (origins.paths[i] || []).includes(doc));
  const comparisons: PathComparison[] = [];
  for (const doc of docs) {
    for (const { p, i } of pathsOf(doc)) {
      if ((origins.paths[i] || []).length > 1) continue; // common paths need no comparison
      const inner = p.filter((s) => !isTerminal(s)).length;
      for (const other of docs) {
        if (other === doc) continue;
        let best: { i: number; same: number; extra: number; differences: PathDifference[] } | null = null;
        // Common paths are already listed as common, so compare with the other document's own paths first
        const ownOfOther = pathsOf(other).filter(({ i: j }) => (origins.paths[j] || []).length === 1);
        for (const cand of ownOfOther.length ? ownOfOther : pathsOf(other)) {
          const { same, differences } = pathDifferences(p, cand.p);
          const extra = cand.p.length - same; // fewer unrelated steps = closer
          if (!best || same > best.same || (same === best.same && extra < best.extra)) {
            best = { i: cand.i, same, extra, differences };
          }
        }
        comparisons.push({
          path: pathName(i),
          doc,
          closestPath: best ? pathName(best.i) : null,
          otherDoc: other,
          sharedSteps: best ? best.same : 0,
          steps: inner,
          differences: best ? best.differences : [],
        });
      }
    }
  }

  // Decisions both documents have, whose outcomes differ
  const outcomesBy = new Map<string, Map<number, string[]>>();
  edges.forEach((edge, i) => {
    for (const doc of origins.edges[i] || []) {
      if (!outcomesBy.has(edge.from)) outcomesBy.set(edge.from, new Map());
      const perDoc = outcomesBy.get(edge.from)!;
      if (!perDoc.has(doc)) perDoc.set(doc, []);
      const cond = String(edge.condition || "").trim();
      perDoc.get(doc)!.push(`${cond && !/^(default|implied by path)$/i.test(cond) ? `${cond} → ` : "→ "}${edge.to}`);
    }
  });
  const decisions: DecisionDifference[] = [];
  for (const [step, perDoc] of outcomesBy) {
    if (isTerminal(step) || perDoc.size < 2) continue;
    const lists = [...perDoc.entries()].sort((a, b) => a[0] - b[0]);
    if (!lists.some(([, outs]) => outs.length > 1)) continue; // not a decision anywhere
    const targets = lists.map(([, outs]) => outs.map((o) => o.split("→ ").pop()).sort().join("|"));
    if (new Set(targets).size > 1) {
      decisions.push({ step, outcomes: lists.map(([doc, outs]) => ({ doc, outcomes: outs })) });
    }
  }

  return { docTitles, commonPaths, onlySteps, paths: comparisons, decisions };
}
