// Builds Mermaid diagrams from a stored analysis (nodes, edges, paths) and
// downloads a self-contained HTML report that explains how the flow and the
// complexity score were derived. Nothing here changes N, E, P or M.

import { buildGraphBreakdown, cleanFormulaText, type GraphBreakdown } from "./graph-breakdown";
import type { MergeOrigins } from "./merge-analyses";
import type { DocumentComparison } from "./merge-compare";

export interface FlowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface AnalysisDetails {
  requirement: { id: string; title: string; text?: string; createdAt?: string };
  analysis: {
    complexityScore: number;
    nodesCount: number;
    edgesCount: number;
    paths: number;
    testScenarios?: number;
  };
  metrics: {
    calculation?: string;
    nodes: string[];
    edges: FlowEdge[];
    paths: string[][];
    decisionPoints?: string[];
    breakdown?: GraphBreakdown;
  };
  reasoning?: {
    analysis?: string;
    detailed?: string;
    confidenceScore?: number;
    confidenceReason?: string;
  };
  // Set when the analysis combines several requirement documents
  merge?: {
    documents: Array<{ title: string; n: number; e: number; p: number; m: number; confidenceScore?: number | null; analysisMode?: string | null }>;
    sharedSteps: string[];
    origins?: MergeOrigins;
    comparison?: DocumentComparison;
    stepMatches?: Array<{ doc: number; step: string; matchedDoc: number; matchedStep: string }>;
  };
}

const MAX_TREE_NODES = 150;

// Mermaid label text: quoted, with characters that break the parser replaced by entities.
function mermaidText(text: string): string {
  return String(text)
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .replace(/[|]/g, "/")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Decision boxes are diamonds, which grow in both directions with their text, so a
// long label pushes the graph out of the window. Their text is wrapped onto at most
// two short lines and cut with "…"; the full name stays in the tables and the outline.
const DECISION_LINE_CHARS = 22;
const DECISION_MAX_LINES = 2;

export function shortLines(text: string, lineChars = DECISION_LINE_CHARS, maxLines = DECISION_MAX_LINES): string[] {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let cut = false;
  for (const raw of words) {
    const word = raw.length > lineChars ? `${raw.slice(0, lineChars - 1)}…` : raw;
    const next = current ? `${current} ${word}` : word;
    if (next.length <= lineChars) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) {
      cut = true;
      break;
    }
  }
  if (!cut && current) lines.push(current);
  if (cut || lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1].replace(/…$/, "");
    kept[maxLines - 1] = `${last.length > lineChars - 1 ? last.slice(0, lineChars - 1) : last}…`;
    return kept;
  }
  return lines;
}

function decisionLabel(text: string): string {
  return shortLines(text).map(mermaidText).join("<br/>");
}

const isStart = (name: string) => /^start$/i.test(name.trim());
const isEnd = (name: string) => /^end$/i.test(name.trim());

// Nodes with more than one outgoing edge are where the flow branches.
export function findBranchNodes(edges: FlowEdge[]): string[] {
  const outCount = new Map<string, number>();
  edges.forEach((e) => outCount.set(e.from, (outCount.get(e.from) || 0) + 1));
  return [...outCount.entries()].filter(([, c]) => c > 1).map(([n]) => n);
}

// Region colours for combined analyses: one per document, plus one for shared parts
export const SHARED_COLOR = { fill: "#f1f5f9", stroke: "#334155", text: "#0f172a" };
export const REGION_COLORS = [
  { fill: "#ffedd5", stroke: "#ea580c", text: "#7c2d12" },
  { fill: "#ede9fe", stroke: "#7c3aed", text: "#4c1d95" },
  { fill: "#ccfbf1", stroke: "#0d9488", text: "#134e4a" },
];

