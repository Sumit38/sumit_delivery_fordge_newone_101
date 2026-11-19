"use client";

// Estimated build hours of one architecture version: the AI proposes tasks per component with
// low / likely / high hours, the user can edit them, and the estimation uses the saved figures.

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { effortSizing, type ArchDesign, type ArchEffort, type EffortTask } from "@/lib/architecture-graph";

interface Row {
  id: string;
  version: number;
  status: "draft" | "approved" | "superseded";
  design: ArchDesign;
  effort: ArchEffort | null;
}

interface Props {
  row: Row;
  onSaved: (row: any) => void;
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

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export default function ArchitectureEffort({ row, onSaved }: Props) {
  const [tasks, setTasks] = useState<EffortTask[]>(row.effort?.tasks || []);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "estimate" | "save">("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const locked = row.status === "superseded";

  useEffect(() => {
    setTasks(row.effort?.tasks || []);
    setDirty(false);
    setError("");
  }, [row.id, row.effort]);

  const sizing = useMemo(() => effortSizing(row.design, { tasks, generatedAt: "" }), [row.design, tasks]);
  const built = row.design.components.filter((c) => !c.external);

  const estimate = async () => {
    if (row.effort && !window.confirm("Replace the current hours (including your edits) with a new AI estimate?")) return;
    setBusy("estimate");
    setError("");
    try {
      const response = await authFetch("/api/architecture/effort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: row.id }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Could not estimate the hours");
      onSaved(data.design);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not estimate the hours");
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    setBusy("save");
    setError("");
    try {
      const response = await authFetch("/api/architecture/effort", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: row.id, tasks }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "Could not save the hours");
      onSaved(data.design);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the hours");
    } finally {
      setBusy("");
    }
  };

  const change = (id: string, patch: Partial<EffortTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDirty(true);
  };
  const remove = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDirty(true);
  };
  const addTask = (component: string) => {
    const next = 1 + Math.max(0, ...tasks.map((t) => Number(t.id.slice(1)) || 0));
    setTasks((prev) => [...prev, { id: `T${next}`, component, task: "New task", steps: [], low: 4, likely: 6, high: 10, edited: true }]);
    setOpen((o) => ({ ...o, [component]: true }));
    setDirty(true);
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h4 className="font-semibold text-slate-800">Estimated build hours (from this architecture)</h4>
          <p className="text-xs text-slate-500 mt-1">
            Tasks needed to build each component, with low / likely / high hours for one mid-level developer who knows the
            technology. You can change any figure. Testing, analysis and project management are not included here; the estimation
            adds them and applies your team&apos;s seniority and technology familiarity.
          </p>
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            {dirty && (
              <>
                <button onClick={save} disabled={!!busy} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:bg-slate-400">
                  {busy === "save" ? "Saving…" : "Save hours"}
                </button>
                <button
                  onClick={() => {
                    setTasks(row.effort?.tasks || []);
                    setDirty(false);
                  }}
                  disabled={!!busy}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700"
                >
                  Discard changes
                </button>
              </>
            )}
            <button onClick={estimate} disabled={!!busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-400">
              {busy === "estimate" ? "Estimating (about a minute)…" : row.effort ? "Re-estimate with AI" : "⏱ Estimate hours from this architecture"}
            </button>
          </div>
        )}
      </div>

      {error && <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      {!row.effort && !busy && (
        <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          No hours yet. {locked ? "This version was replaced by a newer one." : "The estimation needs them: click the button above."}
        </p>
      )}

      {row.effort && (
        <>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Tasks</div>
              <div className="font-semibold">{sizing.taskCount}</div>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Low</div>
              <div className="font-semibold">{num(sizing.low)} h</div>
            </div>
            <div className="p-2 rounded bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-700">Likely</div>
              <div className="font-semibold text-blue-900">{num(sizing.likely)} h</div>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">High</div>
              <div className="font-semibold">{num(sizing.high)} h</div>
            </div>
          </div>
          {sizing.withoutTasks.length > 0 && (
            <p className="mt-2 text-xs text-amber-800">Components without tasks (no hours): {sizing.withoutTasks.join(", ")}.</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Estimated by AI {row.effort.generatedAt ? new Date(row.effort.generatedAt).toLocaleString() : ""}
            {row.effort.editedAt ? ` · edited ${new Date(row.effort.editedAt).toLocaleString()}` : ""}
            {dirty ? " · unsaved changes" : ""}
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border border-slate-200">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2 text-left">Component / task</th>
                  <th className="p-2 text-left w-20">Steps</th>
                  <th className="p-2 text-right w-20">Low</th>
                  <th className="p-2 text-right w-20">Likely</th>
                  <th className="p-2 text-right w-20">High</th>
                  <th className="p-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {built.map((c) => {
                  const mine = tasks.filter((t) => t.component === c.id);
                  const total = sizing.components.find((x) => x.id === c.id);
                  const isOpen = open[c.id] ?? false;
                  return [
                    <tr key={c.id} className="border-t border-slate-300 bg-slate-50 font-medium">
                      <td className="p-2">
                        <button type="button" onClick={() => setOpen((o) => ({ ...o, [c.id]: !isOpen }))} className="text-left">
                          {isOpen ? "▾" : "▸"} {c.name}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {c.technology || c.type} · {mine.length} task{mine.length === 1 ? "" : "s"}
                          </span>
                        </button>
                      </td>
                      <td className="p-2 text-xs text-slate-500">{c.steps.join(", ") || "—"}</td>
                      <td className="p-2 text-right">{total ? num(total.low) : "—"}</td>
                      <td className="p-2 text-right">{total ? num(total.likely) : "—"}</td>
                      <td className="p-2 text-right">{total ? num(total.high) : "—"}</td>
                      <td className="p-2">
                        {!locked && (
                          <button type="button" title="Add a task" onClick={() => addTask(c.id)} className="text-blue-600 font-bold">
                            +
                          </button>
                        )}
                      </td>
                    </tr>,
                    ...(isOpen
                      ? mine.map((t) => {
                          const bad = !(t.low <= t.likely && t.likely <= t.high) || !t.likely;
                          const cell = (key: "low" | "likely" | "high") => (
                            <td className="p-1 text-right">
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={t[key]}
                                disabled={locked}
                                onChange={(e) => change(t.id, { [key]: Number(e.target.value) } as Partial<EffortTask>)}
                                className={`w-16 px-1 py-0.5 text-right border rounded ${bad ? "border-red-400" : "border-slate-200"}`}
                              />
                            </td>
                          );
                          return (
                            <tr key={t.id} className="border-t border-slate-100">
                              <td className="p-1 pl-6">
                                <input
                                  value={t.task}
                                  disabled={locked}
                                  onChange={(e) => change(t.id, { task: e.target.value })}
                                  className="w-full px-1 py-0.5 border border-slate-200 rounded"
                                />
                                {t.edited && <span className="text-[10px] text-indigo-600">edited</span>}
                              </td>
                              <td className="p-1 text-xs text-slate-500">{t.steps.join(", ") || "—"}</td>
                              {cell("low")}
                              {cell("likely")}
                              {cell("high")}
                              <td className="p-1 text-center">
                                {!locked && (
                                  <button type="button" title="Remove task" onClick={() => remove(t.id)} className="text-slate-400 hover:text-red-600">
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      : []),
                  ];
                })}
                <tr className="border-t border-slate-300 font-semibold">
                  <td className="p-2" colSpan={2}>
                    Total build hours
                  </td>
                  <td className="p-2 text-right">{num(sizing.low)}</td>
                  <td className="p-2 text-right">{num(sizing.likely)}</td>
                  <td className="p-2 text-right">{num(sizing.high)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-1">Click a component to see and edit its tasks. Low must not exceed likely, nor likely exceed high.</p>
        </>
      )}
    </div>
  );
}
