"use client";

import { useState } from "react";
import { pitchDeckQuestions } from "@/lib/pitch-deck-questions";

interface PitchDeckQuestionsFormProps {
  onSubmit: (answers: Record<number, string | string[]>) => Promise<void>;
  onCancel: () => void;
}

export function PitchDeckQuestionsForm({
  onSubmit,
  onCancel,
}: PitchDeckQuestionsFormProps) {
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    questionId: number,
    value: string | string[]
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = pitchDeckQuestions.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (Object.keys(answers).length !== totalQuestions) {
      setError("Please answer all questions");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(answers);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate pitch deck"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">🎯 Pitch Deck Questions</h2>
          <p className="text-slate-600">
            Answer these questions to generate your pitch deck
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">❌ {error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {pitchDeckQuestions.map((question) => (
            <div key={question.id} className="space-y-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">
                  {question.id}. {question.question}
                </span>
                {question.helpText && (
                  <span className="text-xs text-slate-500 mt-1 block">
                    💡 {question.helpText}
                  </span>
                )}
              </label>

              {question.type === "textarea" && (
                <textarea
                  value={answers[question.id] || ""}
                  onChange={(e) => handleChange(question.id, e.target.value)}
                  placeholder={question.placeholder}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              )}

              {question.type === "text" && (
                <input
                  type="text"
                  value={answers[question.id] || ""}
                  onChange={(e) => handleChange(question.id, e.target.value)}
                  placeholder={question.placeholder}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {question.type === "radio" && (
                <div className="space-y-2">
                  {question.options?.map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={(e) => handleChange(question.id, e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === "checkbox" && (
                <div className="space-y-2">
                  {question.options?.map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={option}
                        checked={(answers[question.id] as string[])?.includes(option) || false}
                        onChange={(e) => {
                          const currentAnswers = (answers[question.id] as string[]) || [];
                          const newAnswers = e.target.checked
                            ? [...currentAnswers, option]
                            : currentAnswers.filter((a) => a !== option);
                          handleChange(question.id, newAnswers);
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-700">{option}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Progress */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-900">
                Progress: {answeredCount}/{totalQuestions}
              </span>
              <div className="w-32 bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || answeredCount !== totalQuestions}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating...
                </span>
              ) : (
                `Generate Pitch Deck (${answeredCount}/${totalQuestions})`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