// Keeps only the steps and transitions one document has (for the per-region view).
export function filterToDocument(
  nodes: string[],
  edges: FlowEdge[],
  origins: MergeOrigins,
  doc: number
): { nodes: string[]; edges: FlowEdge[]; origins: MergeOrigins } {
  const keepEdge = edges.map((_, i) => (origins.edges[i] || []).includes(doc));
  return {
    nodes: nodes.filter((n) => (origins.nodes[n] || []).includes(doc)),
    edges: edges.filter((_, i) => keepEdge[i]),
    origins: { ...origins, edges: origins.edges.filter((_, i) => keepEdge[i]) },
  };
}

// Control-flow graph: every node and edge from the analysis, drawn top to bottom.
// With `regions` (a combined analysis), shared steps and transitions are drawn in one
// colour and each document's own ones in its region colour.
export function buildFlowMermaid(nodes: string[], inputEdges: FlowEdge[], regions?: MergeOrigins): string {
  // Older saved analyses can list the same edge twice; draw each arrow once
  const seenEdges = new Set<string>();
  const edgeOwners: number[][] = [];
  const edges = inputEdges.filter((e, i) => {
    const key = `${e.from}|${e.to}`;
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
    edgeOwners.push(regions?.edges[i] || []);
    return true;
  });
  const allNodes = [...new Set(nodes)];
  edges.forEach((e) => {
    if (!allNodes.includes(e.from)) allNodes.push(e.from);
    if (!allNodes.includes(e.to)) allNodes.push(e.to);
  });

  const ids = new Map<string, string>();
  allNodes.forEach((n, i) => ids.set(n, `N${i + 1}`));
  const branches = new Set(findBranchNodes(edges));

  const lines = ["flowchart TD"];
  allNodes.forEach((n) => {
    const id = ids.get(n)!;
    const label = mermaidText(n);
    if (isStart(n) || isEnd(n)) lines.push(`  ${id}(["${label}"])`);
    else if (branches.has(n)) lines.push(`  ${id}{"${decisionLabel(n)}"}`);
    else lines.push(`  ${id}["${label}"]`);
  });
  edges.forEach((e) => {
    const cond = e.condition && e.condition.toLowerCase() !== "default" ? mermaidText(e.condition) : "";
    lines.push(`  ${ids.get(e.from)} -->${cond ? `|"${cond}"|` : ""} ${ids.get(e.to)}`);
  });

  lines.push("  classDef startEnd fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b");
  const startEnd = allNodes.filter((n) => isStart(n) || isEnd(n)).map((n) => ids.get(n));

  if (regions) {
    pushRegionClassDefs(lines);
    const groups = new Map<string, string[]>();
    allNodes.forEach((n) => {
      if (isStart(n) || isEnd(n)) return;
      const owners = regions.nodes[n] || [];
      const cls = regionClass(owners);
      if (cls) groups.set(cls, [...(groups.get(cls) || []), ids.get(n)!]);
    });
    if (startEnd.length) lines.push(`  class ${startEnd.join(",")} startEnd`);
    groups.forEach((list, cls) => lines.push(`  class ${list.join(",")} ${cls}`));
    pushRegionLinkStyles(lines, edgeOwners);
    return lines.join("\n");
  }

  lines.push("  classDef branch fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a8a");
  const branchIds = allNodes.filter((n) => branches.has(n) && !isStart(n) && !isEnd(n)).map((n) => ids.get(n));
  if (startEnd.length) lines.push(`  class ${startEnd.join(",")} startEnd`);
  if (branchIds.length) lines.push(`  class ${branchIds.join(",")} branch`);

  return lines.join("\n");
}

function pushRegionClassDefs(lines: string[]) {
  const style = (c: { fill: string; stroke: string; text: string }) => `fill:${c.fill},stroke:${c.stroke},stroke-width:2px,color:${c.text}`;
  lines.push(`  classDef shared ${style(SHARED_COLOR)}`);
  REGION_COLORS.forEach((c, i) => lines.push(`  classDef region${i} ${style(c)}`));
}

