"use client";

import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { readRequirementFile, REQUIREMENT_FILE_ACCEPT, REQUIREMENT_FILE_LABEL } from "@/lib/read-requirement-file";
import {
  buildFlowMermaid,
  buildPathTreeMermaid,
  downloadFlowDiagram,
  filterToDocument,
  renderSvg,
  REGION_COLORS,
  SHARED_COLOR,
} from "@/lib/flow-diagram";
import type { MergeOrigins } from "@/lib/merge-analyses";
import type { DocumentComparison } from "@/lib/merge-compare";
import InfoTip from "@/components/InfoTip";
import { OverLimitWarning, UploadLimitsNote } from "@/components/UploadLimitsNote";
import CombineQuestionsModal from "@/components/CombineQuestionsModal";
import { answerStatusFor, guidedTextFor, type CombineQuestion } from "@/lib/combine-questions";

// Analyse 2-3 requirement documents and combine them into one complexity
// score, one analysis file and one Mermaid graph. Each document is analysed
// on its own first (and saved like a normal analysis), so every call stays
// inside the server time limit; then the graphs are joined on the server.
// Guided path: 10 shared questions are answered first and sent with every document.

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
    documents: Array<{ title: string; n: number; e: number; p: number; m: number; confidenceScore?: number | null; analysisMode?: string | null }>;
    confidenceScore?: number;
    confidenceReason?: string;
    analysisMode?: string | null;
    requirementGaps?: string[];
    ambiguities?: string[];
    origins?: MergeOrigins;
    comparison?: DocumentComparison;
    stepMatches?: Array<{ doc: number; step: string; matchedDoc: number; matchedStep: string }>;
  };
}

const MIN_TEXT = 50;
const emptySlot = (): DocSlot => ({ title: "", text: "", fileName: "", status: "idle", message: "" });

