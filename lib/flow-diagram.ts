// Builds Mermaid diagrams from a stored analysis (nodes, edges, paths) and
// downloads a self-contained HTML report that explains how the flow and the
// complexity score were derived. Nothing here changes N, E, P or M.

import { buildGraphBreakdown, cleanFormulaText, type GraphBreakdown } from "./graph-breakdown";

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
    documents: Array<{ title: string; n: number; e: number; p: number; m: number }>;
    sharedSteps: string[];
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

const isStart = (name: string) => /^start$/i.test(name.trim());
const isEnd = (name: string) => /^end$/i.test(name.trim());

// Nodes with more than one outgoing edge are where the flow branches.
export function findBranchNodes(edges: FlowEdge[]): string[] {
  const outCount = new Map<string, number>();
  edges.forEach((e) => outCount.set(e.from, (outCount.get(e.from) || 0) + 1));
  return [...outCount.entries()].filter(([, c]) => c > 1).map(([n]) => n);
}

// Control-flow graph: every node and edge from the analysis, drawn top to bottom.
export function buildFlowMermaid(nodes: string[], inputEdges: FlowEdge[]): string {
  // Older saved analyses can list the same edge twice; draw each arrow once
  const seenEdges = new Set<string>();
  const edges = inputEdges.filter((e) => {
    const key = `${e.from}|${e.to}`;
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
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
    else if (branches.has(n)) lines.push(`  ${id}{"${label}"}`);
    else lines.push(`  ${id}["${label}"]`);
  });
  edges.forEach((e) => {
    const cond = e.condition && e.condition.toLowerCase() !== "default" ? mermaidText(e.condition) : "";
    lines.push(`  ${ids.get(e.from)} -->${cond ? `|"${cond}"|` : ""} ${ids.get(e.to)}`);
  });

  lines.push("  classDef startEnd fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b");
  lines.push("  classDef branch fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a8a");
  const startEnd = allNodes.filter((n) => isStart(n) || isEnd(n)).map((n) => ids.get(n));
  const branchIds = allNodes.filter((n) => branches.has(n) && !isStart(n) && !isEnd(n)).map((n) => ids.get(n));
  if (startEnd.length) lines.push(`  class ${startEnd.join(",")} startEnd`);
  if (branchIds.length) lines.push(`  class ${branchIds.join(",")} branch`);

  return lines.join("\n");
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

// Mermaid source for the path tree. The report draws it left to right and stops
// at MAX_TREE_NODES; the full-page view draws it top to bottom with no limit.
export function buildPathTreeMermaid(
  paths: string[][],
  options: { direction?: "LR" | "TD"; maxNodes?: number } = {}
): string | null {
  const tree = buildPathTree(paths);
  if (!tree) return null;
  if (tree.size > (options.maxNodes ?? MAX_TREE_NODES)) return null;
  const { root } = tree;

  const lines = [`flowchart ${options.direction || "LR"}`];
  const walk = (node: PathTreeNode) => {
    const suffix = node.pathNos.length ? ` ✓ ${node.pathNos.map((n) => `P${n}`).join(", ")}` : "";
    const label = mermaidText(node.label) + suffix;
    lines.push(node.children.size > 1 ? `  ${node.id}{"${label}"}` : `  ${node.id}["${label}"]`);
    node.children.forEach((child) => {
      lines.push(`  ${node.id} --> ${child.id}`);
      walk(child);
    });
  };
  walk(root);
  return lines.join("\n");
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

function mergeSectionHtml(merge: NonNullable<AnalysisDetails["merge"]>): string {
  const rows = merge.documents
    .map((doc, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(doc.title)}</td><td>${doc.n}</td><td>${doc.e}</td><td>${doc.p}</td><td>${doc.m}</td></tr>`)
    .join("");
  const shared = merge.sharedSteps.length
    ? `Steps found in more than one document (counted once): ${merge.sharedSteps.map(escapeHtml).join(", ")}.`
    : "No step names matched across the documents, so only Start and End are shared.";
  return `
  <h2>Combined from ${merge.documents.length} documents</h2>
  <div class="card">
    <p class="muted">Each document was analysed on its own, then the graphs were joined: Start and End are shared, steps with the same name are counted once, and repeated edges and paths are counted once. ${shared}</p>
    <table><tr><th>#</th><th>Document</th><th>N</th><th>E</th><th>P</th><th>M (own)</th></tr>${rows}</table>
  </div>`;
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
  <div class="legend muted">
    <span><i class="sw" style="background:#d1fae5;border:1px solid #059669"></i>Start / End</span>
    <span><i class="sw" style="background:#dbeafe;border:1px solid #2563eb"></i>Decision point (branches)</span>
    <span><i class="sw" style="background:#ececff;border:1px solid #9370db"></i>Step</span>
  </div>
  <div class="card">${flowSvg}</div>

  ${
    treeSvg
      ? `<h2>3. Path tree</h2>
  <p class="muted">Paths are merged where they share the same steps, so each fork shows where the flow splits. Labels P1, P2 &hellip; mark where each path ends.</p>
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
          d.reasoning.confidenceScore ? `<p class="muted">Confidence: ${d.reasoning.confidenceScore}%</p>` : ""
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

  const flowCode = buildFlowMermaid(nodes, edges);
  const treeCode = buildPathTreeMermaid(details.metrics.paths || []);
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
