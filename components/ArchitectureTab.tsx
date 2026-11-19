"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import {
  LAYER_LABELS,
  architectureMermaid,
  traceability,
  type ArchAnswer,
  type ArchDesign,
  type ArchEffort,
  type ArchQuestion,
} from "@/lib/architecture-graph";
import { buildArchitectureDocx, renderArchitectureSvg, svgToPng } from "@/lib/architecture-docx";
import ArchitectureEffort from "./ArchitectureEffort";

interface DesignRow {
  id: string;
  version: number;
  status: "draft" | "approved" | "superseded";
  answers: ArchAnswer[];
  design: ArchDesign;
  feedback: string | null;
  effort: ArchEffort | null;
  created_at: string;
  approved_at: string | null;
}

interface Props {
  requirementId: string;
  requirementTitle: string;
  onOpenEstimation?: () => void;
}

async function readJson(response: Response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    if (response.status === 504 || response.status === 408) throw new Error("This took longer than the server allows. Please try again.");
    throw new Error(`Server error ${response.status}. Please try again.`);
  }
}

const levelClass = (v: string) =>
  v === "High" ? "bg-red-100 text-red-800" : v === "Low" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800";

export default function ArchitectureTab({ requirementId, requirementTitle, onOpenEstimation }: Props) {
  const [rows, setRows] = useState<DesignRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "questions" | "design" | "approve" | "docx">("");
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<ArchQuestion[] | null>(null);
  const [stepLabels, setStepLabels] = useState<string[]>([]);
  const [graphInfo, setGraphInfo] = useState<{ steps: number; decisions: number; points: number } | null>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string[]; note: string }>>({});
  const [feedback, setFeedback] = useState("");
  const [svg, setSvg] = useState("");
  const svgCount = useRef(0);

  const selected = rows.find((r) => r.id === selectedId) || rows[0] || null;
  const approved = rows.find((r) => r.status === "approved") || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch(`/api/architecture?requirementId=${encodeURIComponent(requirementId)}`);
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Could not load the designs");
      const versions: DesignRow[] = Array.isArray(data.versions) ? data.versions : [];
      setRows(versions);
      setSelectedId(versions[0]?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the designs");
    } finally {
      setLoading(false);
    }
  }, [requirementId]);

  useEffect(() => {
    setQuestions(null);
    setAnswers({});
    setFeedback("");
    load();
  }, [load]);

  // Draw the diagram of the selected version
  useEffect(() => {
    let cancelled = false;
    setSvg("");
    if (!selected) return;
    const code = architectureMermaid(selected.design);
    renderArchitectureSvg(code, `arch-${++svgCount.current}-${Date.now()}`)
      .then((s) => !cancelled && setSvg(s))
      .catch((err) => console.error("Architecture diagram failed:", err));
    return () => {
      cancelled = true;
    };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const startQuestions = async () => {
    setBusy("questions");
    setError("");
    try {
      const response = await authFetch("/api/architecture/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Could not prepare the questions");
      const qs: ArchQuestion[] = data.questions;
      setQuestions(qs);
      setStepLabels(data.graph?.labels || []);
      setGraphInfo({ steps: data.graph?.steps, decisions: data.graph?.decisions, points: data.graph?.points });
      // Start from the previous answers when re-answering, otherwise from the suggestions
      const previous = new Map((selected?.answers || []).map((a) => [a.question, a]));
      setAnswers(
        Object.fromEntries(
          qs.map((q) => {
            const prev = previous.get(q.question);
            const answer = prev ? prev.answer.filter((x) => q.options.includes(x)) : q.suggested;
            return [q.id, { answer, note: prev?.note || "" }];
          })
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the questions");
    } finally {
      setBusy("");
    }
  };

  const generate = async (withFeedback: boolean) => {
    setBusy("design");
    setError("");
    try {
      const payload: Record<string, unknown> = { requirementId };
      if (withFeedback) {
        payload.feedback = feedback;
      } else {
        payload.answers = (questions || []).map((q) => ({
          id: q.id,
          topic: q.topic,
          question: q.question,
          answer: answers[q.id]?.answer || [],
          note: answers[q.id]?.note || "",
        }));
      }
      const response = await authFetch("/api/architecture/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Could not write the design");
      const row: DesignRow = data.design;
      setRows((prev) => [row, ...prev]);
      setSelectedId(row.id);
      setQuestions(null);
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not write the design");
    } finally {
      setBusy("");
    }
  };

  const approve = async () => {
    if (!selected) return;
    setBusy("approve");
    setError("");
    try {
      const response = await authFetch("/api/architecture/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: selected.id }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Could not approve");
      const row: DesignRow = data.design;
      setRows((prev) => prev.map((r) => (r.id === row.id ? row : r.status === "approved" ? { ...r, status: "superseded" } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setBusy("");
    }
  };

  const downloadDocx = async () => {
    if (!selected) return;
    setBusy("docx");
    try {
      const png = svg ? await svgToPng(svg) : null;
      const blob = await buildArchitectureDocx({
        design: selected.design,
        answers: selected.answers,
        version: selected.version,
        status: selected.status,
        approvedAt: selected.approved_at,
        requirementTitle,
        diagramPng: png,
        effort: selected.effort,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Technical-Design-${(selected.design.title || requirementTitle).replace(/[^\w-]+/g, "-").slice(0, 60)}-v${selected.version}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? `Word download failed: ${err.message}` : "Word download failed");
    } finally {
      setBusy("");
    }
  };

  const trace = useMemo(() => (selected ? traceability(selected.design) : null), [selected]);

  if (loading) {
    return <div className="p-6 bg-white rounded-lg border border-slate-200 text-slate-600">Loading architecture…</div>;
  }

  const busyText =
    busy === "questions"
      ? "Reading the analysis graph and preparing questions…"
      : busy === "design"
        ? "Writing the architecture, risks and design document (about a minute)…"
        : "";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-900">Technical Architecture</h2>
            <p className="text-sm text-slate-600 mt-1">
              Questions come from this requirement&apos;s analysis graph: its integrations, data, decisions and approvals. Your
              answers shape a proposed architecture, a risk register and a Word technical design document. The estimation is made
              on the <strong>approved</strong> version and its estimated build hours, so every development hour traces to a task of a component and the steps it delivers.
            </p>
          </div>
          {approved && (
            <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
              ✅ Approved: v{approved.version}
              {onOpenEstimation && (
                <button onClick={onOpenEstimation} className="ml-3 font-semibold text-green-700 underline">
                  Go to estimation →
                </button>
              )}
            </div>
          )}
        </div>
        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
        {busyText && (
          <div className="mt-4 flex items-center gap-3 text-sm text-blue-700">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            {busyText}
          </div>
        )}
        {!questions && !busy && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={startQuestions} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              {rows.length ? "Answer the questions again (new version)" : "Start architecture questions"}
            </button>
          </div>
        )}
      </div>

      {/* Questions */}
      {questions && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Architecture questions ({questions.length})</h3>
            {graphInfo && (
              <p className="text-xs text-slate-500">
                From {graphInfo.steps} process steps, {graphInfo.decisions} decisions. Suggested answers are pre-selected; skipped
                questions become written assumptions in the design.
              </p>
            )}
          </div>
          {questions.map((q) => {
            const a = answers[q.id] || { answer: [], note: "" };
            const set = (answer: string[]) => setAnswers((prev) => ({ ...prev, [q.id]: { ...a, answer } }));
            return (
              <div key={q.id} className="p-4 rounded-lg border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">{q.topic}</span>
                  <span className="text-xs text-slate-400">{q.id}</span>
                </div>
                <p className="font-medium text-slate-900">{q.question}</p>
                {q.why && <p className="text-xs text-slate-600 mt-1">Why: {q.why}</p>}
                {q.basedOnSteps.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    From steps: {q.basedOnSteps.map((n) => `${n}. ${stepLabels[n - 1] || ""}`).join(" · ")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {q.options.map((opt) => {
                    const on = a.answer.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => set(q.multiple ? (on ? a.answer.filter((x) => x !== opt) : [...a.answer, opt]) : on ? [] : [opt])}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:border-blue-400"
                        }`}
                      >
                        {opt}
                        {q.suggested.includes(opt) && <span className={`ml-1 text-[10px] ${on ? "text-blue-100" : "text-blue-600"}`}>suggested</span>}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => set([])}
                    className={`px-3 py-1.5 rounded-full text-sm border ${a.answer.length ? "border-dashed border-slate-300 text-slate-500" : "bg-slate-200 border-slate-300 text-slate-700"}`}
                  >
                    {a.answer.length ? "Skip" : "Skipped"}
                  </button>
                </div>
                <input
                  value={a.note}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { ...a, note: e.target.value } }))}
                  placeholder="Add a detail (optional), e.g. system name, version, constraint"
                  className="mt-3 w-full px-3 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => generate(false)}
              disabled={!!busy}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-400"
            >
              Generate architecture & design document
            </button>
            <button onClick={() => setQuestions(null)} disabled={!!busy} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Design */}
      {selected && !questions && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{selected.design.title || requirementTitle}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Version {selected.version} ·{" "}
                <span
                  className={`font-semibold ${
                    selected.status === "approved" ? "text-green-700" : selected.status === "superseded" ? "text-slate-500" : "text-amber-700"
                  }`}
                >
                  {selected.status === "approved" ? "Approved" : selected.status === "superseded" ? "Superseded" : "Draft – waiting for approval"}
                </span>
                {selected.feedback ? ` · changes asked: “${selected.feedback.slice(0, 80)}${selected.feedback.length > 80 ? "…" : ""}”` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {rows.length > 1 && (
                <select
                  value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-slate-300 rounded"
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      v{r.version} · {r.status}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={downloadDocx} disabled={!!busy} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-400">
                {busy === "docx" ? "Preparing Word…" : "⬇ Download Word (.docx)"}
              </button>
              {selected.status !== "approved" && (
                <button onClick={approve} disabled={!!busy} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:bg-slate-400">
                  {busy === "approve" ? "Approving…" : "✓ Approve this version"}
                </button>
              )}
            </div>
          </div>

          {selected.design.summary && <p className="text-slate-700">{selected.design.summary}</p>}

          {trace && (
            <div className={`p-3 rounded-lg text-sm ${trace.unassigned.length ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-green-50 border border-green-200 text-green-900"}`}>
              {trace.unassigned.length
                ? `${trace.rows.length - trace.unassigned.length} of ${trace.rows.length} process steps are delivered by a component. Not yet assigned: ${trace.unassigned.join(", ")} — ask for a change below; they are not covered by the estimated hours and widen the risk tolerance.`
                : `All ${trace.rows.length} process steps are delivered by at least one component.`}
            </div>
          )}

          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Architecture diagram</h4>
            <div className="border border-slate-200 rounded-lg p-3 overflow-x-auto bg-slate-50">
              {svg ? <div className="min-w-[600px]" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="text-sm text-slate-500">Drawing…</p>}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Components ({selected.design.components.length})</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2 text-left">Component</th>
                    <th className="p-2 text-left">Layer</th>
                    <th className="p-2 text-left">Technology</th>
                    <th className="p-2 text-left">Steps</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.design.components.map((c) => (
                    <tr key={c.id} className="border-t border-slate-200 align-top">
                      <td className="p-2">
                        <span className="font-medium">{c.name}</span>
                        {c.external && <span className="ml-1 text-xs text-slate-500">(external)</span>}
                        {c.responsibilities && <div className="text-xs text-slate-500">{c.responsibilities}</div>}
                      </td>
                      <td className="p-2 text-slate-600">{LAYER_LABELS[c.layer]}</td>
                      <td className="p-2 text-slate-600">{c.technology || "—"}</td>
                      <td className="p-2 text-slate-600">{c.steps.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ArchitectureEffort
            row={selected}
            onSaved={(row: DesignRow) => setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)))}
          />

          {selected.design.decisions.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Architecture decisions</h4>
              <ul className="space-y-2 text-sm">
                {selected.design.decisions.map((d, i) => (
                  <li key={i} className="p-3 rounded border border-slate-200">
                    <span className="font-medium">{d.decision}:</span> {d.choice}
                    <div className="text-xs text-slate-600 mt-1">
                      {d.reason}
                      {d.basedOn.length ? ` (answers ${d.basedOn.join(", ")})` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected.design.risks.length > 0 && (
            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Risk register: act now to avoid failure later</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-2 text-left">Risk</th>
                      <th className="p-2">Impact</th>
                      <th className="p-2">Likelihood</th>
                      <th className="p-2 text-left">Mitigation</th>
                      <th className="p-2 text-left">Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.design.risks.map((r, i) => (
                      <tr key={i} className="border-t border-slate-200 align-top">
                        <td className="p-2">{r.risk}</td>
                        <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded text-xs ${levelClass(r.impact)}`}>{r.impact}</span></td>
                        <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded text-xs ${levelClass(r.likelihood)}`}>{r.likelihood}</span></td>
                        <td className="p-2 text-slate-700">{r.mitigation}</td>
                        <td className="p-2 text-slate-600">{r.steps.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(
            [
              ["Integration approach", selected.design.sections.integration],
              ["Data architecture", selected.design.sections.data],
              ["Security & access", selected.design.sections.security],
              ["Non-functional requirements", selected.design.sections.nfr],
              ["Deployment & environments", selected.design.sections.deployment],
            ] as const
          )
            .filter(([, text]) => text)
            .map(([title, text]) => (
              <div key={title}>
                <h4 className="font-semibold text-slate-800 mb-1">{title}</h4>
                <p className="text-sm text-slate-700">{text}</p>
              </div>
            ))}

          <div className="grid md:grid-cols-2 gap-4">
            {selected.design.assumptions.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Assumptions</h4>
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  {selected.design.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
            {selected.design.openQuestions.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Open questions</h4>
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  {selected.design.openQuestions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>

          {trace && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-slate-800">Traceability: process steps → components</summary>
              <table className="w-full mt-2 border border-slate-200">
                <tbody>
                  {trace.rows.map((r) => (
                    <tr key={r.no} className={`border-t border-slate-200 ${r.components.length ? "" : "bg-amber-50"}`}>
                      <td className="p-1.5 w-10 text-slate-500">{r.no}</td>
                      <td className="p-1.5">{r.label}</td>
                      <td className="p-1.5 w-12 text-slate-500">{r.points} pt</td>
                      <td className="p-1.5 text-slate-700">
                        {r.components.map((id) => selected.design.components.find((c) => c.id === id)?.name).join(", ") || "Not assigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-semibold text-slate-800 mb-2">Request changes (creates a new version)</h4>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="e.g. Host on Azure instead of AWS; use the existing ServiceNow instance for approvals; add a reporting service"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
            />
            <button
              onClick={() => generate(true)}
              disabled={!!busy || !feedback.trim()}
              className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 disabled:bg-slate-400"
            >
              Regenerate with these changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