const modeName = (m?: string | null) => (m ? m.charAt(0).toUpperCase() + m.slice(1) : "-");

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
  // Region view of the combined graph: -1 = all documents, otherwise one document
  const [view, setView] = useState(-1);
  const renderCount = useRef(0);
  // Direct = analyse the documents as they are; guided = answer shared questions first
  const [pathMode, setPathMode] = useState<"direct" | "guided">("direct");
  const [questions, setQuestions] = useState<CombineQuestion[] | null>(null);
  // The documents the questions were written for; new questions are needed when they change
  const [questionsKey, setQuestionsKey] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const docsKey = JSON.stringify(slots.map((s) => [s.title.trim(), s.text.trim()]));

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

  const canRun = !running && !preparing && slots.every((slot) => slot.text.trim().length >= MIN_TEXT);

  const analyzeOne = async (slot: DocSlot, index: number, guided: CombineQuestion[] | null): Promise<string> => {
    updateSlot(index, { status: "analyzing", message: "Analysing..." });
    const title = slot.title.trim() || `Document ${index + 1}`;
    // Guided path: the shared answers go with the document, same as a single guided analysis
    const metadata = guided ? answerStatusFor(index, guided) : [];
    const response = await authFetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirementText: guided ? guidedTextFor(index, title, slot.text, guided) : slot.text,
        title,
        ...(metadata.length ? { questionsMetadata: metadata } : {}),
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

  // Guided path: write (or reuse) the shared questions, then let the user answer them
  const prepareQuestions = async () => {
    setError("");
    if (questions && questionsKey === docsKey) {
      setShowQuestions(true);
      return;
    }
    setPreparing(true);
    try {
      const response = await authFetch("/api/combine-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: slots.map((s, i) => ({ title: s.title.trim() || `Document ${i + 1}`, text: s.text })),
        }),
      });
      const raw = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      if (!response.ok || !Array.isArray(data?.questions) || !data.questions.length) {
        if (response.status === 504) throw new Error("Preparing the questions took longer than the server allows. Please try again.");
        throw new Error(data?.error || "Could not prepare the guided questions. Please try again, or use the direct path.");
      }
      setQuestions(data.questions);
      setQuestionsKey(docsKey);
      setShowQuestions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the guided questions.");
    } finally {
      setPreparing(false);
    }
  };

  const handleRun = () => {
    if (pathMode === "guided") prepareQuestions();
    else runAnalysis(null);
  };

  const runAnalysis = async (guided: CombineQuestion[] | null) => {
    setShowQuestions(false);
    setRunning(true);
    setError("");
    setResult(null);
    setDiagramSvg("");
    setDiagramError("");
    setView(-1);

    // Analyse every document at the same time; each one is its own request
    const outcomes = await Promise.allSettled(slots.map((slot, i) => analyzeOne(slot, i, guided)));
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
    setDiagramSvg("");
    setDiagramError("");
    const { nodes, edges, origins } = result.analysis;
    const shown = origins && view >= 0 ? filterToDocument(nodes, edges, origins, view) : { nodes, edges, origins };
    const code = buildFlowMermaid(shown.nodes, shown.edges, shown.origins);
    renderSvg(code, `combined-flow-${Date.now()}-${renderCount.current}`)
      .then((svg) => !cancelled && setDiagramSvg(svg))
      .catch((err) => !cancelled && setDiagramError(err instanceof Error ? err.message : "Could not draw the graph"));
    return () => {
      cancelled = true;
    };
  }, [result, view]);

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
        mermaid: buildFlowMermaid(details.metrics?.nodes || [], details.metrics?.edges || [], details.merge?.origins),
        pathTreeMermaid: buildPathTreeMermaid(details.metrics?.paths || [], { regions: details.merge?.origins?.paths, maxNodes: 3000 }),
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
    setView(-1);
    setQuestions(null);
    setQuestionsKey("");
    setShowQuestions(false);
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

        <fieldset className="mt-5" disabled={running || preparing}>
          <legend className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            Would you like to analyse the requirements on the Direct path or the Guided path?
            <InfoTip
              note={{
                title: "Direct path vs Guided path",
                lines: [
                  "Direct path: each document is analysed as it is. No questions are asked.",
                  "Guided path: the AI reads all the documents together and asks 10 clarifying questions (unclear decisions, loops, steps that differ between the documents).",
                  "Each answer is used for every document it applies to, so the documents are analysed with the same assumptions and their scores stay comparable.",
                  "Answer all 10 for a Guided analysis; if some are left blank their suggested answer is used and the analysis counts as Hybrid.",
                ],
              }}
            />
          </legend>
          <div className="flex gap-3 flex-wrap">
            {(
              [
                ["direct", "Direct path", "No questions; analyse the documents as they are"],
                ["guided", "Guided path", "Answer 10 questions first for a more accurate, consistent analysis"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex-1 min-w-[220px] cursor-pointer rounded-lg border p-3 ${pathMode === value ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="combine-path"
                    value={value}
                    checked={pathMode === value}
                    onChange={() => setPathMode(value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-slate-900">{label}</span>
                </span>
                <span className="block text-xs text-slate-600 mt-1 ml-6">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        <div className="mt-5 flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-semibold"
          >
            {running
              ? "Analysing documents..."
              : preparing
                ? "Preparing 10 questions..."
                : pathMode === "guided"
                  ? `Answer 10 questions, then analyse ${slots.length} documents`
                  : `Analyse & combine ${slots.length} documents`}
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
        {preparing && (
          <p className="text-xs text-slate-500 mt-2">Reading all the documents together to write the questions. This usually takes 10–30 seconds.</p>
        )}
      </div>

      {showQuestions && questions && (
        <CombineQuestionsModal
          questions={questions}
          docTitles={slots.map((s) => s.title)}
          onChange={setQuestions}
          onCancel={() => setShowQuestions(false)}
          onConfirm={() => runAnalysis(questions)}
        />
      )}

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
                  <th className="p-2">Way of analysis</th>
                  <th className="p-2">Confidence</th>
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
                    <td className="p-2 text-center">{modeName(doc.analysisMode)}</td>
                    <td className="p-2 text-center">{doc.confidenceScore != null ? `${doc.confidenceScore}%` : "-"}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-blue-50">
                  <td className="p-2">Combined</td>
                  <td className="p-2 text-center">{result.analysis.nodesCount}</td>
                  <td className="p-2 text-center">{result.analysis.edgesCount}</td>
                  <td className="p-2 text-center">{result.analysis.paths}</td>
                  <td className="p-2 text-center">{result.analysis.complexityScore}</td>
                  <td className="p-2 text-center">{modeName(result.analysis.analysisMode)}</td>
                  <td className="p-2 text-center">
                    {result.analysis.confidenceScore != null ? `${result.analysis.confidenceScore}%` : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {result.analysis.confidenceReason && (
            <details className="text-sm">
              <summary className="cursor-pointer text-blue-700">
                Why the confidence is {result.analysis.confidenceScore}%
              </summary>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-slate-700">{result.analysis.confidenceReason}</pre>
            </details>
          )}

          {(result.analysis.ambiguities?.length || 0) + (result.analysis.requirementGaps?.length || 0) > 0 && (
            <details className="text-sm p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <summary className="cursor-pointer font-medium text-amber-900">
                Checks: {result.analysis.ambiguities?.length || 0} answer conflict(s), {result.analysis.requirementGaps?.length || 0}{" "}
                requirement gap(s)
              </summary>
              <ul className="list-disc pl-6 mt-1 text-amber-900 space-y-0.5">
                {(result.analysis.ambiguities || []).map((a, i) => (
                  <li key={`a${i}`}>Answer conflict: {a}</li>
                ))}
                {(result.analysis.requirementGaps || []).map((g, i) => (
                  <li key={`g${i}`}>Requirement gap: {g}</li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-sm text-slate-700">
            {result.analysis.sharedSteps.length
              ? `Shared steps (counted once): ${result.analysis.sharedSteps.join(", ")}.`
              : "No step names matched across the documents, so only Start and End are shared."}
          </p>

          {result.analysis.comparison && <ComparisonPanel result={result} />}

          <div>
            <h4 className="font-semibold text-slate-900 mb-2">Combined control-flow graph</h4>
            {result.analysis.origins && (
              <div className="mb-2 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {[-1, ...result.analysis.documents.map((_, i) => i)].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={`px-3 py-1 text-xs rounded border font-medium ${
                        view === v ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {v < 0 ? "All documents" : `Only ${result.analysis.documents[v].title}`}
                    </button>
                  ))}
                </div>
                <div className="flex gap-4 flex-wrap text-xs text-slate-600">
                  <Swatch color={SHARED_COLOR} label="In more than one document" />
                  {result.analysis.documents.map((d, i) =>
                    REGION_COLORS[i] ? <Swatch key={i} color={REGION_COLORS[i]} label={`Only in ${d.title}`} /> : null
                  )}
                  <span>Diamond = decision point</span>
                </div>
              </div>
            )}
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

function Swatch({ color, label }: { color: { fill: string; stroke: string }; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <i className="inline-block w-3 h-3 rounded-sm" style={{ background: color.fill, border: `1px solid ${color.stroke}` }} />
      {label}
    </span>
  );
}

// Common vs different: identical paths, steps only one document has, where similar
// paths split, and shared decisions whose outcomes differ.
function ComparisonPanel({ result }: { result: CombinedResult }) {
  const c = result.analysis.comparison!;
  const title = (i: number) => c.docTitles[i] || `Document ${i + 1}`;
  const matches = result.analysis.stepMatches || [];
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-slate-900">Common and different paths</h4>
      <p className="text-sm text-slate-700">
        <b>Common paths (same route in more than one document):</b>{" "}
        {c.commonPaths.length ? c.commonPaths.join(", ") : "none. Each document's paths differ somewhere; the table below shows where."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {c.onlySteps.map((o) => (
          <div key={o.doc} className="p-3 rounded-lg border text-sm" style={{ borderColor: REGION_COLORS[o.doc]?.stroke, background: REGION_COLORS[o.doc]?.fill }}>
            <p className="font-semibold">Only in {title(o.doc)} ({o.steps.length})</p>
            <p className="text-slate-700 mt-1">{o.steps.length ? o.steps.join(", ") : "none"}</p>
          </div>
        ))}
      </div>
      {matches.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-700">Steps worded differently but matched as the same step ({matches.length})</summary>
          <ul className="list-disc pl-6 mt-1 text-slate-700">
            {matches.map((m, i) => (
              <li key={i}>
                &ldquo;{m.step}&rdquo; ({title(m.doc)}) = &ldquo;{m.matchedStep}&rdquo; ({title(m.matchedDoc)})
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="overflow-x-auto">
        <p className="text-sm font-medium text-slate-800 mb-1">Where each path differs from the closest path in the other document</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="p-2 text-left">Path</th>
              <th className="p-2 text-left">Closest path</th>
              <th className="p-2">Shared steps</th>
              <th className="p-2 text-left">Where they differ</th>
            </tr>
          </thead>
          <tbody>
            {c.paths.length === 0 && (
              <tr>
                <td colSpan={4} className="p-2 text-slate-500">Every path is common.</td>
              </tr>
            )}
            {c.paths.map((r, i) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                <td className="p-2 whitespace-nowrap">{r.path} ({title(r.doc)})</td>
                <td className="p-2 whitespace-nowrap">{r.closestPath ? `${r.closestPath} (${title(r.otherDoc)})` : "none"}</td>
                <td className="p-2 text-center">{r.sharedSteps} of {r.steps}</td>
                <td className="p-2">
                  {r.differences.length === 0 ? (
                    "Same steps in the same order"
                  ) : (
                    <ol className="list-decimal pl-5 space-y-1">
                      {r.differences.map((d, k) => (
                        <li key={k}>
                          After <b>{d.after}</b>: {title(r.doc)} → {d.thisSteps.join(", ") || "(goes straight on)"}; {title(r.otherDoc)} →{" "}
                          {d.otherSteps.join(", ") || "(goes straight on)"}; back together at <b>{d.rejoin}</b>
                        </li>
                      ))}
                    </ol>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <p className="text-sm font-medium text-slate-800 mb-1">Shared decisions with different outcomes</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="p-2 text-left">Decision</th>
              <th className="p-2 text-left">Outcomes per document</th>
            </tr>
          </thead>
          <tbody>
            {c.decisions.length === 0 && (
              <tr>
                <td colSpan={2} className="p-2 text-slate-500">None: shared decisions lead to the same steps.</td>
              </tr>
            )}
            {c.decisions.map((d, i) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                <td className="p-2">{d.step}</td>
                <td className="p-2">
                  {d.outcomes.map((o) => (
                    <div key={o.doc}>
                      <b>{title(o.doc)}:</b> {o.outcomes.join("; ")}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
