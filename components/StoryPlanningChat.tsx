"use client";

import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { sprintPlanningQuestions, type PlanningAnswers } from "@/lib/story-planning";

interface AgentQuestion {
  id: string;
  question: string;
  type: "single" | "multi" | "number" | "text";
  options?: string[];
  suggested?: string[];
  why?: string;
  helpText?: string;
  unit?: string;
  min?: number;
  max?: number;
  default?: string | string[] | number;
  fromRequirement?: boolean; // asked by the agent after reading the requirement
}

export interface QuestionAnswer {
  question: string;
  answer: string;
}

interface StoryPlanningChatProps {
  requirementText: string;
  complexityLevel: string;
  initialAnswers?: PlanningAnswers;
  onComplete: (planningAnswers: PlanningAnswers, questionAnswers: QuestionAnswer[]) => void;
  onSkip: () => void;
}

type Answer = string | string[] | number;

const formatAnswer = (q: AgentQuestion, a: Answer | undefined) => {
  if (a === undefined || a === "" || (Array.isArray(a) && a.length === 0)) return "No answer";
  if (Array.isArray(a)) return a.join(", ");
  return q.unit ? `${a} ${q.unit}` : String(a);
};

export default function StoryPlanningChat({
  requirementText,
  complexityLevel,
  initialAnswers,
  onComplete,
  onSkip,
}: StoryPlanningChatProps) {
  const fixed: AgentQuestion[] = sprintPlanningQuestions.map((q) => ({ ...q }));
  const [aiQuestions, setAiQuestions] = useState<AgentQuestion[]>([]);
  const [aiStatus, setAiStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => ({ ...(initialAnswers || {}) }));
  // A repeat session starts after the sprint answers it already has
  const [index, setIndex] = useState(() => {
    const i = sprintPlanningQuestions.findIndex((q) => initialAnswers?.[q.id] === undefined);
    return i === -1 ? sprintPlanningQuestions.length : i;
  });
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState<Answer>("");
  const [otherText, setOtherText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // The agent reads the requirement and prepares its own questions while the
  // user answers the sprint questions.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/generate-story-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirement: requirementText, complexity: complexityLevel }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        if (cancelled) return;
        setAiQuestions(
          (data.questions || []).map((q: any) => ({
            id: q.id,
            question: q.question,
            type: q.multi ? "multi" : "single",
            options: q.options,
            suggested: q.suggested,
            why: q.why,
            fromRequirement: true,
          }))
        );
        setAiStatus("ready");
      } catch {
        if (!cancelled) setAiStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requirementText, complexityLevel]);

  const questions = [...fixed, ...aiQuestions];
  const current: AgentQuestion | undefined = questions[index];
  const waitingForAgent = !done && index >= fixed.length && aiStatus === "loading";

  // Prefill the input for the current question
  useEffect(() => {
    if (!current) return;
    const existing = answers[current.id];
    if (existing !== undefined) setDraft(existing);
    else if (current.type === "multi") setDraft((current.suggested?.length ? current.suggested : (current.default as string[])) || []);
    else if (current.type === "number") setDraft((current.default as number) ?? "");
    else setDraft("");
    setOtherText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id]);

  // When the agent's questions arrive (or fail) while the user is waiting, move on
  useEffect(() => {
    if (index >= questions.length && aiStatus !== "loading" && !done) setDone(true);
  }, [aiStatus, index, questions.length, done]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [index, done, aiStatus]);

  const answer = (value: Answer) => {
    if (!current) return;
    const next = { ...answers, [current.id]: value };
    setAnswers(next);
    // Go to the next question not answered yet
    let i = index + 1;
    while (i < questions.length && next[questions[i].id] !== undefined) i++;
    setIndex(i);
    if (i >= questions.length && aiStatus !== "loading") setDone(true);
  };

  const editQuestion = (i: number) => {
    setDone(false);
    setIndex(i);
  };

  const finish = () => {
    const planning: PlanningAnswers = {};
    for (const q of fixed) {
      const a = answers[q.id];
      planning[q.id] = a !== undefined ? a : (q.default ?? "");
    }
    const qa: QuestionAnswer[] = aiQuestions
      .filter((q) => answers[q.id] !== undefined && formatAnswer(q, answers[q.id]) !== "No answer")
      .map((q) => ({ question: q.question, answer: formatAnswer(q, answers[q.id]) }));
    onComplete(planning, qa);
  };

  const answeredList = questions.slice(0, done ? questions.length : index).filter((q) => answers[q.id] !== undefined);
  const total = fixed.length + (aiStatus === "ready" ? aiQuestions.length : aiStatus === "loading" ? 5 : 0);
  const progress = Math.min(100, Math.round((Object.keys(answers).filter((k) => questions.some((q) => q.id === k)).length / Math.max(total, 1)) * 100));

  const chip = (label: string, active: boolean, onClick: () => void, suggested = false) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-sm text-left transition ${
        active ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-blue-50"
      }`}
    >
      {active && Array.isArray(draft) ? "✓ " : ""}
      {label}
      {suggested && <span className={`ml-2 text-xs ${active ? "text-blue-100" : "text-amber-600"}`}>★ suggested</span>}
    </button>
  );

  const renderInput = (q: AgentQuestion) => {
    if (q.type === "single") {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(q.options || []).map((o) => chip(o, answers[q.id] === o, () => answer(o), q.suggested?.includes(o)))}
          </div>
          {q.fromRequirement && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (otherText.trim()) answer(otherText.trim());
              }}
            >
              <input
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Or type your own answer..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button type="submit" disabled={!otherText.trim()} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:bg-slate-300">
                Send
              </button>
            </form>
          )}
        </div>
      );
    }
    if (q.type === "multi") {
      const selected = Array.isArray(draft) ? draft : [];
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(q.options || []).map((o) =>
              chip(o, selected.includes(o), () => setDraft(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]), q.suggested?.includes(o))
            )}
          </div>
          {q.fromRequirement && (
            <input
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Anything to add? (optional)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          )}
          <button
            type="button"
            disabled={selected.length === 0 && !otherText.trim()}
            onClick={() => answer(otherText.trim() ? [...selected, otherText.trim()] : selected)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:bg-slate-300"
          >
            Continue →
          </button>
        </div>
      );
    }
    if (q.type === "number") {
      const n = Number(draft);
      const valid = Number.isFinite(n) && n >= (q.min ?? 0) && n <= (q.max ?? Infinity) && draft !== "";
      return (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) answer(n);
          }}
        >
          <input
            type="number"
            value={draft as number | string}
            min={q.min}
            max={q.max}
            onChange={(e) => setDraft(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-28 px-3 py-2 border border-slate-300 rounded-lg"
            aria-label={q.question}
          />
          {q.unit && <span className="text-sm text-slate-600">{q.unit}</span>}
          <button type="submit" disabled={!valid} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:bg-slate-300">
            Continue →
          </button>
          {!valid && draft !== "" && (
            <span className="text-xs text-red-600 w-full">Enter a number between {q.min} and {q.max}.</span>
          )}
        </form>
      );
    }
    return (
      <div className="space-y-2">
        <textarea
          value={draft as string}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Type here, or skip"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => answer(String(draft).trim())} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">
            {String(draft).trim() ? "Continue →" : "Skip →"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold text-slate-900">🤖 Story planning session</p>
          <p className="text-xs text-slate-600">
            The agent asks about your sprints and this requirement, then writes the user stories from your answers.
          </p>
        </div>
        <div className="w-40">
          <div className="text-xs text-slate-600 mb-1">{progress}% answered</div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button type="button" onClick={onSkip} className="text-sm text-slate-600 underline hover:text-slate-900">
          Skip questions &amp; generate
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto bg-slate-50">
        <AgentBubble>
          Hi! I&apos;ve read your requirement. I&apos;ll ask about how your team works first, then a few questions about the
          requirement itself. Pick an option or type your own answer.
        </AgentBubble>

        {answeredList.map((q) => {
          const i = questions.indexOf(q);
          return (
            <div key={q.id} className="space-y-2">
              <AgentBubble muted>{q.question}</AgentBubble>
              <div className="flex justify-end items-center gap-2">
                <button type="button" onClick={() => editQuestion(i)} className="text-xs text-slate-500 underline hover:text-slate-800">
                  change
                </button>
                <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 text-sm max-w-[80%]">
                  {formatAnswer(q, answers[q.id])}
                </div>
              </div>
            </div>
          );
        })}

        {!done && index === fixed.length && aiStatus === "ready" && aiQuestions.length > 0 && (
          <AgentBubble>Thanks. Now a few questions about this requirement.</AgentBubble>
        )}

        {waitingForAgent && (
          <AgentBubble>
            <span className="inline-flex items-center gap-2 text-slate-500">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
              Reading the requirement to prepare my questions...
            </span>
          </AgentBubble>
        )}

        {!done && current && !waitingForAgent && (
          <div className="space-y-3">
            <AgentBubble>
              <div className="font-medium text-slate-900">{current.question}</div>
              {(current.why || current.helpText) && (
                <div className="text-xs text-slate-500 mt-1">💡 {current.why || current.helpText}</div>
              )}
            </AgentBubble>
            <div className="pl-10">{renderInput(current)}</div>
          </div>
        )}

        {done && (
          <div className="space-y-3">
            <AgentBubble>
              {aiStatus === "failed"
                ? "I couldn't prepare requirement-specific questions this time, but your sprint answers are enough to plan the stories. "
                : ""}
              That&apos;s everything I need. I&apos;ll write stories that fit your sprints and place them by priority and
              dependencies. You can change any answer above first.
            </AgentBubble>
            <div className="pl-10">
              <button
                type="button"
                onClick={finish}
                className="px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                ✨ Generate user stories
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function AgentBubble({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">🤖</div>
      <div
        className={`rounded-2xl rounded-tl-sm px-4 py-2 text-sm max-w-[85%] border ${
          muted ? "bg-white border-slate-200 text-slate-600" : "bg-white border-indigo-200 text-slate-800"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