// "shared" when more than one document has it, "region<i>" when only document i has it
function regionClass(owners: number[]): string {
  if (owners.length > 1) return "shared";
  return owners.length === 1 && owners[0] < REGION_COLORS.length ? `region${owners[0]}` : "";
}

// Colours each arrow; `edgeOwners` is in the order the arrows were written
function pushRegionLinkStyles(lines: string[], edgeOwners: number[][]) {
  const links = new Map<string, number[]>();
  edgeOwners.forEach((owners, i) => {
    const color = owners.length > 1 ? SHARED_COLOR.stroke : owners.length === 1 ? REGION_COLORS[owners[0]]?.stroke : undefined;
    if (color) links.set(color, [...(links.get(color) || []), i]);
  });
  links.forEach((list, color) => lines.push(`  linkStyle ${list.join(",")} stroke:${color},stroke-width:2px`));
}

export interface PathTreeNode {
  id: string;
  label: string;
  children: Map<string, PathTreeNode>;
  pathNos: number[];
}

// Path tree: the Start-to-End paths merged on their shared prefixes, so each
// fork shows where one path splits into several. Leaves are labelled P1..Pn.
export function buildPathTree(paths: string[][]): { root: PathTreeNode; size: number } | null {
  if (!paths.length) return null;

  type TrieNode = PathTreeNode;
  let counter = 0;
  const root: TrieNode = { id: "T0", label: paths[0][0] || "Start", children: new Map(), pathNos: [] };

  const seenPaths = new Set<string>();
  paths.forEach((path, idx) => {
    // Skip a path already drawn (older saved analyses can repeat one); numbers stay as listed
    const key = path.join("|");
    if (seenPaths.has(key)) return;
    seenPaths.add(key);
    let current = root;
    path.slice(1).forEach((step) => {
      let child = current.children.get(step);
      if (!child) {
        counter += 1;
        child = { id: `T${counter}`, label: step, children: new Map(), pathNos: [] };
        current.children.set(step, child);
      }
      current = child;
    });
    current.pathNos.push(idx + 1);
  });

  return { root, size: counter + 1 };
}

// True when the path tree has too many steps to draw inside the report
export function isPathTreeTooLarge(paths: string[][]): boolean {
  const tree = buildPathTree(paths);
  return !!tree && tree.size > MAX_TREE_NODES;
}

// "P1, P2, P3 +4 more" — long lists of path numbers would stretch the box
function pathList(pathNos: number[], max = 5): string {
  const shown = pathNos.slice(0, max).map((n) => `P${n}`).join(", ");
  return pathNos.length > max ? `${shown} +${pathNos.length - max} more` : shown;
}

// Which documents' paths pass through each step of the tree (combined analyses)
function treeOwners(root: PathTreeNode, pathDocs: number[][]): Map<string, number[]> {
  const owners = new Map<string, number[]>();
  const visit = (node: PathTreeNode): Set<number> => {
    const docs = new Set<number>();
    node.pathNos.forEach((n) => (pathDocs[n - 1] || []).forEach((d) => docs.add(d)));
    node.children.forEach((child) => visit(child).forEach((d) => docs.add(d)));
    owners.set(node.id, [...docs].sort((a, b) => a - b));
    return docs;
  };
  visit(root);
  return owners;
}

