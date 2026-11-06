"use client";

import { useEffect } from "react";
import { isAnswered, type CombineQuestion } from "@/lib/combine-questions";

// Pop-up for the guided path of "Combine 2–3 documents": the shared clarifying
// questions, answered the same way as in the Refine tab (options and/or own text).

interface Props {
  questions: CombineQuestion[];
  docTitles: string[];
  onChange: (questions: CombineQuestion[]) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function CombineQuestionsModal({ questions, docTitles, onChange, onCancel, onConfirm }: Props) {
  const answered = questions.filter(isAnswered).length;
  const total = questions.length;

  // Escape closes the pop-up
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const update = (id: string, patch: Partial<CombineQuestion>) =>
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const toggle = (q: CombineQuestion, option: string) =>
    update(q.id, {
      selectedOptions: q.selectedOptions.includes(option)
        ? q.selectedOptions.filter((o) => o !== option)
        : [...q.selectedOptions, option],
    });

  const docName = (i: number) => docTitles[i]?.trim() || `Document ${i + 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="combine-questions-title">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <h3 id="combine-questions-title" className="text-lg font-bold text-slate-900">
            Guided path: {total} questions about your documents
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Each answer is used for every document it applies to, so the documents are analysed with the same assumptions and
            their scores can be compared fairly.
          </p>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id} className={`border rounded-lg p-4 space-y-3 ${isAnswered(q) ? "border-green-300 bg-green-50/40" : "border-slate-200 bg-white"}`}>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Q{idx + 1}. {q.question}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {q.appliesTo.map((d) => (
                    <span key={d} className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                      {docName(d)}
                    </span>
                  ))}
                </div>
              </div>

              {q.suggestedAnswer && (
                <div>
                  <label className="text-xs text-slate-600 font-semibold">Suggested Answer:</label>
                  <p className="text-sm text-slate-700 p-2 bg-slate-50 rounded mt-1">{q.suggestedAnswer}</p>
                </div>
              )}

              {q.options.length > 0 && (
                <div>
                  <label className="text-xs text-slate-600 font-semibold">Select applicable options (or add a custom answer below):</label>
                  <div className="space-y-2 mt-2">
                    {[...q.options, "All of the above", "NA"].map((option, optIdx) => (
                      <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.selectedOptions.includes(option)}
                          onChange={() => toggle(q, option)}
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                        />
                        <span className={`text-sm text-slate-700 ${optIdx >= q.options.length ? "font-semibold" : ""}`}>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-600 font-semibold">Custom/Additional Answer (optional):</label>
                <textarea
                  value={q.userAnswer}
                  onChange={(e) => update(q.id, { userAnswer: e.target.value })}
                  placeholder="Add any custom details or additional context..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mt-1"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-slate-200 space-y-3">
          <p className={`text-xs ${answered === total ? "text-green-700" : "text-amber-700"}`}>
            {answered} of {total} answered.{" "}
            {answered === total
              ? "All answered: the documents will be analysed on the Guided path."
              : answered > 0
                ? "Unanswered questions use the suggested answer, so the analysis will be Hybrid. Answer all of them for Guided."
                : "No answers yet: the suggested answers would be used and the analysis would count as Direct."}
          </p>
          <div className="flex gap-3 justify-end flex-wrap">
            <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={onConfirm} className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">
              Analyse &amp; combine with these answers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
