"use client";

import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { readRequirementFile, REQUIREMENT_FILE_ACCEPT, REQUIREMENT_FILE_LABEL } from "@/lib/read-requirement-file";
import { buildFlowMermaid, buildPathTreeMermaid, downloadFlowDiagram, renderSvg } from "@/lib/flow-diagram";
import InfoTip from "@/components/InfoTip";
import { OverLimitWarning, UploadLimitsNote } from "@/components/UploadLimitsNote";

// Analyse 2-3 requirement documents and combine them into one complexity
// score, one analysis file and one Mermaid graph. Each document is analysed
// on its own first (and saved like a normal analysis), so every call stays
// inside the 60-second limit; then the graphs are joined on the server.

interface DocSlot {
  title: string;
  text: string;
  fileName: string;
  status: "idle" | "reading" | "analyzing" | "done" | "error";
  message: string;
  score?: number;
}

interface CombinedResult {
  requirementId: string;
  title: string;
  analysis: {
    nodesCount: number;
    edgesCount: number;
    paths: number;
    complexityScore: number;
    testScenarios: number;
    calculation: string;
    nodes: string[];
    edges: Array<{ from: string; to: string; condition?: string }>;
    pathsList: string[][];
    sharedSteps: string[];
    documents: Array<{ title: string; n: number; e: number; p: number; m: number }>;
  };
}

const MIN_TEXT = 50;
const emptySlot = (): DocSlot => ({ title: "", text: "", fileName: "", status: "idle", message: "" });

const levelOf = (m: number) => (m <= 5 ? "Low" : m <= 15 ? "Medium" : m <= 30 ? "High" : "Very High");

interface Props {
  onOpenHistory?: () => void;
}