// Mermaid source for the path tree. The report draws it left to right and stops
// at MAX_TREE_NODES; the full-page view draws it top to bottom with no limit.
// With `regions` (a combined analysis: the documents of each path, in path order),
// steps and arrows are coloured shared / only-in-one-document like the flow graph.
export function buildPathTreeMermaid(
  paths: string[][],
  options: { direction?: "LR" | "TD"; maxNodes?: number; regions?: number[][] } = {}
): string | null {
  const tree = buildPathTree(paths);
  if (!tree) return null;
  if (tree.size > (options.maxNodes ?? MAX_TREE_NODES)) return null;
  const { root } = tree;
  const owners = options.regions ? treeOwners(root, options.regions) : null;

  const lines = [`flowchart ${options.direction || "LR"}`];
  const edgeOwners: number[][] = [];
  const walk = (node: PathTreeNode) => {
    const suffix = node.pathNos.length ? ` ✓ ${pathList(node.pathNos)}` : "";
    if (node.children.size > 1) lines.push(`  ${node.id}{"${decisionLabel(node.label)}${suffix}"}`);
    else lines.push(`  ${node.id}["${mermaidText(node.label)}${suffix}"]`);
    node.children.forEach((child) => {
      lines.push(`  ${node.id} --> ${child.id}`);
      edgeOwners.push(owners?.get(child.id) || []);
      walk(child);
    });
  };
  walk(root);

  if (owners) {
    lines.push("  classDef startEnd fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b");
    pushRegionClassDefs(lines);
    const groups = new Map<string, string[]>();
    const visit = (node: PathTreeNode) => {
      const cls = isStart(node.label) || isEnd(node.label) ? "startEnd" : regionClass(owners.get(node.id) || []);
      if (cls) groups.set(cls, [...(groups.get(cls) || []), node.id]);
      node.children.forEach(visit);
    };
    visit(root);
    groups.forEach((list, cls) => lines.push(`  class ${list.join(",")} ${cls}`));
    pushRegionLinkStyles(lines, edgeOwners);
  }
  return lines.join("\n");
}

// Mermaid's drawing is meant for a web page: its labels are HTML, which can contain
// tags like <br> that are not valid in a standalone .svg file. Re-writing it as XML
// (the browser does the conversion) makes the downloaded file open everywhere.
export function svgForDownload(svg: string): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return header + svg.replace(/<br\s*>/gi, "<br/>").replace(/&nbsp;/g, "&#160;");
  }
  const element = new DOMParser().parseFromString(svg, "text/html").querySelector("svg");
  if (!element) return svg;
  return header + new XMLSerializer().serializeToString(element);
}

export async function renderSvg(code: string, id: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  // Raised size limits so large graphs draw instead of failing on Mermaid's defaults
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    maxTextSize: 2_000_000,
    maxEdges: 20_000,
  });
  const { svg } = await mermaid.render(id, code);
  return svg;
}

function regionLegendHtml(titles: string[]): string {
  const sw = (c: { fill: string; stroke: string }) => `<i class="sw" style="background:${c.fill};border:1px solid ${c.stroke}"></i>`;
  return [
    `<span><i class="sw" style="background:#d1fae5;border:1px solid #059669"></i>Start / End</span>`,
    `<span>${sw(SHARED_COLOR)}In more than one document</span>`,
    ...titles.map((t, i) => (REGION_COLORS[i] ? `<span>${sw(REGION_COLORS[i])}Only in ${escapeHtml(t)}</span>` : "")),
    `<span>Diamond = decision point</span>`,
  ].join("");
}

