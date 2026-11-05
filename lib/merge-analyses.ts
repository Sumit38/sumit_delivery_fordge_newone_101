// Combines the control-flow graphs of 2-3 separately analysed requirement
// documents into one graph and scores it with the same rule as a single
// analysis: M = E - N + 2P, where P = distinct Start-to-End paths.
//
// How the graphs are joined:
// - Start and End are shared by every document.
// - A step with the same name in two documents (ignoring case, spacing and
//   trailing punctuation) is treated as one shared step.
// - Every other step, edge and path is kept as listed in its own document.
// - Repeated edges and paths are counted once, and every step a path takes
//   exists as an edge, so the score and the Mermaid graph always agree.

import { dedupeGraphLists } from "./complexity-analyzer";

export interface MergeInputEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface MergeInputDocument {
  requirementId?: string;
  title: string;
  nodes: string[];
  edges: MergeInputEdge[];
  paths: string[][];
  // Score saved for the document on its own
  nodesCount?: number;
  edgesCount?: number;
  pathsCount?: number;
  complexityScore?: number;
}

export interface MergedDocumentSummary {
  requirementId?: string;
  title: string;
  n: number;
  e: number;
  p: number;
  m: number;
  // Added when the combined analysis is saved
  confidenceScore?: number | null;
  analysisMode?: string | null;
}

// Which documents (0-based) each part of the combined graph came from
export interface MergeOrigins {
  nodes: Record<string, number[]>;
  edges: number[][]; // same order as MergedAnalysis.edges
  paths: number[][]; // same order as MergedAnalysis.paths
}

export interface MergedAnalysis {
  nodes: string[];
  edges: MergeInputEdge[];
  paths: string[][];
  n: number;
  e: number;
  p: number;
  m: number;
  testScenarios: number;
  calculation: string;
  sharedSteps: string[];
  documents: MergedDocumentSummary[];
  origins: MergeOrigins;
}

const isStart = (label: string) => /^start$/i.test(label.trim());
const isEnd = (label: string) => /^end$/i.test(label.trim());

// Key used to decide whether two step names are the same step
export function stepKey(label: string): string {
  const text = String(label ?? "").replace(/\s+/g, " ").trim();
  if (isStart(text)) return "start";
  if (isEnd(text)) return "end";
  return text.toLowerCase().replace(/[.,;:!?]+$/, "").trim();
}

// `aliases` maps a step key to the key of the same step in an earlier document
// (from step matching), so differently worded steps can be counted once.
export function mergeAnalyses(docs: MergeInputDocument[], aliases: Record<string, string> = {}): MergedAnalysis {
  if (docs.length < 2) throw new Error("At least 2 analysed documents are needed to combine");

  // One label per step; the first document's spelling wins
  const labelByKey = new Map<string, string>();
  const docsByKey = new Map<string, Set<number>>();
  const canonical = (label: string, docIndex: number) => {
    const own = stepKey(label);
    const key = aliases[own] && labelByKey.has(aliases[own]) ? aliases[own] : own;
    if (!labelByKey.has(key)) {
      labelByKey.set(key, key === "start" ? "Start" : key === "end" ? "End" : String(label).replace(/\s+/g, " ").trim());
    }
    if (!docsByKey.has(key)) docsByKey.set(key, new Set());
    docsByKey.get(key)!.add(docIndex);
    return labelByKey.get(key)!;
  };

  const nodes: string[] = [];
  const edges: MergeInputEdge[] = [];
  const paths: string[][] = [];

  const edgeDocs = new Map<string, Set<number>>();
  const pathDocs = new Map<string, Set<number>>();
  const addOrigin = (map: Map<string, Set<number>>, key: string, doc: number) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(doc);
  };

  docs.forEach((doc, i) => {
    (doc.nodes || []).forEach((node) => nodes.push(canonical(node, i)));
    (doc.edges || []).forEach((edge) => {
      const merged = { from: canonical(edge.from, i), to: canonical(edge.to, i), condition: edge.condition };
      edges.push(merged);
      addOrigin(edgeDocs, `${merged.from}|${merged.to}`, i);
    });
    (doc.paths || []).forEach((path) => {
      if (!Array.isArray(path)) return;
      const merged = path.map((step) => canonical(step, i));
      paths.push(merged);
      addOrigin(pathDocs, merged.join("|"), i);
      // A step a path takes belongs to that document even if its edge list missed it
      for (let s = 0; s < merged.length - 1; s++) addOrigin(edgeDocs, `${merged[s]}|${merged[s + 1]}`, i);
    });
  });

  // Steps that only appear in edges or paths still count as nodes
  edges.forEach((edge) => nodes.push(edge.from, edge.to));
  paths.forEach((path) => nodes.push(...path));
  if (!nodes.some(isStart)) nodes.unshift("Start");
  if (!nodes.some(isEnd)) nodes.push("End");

  const unique = dedupeGraphLists(nodes, edges, paths);

  // Every step a path takes must exist as an edge
  const edgeKeys = new Set(unique.edges.map((edge) => `${edge.from}|${edge.to}`));
  for (const path of unique.paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}|${path[i + 1]}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        unique.edges.push({ from: path[i], to: path[i + 1], condition: "implied by path" });
      }
    }
  }

  // Start and End come first and last, as in a single analysis
  const middle = unique.nodes.filter((node) => !isStart(node) && !isEnd(node));
  const mergedNodes = ["Start", ...middle, "End"];

  const n = mergedNodes.length;
  const e = unique.edges.length;
  const p = Math.max(unique.paths.length, 1);
  const m = e - n + 2 * p;

  const sharedSteps = [...docsByKey.entries()]
    .filter(([key, owners]) => key !== "start" && key !== "end" && owners.size > 1)
    .map(([key]) => labelByKey.get(key)!);

  const sorted = (set?: Set<number>) => [...(set || [])].sort((a, b) => a - b);
  const origins: MergeOrigins = {
    nodes: Object.fromEntries(mergedNodes.map((label) => [label, sorted(docsByKey.get(stepKey(label)))])),
    edges: unique.edges.map((edge) => sorted(edgeDocs.get(`${edge.from}|${edge.to}`))),
    paths: unique.paths.map((path) => sorted(pathDocs.get(path.join("|")))),
  };
  // Start and End belong to every document
  for (const label of ["Start", "End"]) origins.nodes[label] = docs.map((_, i) => i);

  const documents = docs.map((doc) => {
    const dn = doc.nodesCount ?? doc.nodes.length;
    const de = doc.edgesCount ?? doc.edges.length;
    const dp = doc.pathsCount ?? Math.max(doc.paths.length, 1);
    return {
      requirementId: doc.requirementId,
      title: doc.title,
      n: dn,
      e: de,
      p: dp,
      m: doc.complexityScore ?? de - dn + 2 * dp,
    };
  });

  return {
    nodes: mergedNodes,
    edges: unique.edges,
    paths: unique.paths,
    n,
    e,
    p,
    m,
    testScenarios: 2 * p,
    calculation: `M = E - N + 2P = ${e} - ${n} + 2(${p}) = ${m}`,
    sharedSteps,
    documents,
    origins,
  };
}