export default function CombineRequirements({ onOpenHistory }: Props) {
  const [slots, setSlots] = useState<DocSlot[]>([emptySlot(), emptySlot()]);
  const [combinedTitle, setCombinedTitle] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CombinedResult | null>(null);
  const [diagramSvg, setDiagramSvg] = useState("");
  const [diagramError, setDiagramError] = useState("");
  const [downloading, setDownloading] = useState<"" | "json" | "diagram">("");
  const renderCount = useRef(0);

  const updateSlot = (index: number, patch: Partial<DocSlot>) =>
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));

  const handleFile = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    updateSlot(index, { status: "reading", message: "Reading file..." });
    try {
      const text = await readRequirementFile(file);
      setSlots((prev) =>
        prev.map((slot, i) =>
          i === index
            ? {
                ...slot,
                text,
                fileName: file.name,
                title: slot.title || file.name.replace(/\.[^.]+$/, ""),
                status: "idle",
                message: "",
              }
            : slot
        )
      );
    } catch (err) {
      updateSlot(index, { status: "error", message: err instanceof Error ? err.message : "Could not read the file" });
    }
  };

  const canRun = !running && slots.every((slot) => slot.text.trim().length >= MIN_TEXT);

  const analyzeOne = async (slot: DocSlot, index: number): Promise<string> => {
    updateSlot(index, { status: "analyzing", message: "Analysing..." });
    const response = await authFetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirementText: slot.text,
        title: slot.title.trim() || `Document ${index + 1}`,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.requirementId) {
      throw new Error(data.error || "Analysis failed");
    }
    updateSlot(index, {
      status: "done",
      message: data.isIncompleteAnalysis ? "Analysed (few details found)" : "Analysed and saved",
      score: data.analysis?.complexityScore,
    });
    return String(data.requirementId);
  };

  const handleRun = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    setDiagramSvg("");
    setDiagramError("");

    // Analyse every document at the same time; each one is its own request
    const outcomes = await Promise.allSettled(slots.map((slot, i) => analyzeOne(slot, i)));
    outcomes.forEach((outcome, i) => {
      if (outcome.status === "rejected") {
        updateSlot(i, { status: "error", message: outcome.reason?.message || "Analysis failed" });
      }
    });

    if (outcomes.some((o) => o.status === "rejected")) {
      setError("Not every document could be analysed, so they were not combined. The ones that worked are saved in Analysis History. Fix the failed one and try again.");
      setRunning(false);
      return;
    }

    try {
      const requirementIds = outcomes.map((o) => (o as PromiseFulfilledResult<string>).value);
      const response = await authFetch("/api/merge-analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementIds, title: combinedTitle.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "Could not combine the analyses");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not combine the analyses");
    } finally {
      setRunning(false);
    }
  };

  // Draw the combined control-flow graph once a result is in
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    renderCount.current += 1;
    const code = buildFlowMermaid(result.analysis.nodes, result.analysis.edges);
    renderSvg(code, `combined-flow-${Date.now()}-${renderCount.current}`)
      .then((svg) => !cancelled && setDiagramSvg(svg))
      .catch((err) => !cancelled && setDiagramError(err instanceof Error ? err.message : "Could not draw the graph"));
    return () => {
      cancelled = true;
    };
  }, [result]);

  const fetchDetails = async (requirementId: string) => {
    const response = await authFetch(`/api/get-analysis-details?requirementId=${requirementId}`);
    if (!response.ok) throw new Error("Failed to fetch analysis details");
    const { data } = await response.json();
    return data;
  };

  // Same JSON file as "Download Analysis" in Analysis History
  const downloadAnalysis = async () => {
    if (!result) return;
    setDownloading("json");
    try {
      const details = await fetchDetails(result.requirementId);
      details.flowDiagram = {
        mermaid: buildFlowMermaid(details.metrics?.nodes || [], details.metrics?.edges || []),
        pathTreeMermaid: buildPathTreeMermaid(details.metrics?.paths || []),
        howToView: "Paste the mermaid text into https://mermaid.live to view the diagram",
      };
      const blob = new Blob([JSON.stringify(details, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.title}-analysis-complete-${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to download analysis details");
    } finally {
      setDownloading("");
    }
  };

  const downloadDiagram = async () => {
    if (!result) return;
    setDownloading("diagram");
    try {
      await downloadFlowDiagram(await fetchDetails(result.requirementId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to build the flow diagram");
    } finally {
      setDownloading("");
    }
  };

  const reset = () => {
    setSlots([emptySlot(), emptySlot()]);
    setCombinedTitle("");
    setResult(null);
    setError("");
    setDiagramSvg("");
    setDiagramError("");
  };

  const statusText = (slot: DocSlot) => {
    if (slot.status === "idle") return null;
    const color =
      slot.status === "error" ? "text-red-700" : slot.status === "done" ? "text-green-700" : "text-blue-700";
    const icon = slot.status === "error" ? "❌" : slot.status === "done" ? "✓" : "⏳";
    return (
      <p className={`text-xs mt-1 ${color}`}>
        {icon} {slot.message}
        {slot.status === "done" && typeof slot.score === "number" ? ` — own score M = ${slot.score}` : ""}
      </p>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          Combine 2–3 requirement documents
          <InfoTip
            note={{
              title: "How the combined score is calculated",
              lines: [
                "1. Each document is analysed on its own and saved in Analysis History.",
                "2. Their control-flow graphs are joined: Start and End are shared, and a step with the same name in two documents counts once.",
                "3. Repeated edges and paths count once.",
                "4. Same formula as a single analysis: M = E − N + 2P, where P = distinct Start-to-End paths across all documents.",
              ],
            }}
          />
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Upload or paste each document. You get one combined complexity score, analysis file and Mermaid graph.
        </p>

        <div className="mt-4">
          <UploadLimitsNote />
        </div>

        <div className="mt-5 space-y-4">
          {slots.map((slot, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-slate-800">Document {i + 1}</span>
                {slots.length > 2 && !running && (
                  <button
                    type="button"
                    onClick={() => setSlots((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                type="text"
                value={slot.title}
                onChange={(e) => updateSlot(i, { title: e.target.value })}
                placeholder={`Title (e.g. Module ${i + 1})`}
                disabled={running}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={slot.text}
                onChange={(e) => updateSlot(i, { text: e.target.value, status: "idle", message: "" })}
                placeholder="Paste the requirement text, or upload a file below"
                rows={5}
                disabled={running}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                <label className="text-xs text-blue-700 font-medium cursor-pointer hover:text-blue-900">
                  📎 Upload file ({REQUIREMENT_FILE_LABEL})
                  <input
                    type="file"
                    accept={REQUIREMENT_FILE_ACCEPT}
                    onChange={(e) => handleFile(i, e)}
                    disabled={running}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500">
                  {slot.fileName ? `${slot.fileName} · ` : ""}
                  {slot.text.trim().length} characters
                  {slot.text.trim().length > 0 && slot.text.trim().length < MIN_TEXT ? ` (min ${MIN_TEXT})` : ""}
                </span>
              </div>
              <OverLimitWarning length={slot.text.trim().length} />
              {statusText(slot)}
            </div>
          ))}
        </div>

        {slots.length < 3 && !running && (
          <button
            type="button"
            onClick={() => setSlots((prev) => [...prev, emptySlot()])}
            className="mt-3 text-sm text-blue-700 font-medium hover:text-blue-900"
          >
            + Add a third document
          </button>
        )}

        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">Name for the combined analysis (optional)</label>
          <input
            type="text"
            value={combinedTitle}
            onChange={(e) => setCombinedTitle(e.target.value)}
            placeholder="Combined: Document 1 + Document 2"
            disabled={running}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        <div className="mt-5 flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-semibold"
          >
            {running ? "Analysing documents..." : `Analyse & combine ${slots.length} documents`}
          </button>
          {(result || error) && !running && (
            <button type="button" onClick={reset} className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
              Start over
            </button>
          )}
        </div>
        {running && (
          <p className="text-xs text-slate-500 mt-2">Each document can take up to a minute. They run at the same time.</p>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{result.title}</h3>
            <p className="text-xs text-slate-500">Saved in Analysis History, so User Stories, Estimation and Timeline can use it.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ["Complexity (M)", `${result.analysis.complexityScore}`, levelOf(result.analysis.complexityScore)],
              ["Nodes (N)", `${result.analysis.nodesCount}`, ""],
              ["Edges (E)", `${result.analysis.edgesCount}`, ""],
              ["Paths (P)", `${result.analysis.paths}`, ""],
              ["Test scenarios (2P)", `${result.analysis.testScenarios}`, ""],
            ].map(([label, value, sub]) => (
              <div key={label} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-600">{label}</p>
                <p className="text-2xl font-bold text-blue-700">{value}</p>
                {sub && <p className="text-xs text-slate-600">{sub}</p>}
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm font-mono text-blue-900">{result.analysis.calculation}</div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-2 text-left">Document</th>
                  <th className="p-2">N</th>
                  <th className="p-2">E</th>
                  <th className="p-2">P</th>
                  <th className="p-2">M (own)</th>
                </tr>
              </thead>
              <tbody>
                {result.analysis.documents.map((doc, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2">{doc.title}</td>
                    <td className="p-2 text-center">{doc.n}</td>
                    <td className="p-2 text-center">{doc.e}</td>
                    <td className="p-2 text-center">{doc.p}</td>
                    <td className="p-2 text-center">{doc.m}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-blue-50">
                  <td className="p-2">Combined</td>
                  <td className="p-2 text-center">{result.analysis.nodesCount}</td>
                  <td className="p-2 text-center">{result.analysis.edgesCount}</td>
                  <td className="p-2 text-center">{result.analysis.paths}</td>
                  <td className="p-2 text-center">{result.analysis.complexityScore}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-sm text-slate-700">
            {result.analysis.sharedSteps.length
              ? `Shared steps (counted once): ${result.analysis.sharedSteps.join(", ")}.`
              : "No step names matched across the documents, so only Start and End are shared."}
          </p>

          <div>
            <h4 className="font-semibold text-slate-900 mb-2">Combined control-flow graph</h4>
            <div className="border border-slate-200 rounded-lg p-3 overflow-auto max-h-[600px] bg-white">
              {diagramSvg ? (
                <div dangerouslySetInnerHTML={{ __html: diagramSvg }} />
              ) : diagramError ? (
                <p className="text-sm text-red-700">{diagramError}</p>
              ) : (
                <p className="text-sm text-slate-500">Drawing the graph...</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={downloadAnalysis}
              disabled={downloading !== ""}
              className="px-4 py-2 text-sm bg-purple-50 text-purple-700 rounded border border-purple-200 hover:bg-purple-100 font-medium disabled:opacity-60"
            >
              {downloading === "json" ? "⏳ Preparing..." : "📊 Download Analysis"}
            </button>
            <button
              type="button"
              onClick={downloadDiagram}
              disabled={downloading !== ""}
              className="px-4 py-2 text-sm bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100 font-medium disabled:opacity-60"
            >
              {downloading === "diagram" ? "⏳ Building..." : "🌳 Flow Diagram (Mermaid)"}
            </button>
            <a
              href={`/path-tree?id=${encodeURIComponent(result.requirementId)}`}
              target="_blank"
              rel="noopener"
              className="px-4 py-2 text-sm bg-white text-teal-700 rounded border border-teal-200 hover:bg-teal-50 font-medium"
            >
              🌲 Path tree (full page) ↗
            </a>
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                Open in Analysis History →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