// Region comparison: common paths, where similar paths split, decisions that differ
function comparisonHtml(c: DocumentComparison, matches: NonNullable<AnalysisDetails["merge"]>["stepMatches"] = []): string {
  const t = (i: number) => escapeHtml(c.docTitles[i] || `Document ${i + 1}`);
  const only = c.onlySteps
    .map((o) => `<p><b>Only in ${t(o.doc)} (${o.steps.length}):</b> ${o.steps.length ? o.steps.map(escapeHtml).join(", ") : "none"}</p>`)
    .join("");
  const pathRows = c.paths
    .map(
      (r) => `<tr><td>${r.path} (${t(r.doc)})</td><td>${r.closestPath ? `${r.closestPath} (${t(r.otherDoc)})` : "none"}</td><td>${r.sharedSteps} of ${r.steps}</td><td>${
        r.differences.length
          ? `<ol style="margin:0;padding-left:18px">${r.differences
              .map(
                (d) =>
                  `<li>After <b>${escapeHtml(d.after)}</b>: ${t(r.doc)} &rarr; ${escapeHtml(d.thisSteps.join(", ") || "(goes straight on)")}; ${t(r.otherDoc)} &rarr; ${escapeHtml(d.otherSteps.join(", ") || "(goes straight on)")}; back together at <b>${escapeHtml(d.rejoin)}</b></li>`
              )
              .join("")}</ol>`
          : "Same steps in the same order"
      }</td></tr>`
    )
    .join("");
  const decisionRows = c.decisions
    .map(
      (dd) => `<tr><td>${escapeHtml(dd.step)}</td><td>${dd.outcomes
        .map((o) => `<b>${t(o.doc)}:</b> ${o.outcomes.map(escapeHtml).join("; ")}`)
        .join("<br>")}</td></tr>`
    )
    .join("");
  const matchList = (matches || [])
    .map((m) => `<li>&ldquo;${escapeHtml(m.step)}&rdquo; (${t(m.doc)}) = &ldquo;${escapeHtml(m.matchedStep)}&rdquo; (${t(m.matchedDoc)})</li>`)
    .join("");
  return `
  <h2>Common and different paths</h2>
  <div class="card">
    <p><b>Common paths (same route in more than one document):</b> ${c.commonPaths.length ? c.commonPaths.join(", ") : "none. Each document's paths differ somewhere, so the table below shows where."}</p>
    ${only}
    ${matchList ? `<details><summary>Steps worded differently but matched as the same step (${(matches || []).length})</summary><ul>${matchList}</ul></details>` : ""}
    <h3>Where each path differs from the closest path in the other document</h3>
    <table><tr><th>Path</th><th>Closest path</th><th>Shared steps</th><th>Where they differ</th></tr>${pathRows || '<tr><td colspan="4">Every path is common.</td></tr>'}</table>
    <h3>Shared decisions with different outcomes</h3>
    <table><tr><th>Decision</th><th>Outcomes per document</th></tr>${decisionRows || '<tr><td colspan="2">None: shared decisions lead to the same steps.</td></tr>'}</table>
  </div>`;
}

