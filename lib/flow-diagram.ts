// Builds Mermaid diagrams from a stored analysis (nodes, edges, paths) and
// downloads a self-contained HTML report that explains how the flow and the
// complexity score were derived. Nothing here changes N, E, P or M.

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
  };
  reasoning?: {
    analysis?: string;
    detailed?: string;
    confidenceScore?: number;
    confidenceReason?: string;
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

// Path tree: the Start-to-End paths merged on their shared prefixes, so each
// fork shows where one path splits into several. Leaves are labelled P1..Pn.
export function buildPathTreeMermaid(paths: string[][]): string | null {
  if (!paths.length) return null;

  interface TrieNode { id: string; label: string; children: Map<string, TrieNode>; pathNos: number[] }
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

  if (counter + 1 > MAX_TREE_NODES) return null;

  const lines = ["flowchart LR"];
  const walk = (node: TrieNode) => {
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

async function renderSvg(code: string, id: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
  const { svg } = await mermaid.render(id, code);
  return svg;
}

function buildReportHtml(d: AnalysisDetails, flowCode: string, flowSvg: string, treeCode: string | null, treeSvg: string | null): string {
  const { nodes, edges, paths } = d.metrics;
  const { nodesCount: n, edgesCount: e, paths: p, complexityScore: m } = d.analysis;
  const branches = findBranchNodes(edges);

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
  <div class="card">${treeSvg}</div>`
      : `<h2>3. Path tree</h2><p class="muted">The path tree is too large to draw clearly; see the path table below.</p>`
  }

  <h2>4. Paths (Start to End)</h2>
  <div class="card"><table><tr><th>Path</th><th>Route</th><th>Steps</th></tr>${pathRows || '<tr><td colspan="3">No paths stored for this analysis.</td></tr>'}</table></div>

  <h2>5. Transitions (edges)</h2>
  <div class="card"><table><tr><th>#</th><th>From</th><th>To</th><th>Condition</th></tr>${edgeRows || '<tr><td colspan="4">No edges stored for this analysis.</td></tr>'}</table></div>

  ${
    d.reasoning?.detailed || d.reasoning?.analysis
      ? `<h2>6. Analysis reasoning</h2><div class="card">${escapeHtml(d.reasoning.detailed || d.reasoning.analysis || "")}${
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
