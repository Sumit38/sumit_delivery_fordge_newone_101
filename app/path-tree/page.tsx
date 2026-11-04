"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { authFetch } from "@/lib/auth-fetch";
import {
  buildFlowMermaid,
  buildPathTree,
  buildPathTreeMermaid,
  renderSvg,
  type AnalysisDetails,
  type PathTreeNode,
} from "@/lib/flow-diagram";

// Full-page, top-to-bottom view of an analysis's path tree and flow graph.
// Used when the tree is too large to show inside the downloaded report.
// Opened as /path-tree?id=<requirement id>.

type View = "tree" | "flow" | "outline";

// Above this many steps the drawing gets too slow for a browser; the outline is shown instead
const MAX_DRAWN_TREE_NODES = 3000;

function Outline({ node, depth = 0 }: { node: PathTreeNode; depth?: number }) {
  const children = [...node.children.values()];
  const ends = node.pathNos.length ? ` ✓ ${node.pathNos.map((n) => `P${n}`).join(", ")}` : "";
  const label = (
    <span className={children.length > 1 ? "font-semibold text-blue-800" : "text-slate-800"}>
      {node.label}
      {ends && <span className="ml-1 text-green-700 font-medium">{ends}</span>}
      {children.length > 1 && <span className="ml-1 text-xs text-slate-500">({children.length} branches)</span>}
    </span>
  );
  if (!children.length) return <li className="py-0.5">{label}</li>;
  return (
    <li className="py-0.5">
      <details open={depth < 6}>
        <summary className="cursor-pointer">{label}</summary>
        <ul className="ml-5 border-l border-slate-200 pl-3">
          {children.map((child) => (
            <Outline key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      </details>
    </li>
  );
}

export default function PathTreePage() {
  const router = useRouter();
  const [details, setDetails] = useState<AnalysisDetails | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("tree");
  const [svg, setSvg] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState("");
  const [fitWidth, setFitWidth] = useState(false);

  // Load the analysis (signed-in users only, and only their own analyses)
  useEffect(() => {
    const load = async () => {
      const id = new URLSearchParams(window.location.search).get("id");
      if (!id) {
        setError("No analysis was selected.");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      try {
        const response = await authFetch(`/api/get-analysis-details?requirementId=${encodeURIComponent(id)}`);
        if (!response.ok) throw new Error(response.status === 404 ? "Analysis not found." : "Could not load the analysis.");
        const { data } = await response.json();
        setDetails(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the analysis.");
      }
    };
    load();
  }, [router]);

  const paths = details?.metrics.paths || [];
  const tree = details ? buildPathTree(paths) : null;
  const treeTooBig = !!tree && tree.size > MAX_DRAWN_TREE_NODES;

  // Draw the selected view
  useEffect(() => {
    if (!details || view === "outline") return;
    let cancelled = false;
    const code =
      view === "tree"
        ? buildPathTreeMermaid(details.metrics.paths || [], { direction: "TD", maxNodes: MAX_DRAWN_TREE_NODES })
        : buildFlowMermaid(details.metrics.nodes || [], details.metrics.edges || []);
    setSvg("");
    setDrawError("");
    if (!code) {
      setDrawError(view === "tree" ? "This analysis has no stored paths." : "This analysis has no stored graph.");
      return;
    }
    setDrawing(true);
    renderSvg(code, `${view}-${Date.now()}`)
      .then((out) => !cancelled && setSvg(out))
      .catch((err) => !cancelled && setDrawError(err instanceof Error ? err.message : "Could not draw the diagram"))
      .finally(() => !cancelled && setDrawing(false));
    return () => {
      cancelled = true;
    };
  }, [details, view]);

  // Very large trees: open on the outline, which always works
  useEffect(() => {
    if (treeTooBig) setView("outline");
  }, [treeTooBig]);

  const downloadSvg = () => {
    if (!svg || !details) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${details.requirement.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-") || "analysis"}-${view === "tree" ? "path-tree" : "flow-graph"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-red-700">{error}</p>
        <Link href="/dashboard" className="text-blue-700 underline">Back to dashboard</Link>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading analysis...</p>
      </div>
    );
  }

  const { analysis } = details;
  const tabs: Array<[View, string]> = [
    ["tree", "Path tree"],
    ["flow", "Flow graph"],
    ["outline", "Outline (text)"],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{details.requirement.title}</h1>
            <p className="text-sm text-slate-600">
              N = {analysis.nodesCount} · E = {analysis.edgesCount} · P = {analysis.paths} · M = {analysis.complexityScore}
              {tree ? ` · ${tree.size} steps in the path tree` : ""}
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-blue-700 hover:text-blue-900 font-medium">← Back to dashboard</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`px-4 py-1.5 text-sm rounded-md font-medium ${view === key ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {view !== "outline" && svg && (
            <>
              <button
                type="button"
                onClick={() => setFitWidth(!fitWidth)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white hover:bg-slate-100"
              >
                {fitWidth ? "Actual size" : "Fit to width"}
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white hover:bg-slate-100"
              >
                Download SVG
              </button>
            </>
          )}
        </div>

        {view === "tree" && treeTooBig ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
            This path tree has {tree!.size} steps, too many to draw in a browser. Use the Outline view, which lists the same tree top to bottom.
          </div>
        ) : view === "outline" ? (
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm overflow-x-auto">
            {tree ? (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Each step lists the steps that follow it. <span className="text-blue-800 font-semibold">Blue</span> steps are where the flow branches; ✓ P1, P2 … mark where each path ends. Click a step to collapse or expand it.
                </p>
                <ul>
                  <Outline node={tree.root} />
                </ul>
              </>
            ) : (
              <p className="text-slate-500">This analysis has no stored paths.</p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-4 overflow-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
            {drawing && <p className="text-sm text-slate-500">Drawing...</p>}
            {drawError && <p className="text-sm text-red-700">{drawError}</p>}
            {svg && (
              <div
                className={fitWidth ? "[&_svg]:!max-w-full [&_svg]:h-auto" : "[&_svg]:!max-w-none"}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