function mergeSectionHtml(merge: NonNullable<AnalysisDetails["merge"]>): string {
  const hasDetails = merge.documents.some((doc) => doc.confidenceScore != null || doc.analysisMode);
  const modeName = (m?: string | null) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : "-");
  const rows = merge.documents
    .map(
      (doc, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(doc.title)}</td><td>${doc.n}</td><td>${doc.e}</td><td>${doc.p}</td><td>${doc.m}</td>${
          hasDetails ? `<td>${escapeHtml(modeName(doc.analysisMode))}</td><td>${doc.confidenceScore != null ? `${doc.confidenceScore}%` : "-"}</td>` : ""
        }</tr>`
    )
    .join("");
  const shared = merge.sharedSteps.length
    ? `Steps found in more than one document (counted once): ${merge.sharedSteps.map(escapeHtml).join(", ")}.`
    : "No step names matched across the documents, so only Start and End are shared.";
  return `
  <h2>Combined from ${merge.documents.length} documents</h2>
  <div class="card">
    <p class="muted">Each document was analysed on its own, then the graphs were joined: Start and End are shared, steps with the same name are counted once, and repeated edges and paths are counted once. ${shared}</p>
    <table><tr><th>#</th><th>Document</th><th>N</th><th>E</th><th>P</th><th>M (own)</th>${hasDetails ? "<th>Way of analysis</th><th>Confidence</th>" : ""}</tr>${rows}</table>
  </div>${merge.comparison ? comparisonHtml(merge.comparison, merge.stepMatches) : ""}`;
}

// Link to the full-page path tree view in the app (absolute, so it works from a downloaded file)
export function pathTreePageUrl(requirementId: string, origin?: string): string | null {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  if (!base || !requirementId) return null;
  return `${base}/path-tree?id=${encodeURIComponent(requirementId)}`;
}

// "How N, E and P are made up" section: node types, edge types, path checks.
export function breakdownSectionHtml(bd: GraphBreakdown, counts: { n: number; e: number; p: number }): string {
  const list = (items: string[]) => (items.length ? items.map(escapeHtml).join(", ") : "none");
  const mismatch: string[] = [];
  if (bd.nodes.total !== counts.n) mismatch.push(`the graph lists ${bd.nodes.total} nodes but N = ${counts.n}`);
  if (bd.edges.total !== counts.e) mismatch.push(`the graph lists ${bd.edges.total} edges but E = ${counts.e}`);
  const notes = [
    ...(mismatch.length ? [`Stored counts differ from the drawn graph: ${mismatch.join("; ")}. Re-run the analysis to align them.`] : []),
    ...bd.notes,
  ];
  return `
  <h2>How N, E and P are made up</h2>
  <div class="card">
    <table>
      <tr><th>Part</th><th>Count</th><th>What it is</th></tr>
      <tr><td><b>Nodes (N)</b></td><td><b>${bd.nodes.total}</b></td><td>${bd.nodes.startEnd} Start/End + ${bd.nodes.actions} action steps + ${bd.nodes.decisions} decision points</td></tr>
      <tr><td>&nbsp;&nbsp;Start / End</td><td>${bd.nodes.startEnd}</td><td>Where the flow begins and finishes</td></tr>
      <tr><td>&nbsp;&nbsp;Action steps</td><td>${bd.nodes.actions}</td><td>Steps with one way out (do something, then continue)</td></tr>
      <tr><td>&nbsp;&nbsp;Decision points</td><td>${bd.nodes.decisions}</td><td>Steps with more than one way out: ${list(bd.nodes.decisionList)}</td></tr>
      <tr><td><b>Edges (E)</b></td><td><b>${bd.edges.total}</b></td><td>${bd.edges.forward} forward transitions + ${bd.edges.loopBack} loop-backs; ${bd.edges.fromDecisions} of them are branches leaving a decision point</td></tr>
      <tr><td>&nbsp;&nbsp;Loop-backs</td><td>${bd.edges.loopBack}</td><td>${bd.edges.loopBackList.length ? bd.edges.loopBackList.map((l) => `${escapeHtml(l.from)} &rarr; ${escapeHtml(l.to)}${l.condition ? ` (${escapeHtml(l.condition)})` : ""}`).join("; ") : "none"}</td></tr>
      <tr><td><b>Paths (P)</b></td><td><b>${counts.p}</b></td><td>Distinct Start-to-End paths that together take every branch at least once${bd.paths.uncoveredBranches ? ` (${bd.paths.uncoveredBranches} branch(es) not yet taken)` : ""}${bd.paths.graphRoutes !== null && bd.paths.graphRoutes > counts.p ? `. For reference, all combinations of outcomes give ${bd.paths.graphRoutes} routes; P covers each outcome, not each combination.` : ""}</td></tr>
    </table>
    ${
      notes.length
        ? `<div style="margin-top:12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:10px"><b>Checks</b><ul style="margin:6px 0 0">${notes.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>`
        : `<p class="muted" style="margin-top:10px">Checks passed: every listed path runs Start to End along the drawn edges, with no repeats.</p>`
    }
  </div>`;
}

function buildReportHtml(d: AnalysisDetails, flowCode: string, flowSvg: string, treeCode: string | null, treeSvg: string | null): string {
  const treeLink = pathTreePageUrl(d.requirement.id);
  const { nodes, edges, paths } = d.metrics;
  const { nodesCount: n, edgesCount: e, paths: p, complexityScore: m } = d.analysis;
  const branches = findBranchNodes(edges);
  const bd = d.metrics.breakdown || buildGraphBreakdown(nodes, edges, paths);

  const edgeRows = edges
    .map((ed, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(ed.from)}</td><td>${escapeHtml(ed.to)}</td><td>${escapeHtml(ed.condition || "-")}</td></tr>`)
    .join("");
  const pathRows = paths
    .map((path, i) => `<tr><td>P${i + 1}</td><td>${path.map(escapeHtml).join(" &rarr; ")}</td><td>${path.length}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(d.requirement.title)} - Flow Diagram</title>
<style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; background: #f8fafc; line-height: 1.5; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }
  h1 { color: #1f3a5f; margin: 0 0 4px; font-size: 26px; }
  h2 { color: #1f3a5f; border-left: 4px solid #1f3a5f; padding-left: 10px; margin-top: 36px; font-size: 19px; }
  .muted { color: #64748b; font-size: 13px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-top: 12px; overflow-x: auto; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 18px; }
  .metric { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .metric b { display: block; font-size: 24px; color: #1f3a5f; }
  .formula { font-family: Consolas, monospace; font-size: 16px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 9px; text-align: left; vertical-align: top; }
  th { background: #1f3a5f; color: #fff; }
  ol li { margin-bottom: 6px; }
  .legend span { display: inline-block; margin-right: 16px; font-size: 13px; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 5px; vertical-align: middle; }
  pre { background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
  svg { max-width: 100%; height: auto; }
  .big-tree { background: #fffbeb; border-color: #fcd34d; }
  .btn { display: inline-block; background: #1f3a5f; color: #fff; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-weight: bold; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(d.requirement.title)}</h1>
  <div class="muted">Control flow diagram &middot; generated ${escapeHtml(new Date().toLocaleString())}</div>

  <div class="metrics">
    <div class="metric">Nodes (N)<b>${n}</b></div>
    <div class="metric">Edges (E)<b>${e}</b></div>
    <div class="metric">Paths (P)<b>${p}</b></div>
    <div class="metric">Complexity (M)<b>${m}</b></div>
    <div class="metric">Test Scenarios (2P)<b>${2 * p}</b></div>
  </div>
  <div class="formula">M = E &minus; N + 2P = ${e} &minus; ${n} + 2(${p}) = <b>${m}</b></div>
${breakdownSectionHtml(bd, { n, e, p })}
${d.merge ? mergeSectionHtml(d.merge) : ""}

  <h2>1. How the flow was generated</h2>
  <div class="card">
    <ol>
      <li><b>Identify the steps (nodes).</b> The requirement was broken into ${nodes.length} states or actions, from <i>Start</i> to <i>End</i>.</li>
      <li><b>Connect the steps (edges).</b> ${edges.length} transitions link one step to the next. A transition with a condition (e.g. "valid" / "invalid") is a branch.</li>
      <li><b>Find the decision points.</b> ${branches.length} step(s) have more than one way out: ${branches.length ? branches.map(escapeHtml).join(", ") : "none"}.</li>
      <li><b>Trace the paths.</b> Every distinct route from Start to End is a path. ${paths.length} path(s) are listed below.</li>
      <li><b>Calculate complexity.</b> M = E &minus; N + 2P, and each path needs a positive and a negative test, so 2P = ${2 * p} test scenarios.</li>
    </ol>
  </div>

  <h2>2. Control flow graph</h2>
  <div class="legend muted">${
    d.merge?.origins
      ? regionLegendHtml(d.merge.documents.map((doc) => doc.title))
      : `
    <span><i class="sw" style="background:#d1fae5;border:1px solid #059669"></i>Start / End</span>
    <span><i class="sw" style="background:#dbeafe;border:1px solid #2563eb"></i>Decision point (branches)</span>
    <span><i class="sw" style="background:#ececff;border:1px solid #9370db"></i>Step</span>`
  }
  </div>
  <div class="card">${flowSvg}</div>

  ${
    treeSvg
      ? `<h2>3. Path tree</h2>
  <p class="muted">Paths are merged where they share the same steps, so each fork shows where the flow splits. Labels P1, P2 &hellip; mark where each path ends.</p>${
    d.merge?.origins ? `<div class="legend muted">${regionLegendHtml(d.merge.documents.map((doc) => doc.title))}</div>` : ""
  }
  <div class="card">${treeSvg}</div>${treeLink ? `<p class="muted"><a href="${escapeHtml(treeLink)}" target="_blank" rel="noopener">Open the path tree on its own page (top-to-bottom view) &#8599;</a></p>` : ""}`
      : `<h2>3. Path tree</h2>
  <div class="card big-tree">
    <p><b>This path tree is too large to show here.</b></p>
    ${
      treeLink
        ? `<p><a class="btn" href="${escapeHtml(treeLink)}" target="_blank" rel="noopener">Open the full path tree (top-to-bottom view) &#8599;</a></p>
    <p class="muted">Opens in DeliveryForge; sign in if asked. The path table below lists every path as well.</p>`
        : `<p class="muted">See the path table below.</p>`
    }
  </div>`
  }

  <h2>4. Paths (Start to End)</h2>
  <div class="card"><table><tr><th>Path</th><th>Route</th><th>Steps</th></tr>${pathRows || '<tr><td colspan="3">No paths stored for this analysis.</td></tr>'}</table></div>

  <h2>5. Transitions (edges)</h2>
  <div class="card"><table><tr><th>#</th><th>From</th><th>To</th><th>Condition</th></tr>${edgeRows || '<tr><td colspan="4">No edges stored for this analysis.</td></tr>'}</table></div>

  ${
    d.reasoning?.detailed || d.reasoning?.analysis
      ? `<h2>6. Analysis reasoning</h2><div class="card">${escapeHtml(cleanFormulaText(d.reasoning.detailed || d.reasoning.analysis || ""))}${
          d.reasoning.confidenceScore
            ? `<p class="muted">Confidence: ${d.reasoning.confidenceScore}%</p>${
                d.reasoning.confidenceReason ? `<pre style="white-space:pre-wrap">${escapeHtml(d.reasoning.confidenceReason)}</pre>` : ""
              }`
            : ""
        }</div>`
      : ""
  }

  <h2>Mermaid source</h2>
  <p class="muted">Paste this into <b>mermaid.live</b>, Confluence, GitHub or Azure DevOps to edit or embed the diagram.</p>
  <pre>${escapeHtml(flowCode)}</pre>
  ${treeCode ? `<pre>${escapeHtml(treeCode)}</pre>` : ""}
</div>
</body>
</html>`;
}

// Builds the self-contained HTML flow diagram report (diagrams rendered to inline SVG).
export async function buildFlowDiagramHtml(details: AnalysisDetails): Promise<string> {
  const nodes = details.metrics.nodes || [];
  const edges = details.metrics.edges || [];
  if (!nodes.length || !edges.length) {
    throw new Error("This analysis has no stored graph (nodes and edges). Please re-run the analysis.");
  }

  const flowCode = buildFlowMermaid(nodes, edges, details.merge?.origins);
  const treeCode = buildPathTreeMermaid(details.metrics.paths || [], { regions: details.merge?.origins?.paths });
  const stamp = Date.now();
  const flowSvg = await renderSvg(flowCode, `flow-${stamp}`);
  let treeSvg: string | null = null;
  if (treeCode) {
    try {
      treeSvg = await renderSvg(treeCode, `tree-${stamp}`);
    } catch (err) {
      console.warn("Path tree render failed:", err);
    }
  }

  return buildReportHtml(details, flowCode, flowSvg, treeCode, treeSvg);
}

// Downloads an HTML flow diagram report for an analysis.
export async function downloadFlowDiagram(details: AnalysisDetails): Promise<void> {
  const html = await buildFlowDiagramHtml(details);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${details.requirement.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-") || "analysis"}-flow-diagram.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
