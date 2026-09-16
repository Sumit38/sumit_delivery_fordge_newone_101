"use client";

import { useState } from "react";
import {
  estimationQuestions,
  budgetQuestion,
  EstimationQuestion,
} from "@/lib/estimation-questions";

interface EstimationQuestionsFormProps {
  complexityScore: number;
  onSubmit: (answers: Record<number, any>) => Promise<void>;
  onCancel: () => void;
}

export function EstimationQuestionsForm({
  complexityScore,
  onSubmit,
  onCancel,
}: EstimationQuestionsFormProps) {
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [includeBudget, setIncludeBudget] = useState(false);

  const handleChange = (
    questionId: number,
    value: any
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Calculate required questions
    const requiredQuestions = estimationQuestions.length + (includeBudget ? 1 : 0);

    // Validate all questions answered
    if (Object.keys(answers).length !== requiredQuestions) {
      setError("Please answer all questions");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(answers);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate estimation"
      );
    } finally {
      setLoading(false);
    }
  };

  const totalQuestions = estimationQuestions.length + (includeBudget ? 1 : 0);
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 text-white p-6 border-b">
          <h2 className="text-2xl font-bold mb-2">📊 Generate Estimation</h2>
          <p className="text-blue-100">
            Answer questions to create a detailed project estimation
          </p>
          <div className="mt-4 bg-blue-700 rounded p-3 text-sm">
            <strong>Complexity Score: {complexityScore}</strong> - This will be
            the baseline for effort calculation
          </div>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {answeredCount}/{totalQuestions}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round((answeredCount / totalQuestions) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(answeredCount / totalQuestions) * 100}%`,
              }}
            ></div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              ❌ {error}
            </div>
          )}

          {/* Budget Toggle Option */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBudget}
                onChange={(e) => {
                  setIncludeBudget(e.target.checked);
                  // Clear budget answer if toggled off
                  if (!e.target.checked && answers[8]) {
                    setAnswers((prev) => {
                      const updated = { ...prev };
                      delete updated[8];
                      return updated;
                    });
                  }
                }}
                className="w-5 h-5 text-blue-600 rounded cursor-pointer"
              />
              <div>
                <div className="font-semibold text-gray-900">
                  💰 Include Budget Calculation?
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Enable this to calculate project cost estimation based on hourly rates
                </div>
              </div>
            </label>
          </div>

          {estimationQuestions.map((question, idx) => (
            <div key={question.id} className="border-b pb-6 last:border-b-0">
              <div className="flex items-start justify-between mb-3">
                <label className="block">
                  <span className="text-lg font-semibold text-gray-800">
                    {idx + 1}. {question.question}
                  </span>
                  {question.helpText && (
                    <span className="text-sm text-gray-500 mt-1 block">
                      💡 {question.helpText}
                    </span>
                  )}
                </label>
              </div>

              {question.type === "radio" && question.options ? (
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <label
                      key={option}
                      className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition"
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={(e) =>
                          handleChange(question.id, e.target.value)
                        }
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="ml-3 text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              ) : question.type === "number" ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={answers[question.id] || ""}
                    onChange={(e) =>
                      handleChange(question.id, parseInt(e.target.value))
                    }
                    placeholder={`Enter value${question.range ? ` (${question.range})` : ""}`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {question.unit && (
                    <span className="text-sm text-gray-600">{question.unit}</span>
                  )}
                </div>
              ) : null}
            </div>
          ))}

          {/* Conditional Budget Question */}
          {includeBudget && (
            <div className="border-b pb-6 bg-blue-50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <label className="block">
                  <span className="text-lg font-semibold text-gray-800">
                    {estimationQuestions.length + 1}. {budgetQuestion.question}
                  </span>
                  {budgetQuestion.helpText && (
                    <span className="text-sm text-gray-500 mt-1 block">
                      💡 {budgetQuestion.helpText}
                    </span>
                  )}
                </label>
              </div>
              <div className="space-y-2">
                <input
                  type="number"
                  value={answers[8] || ""}
                  onChange={(e) =>
                    handleChange(8, parseInt(e.target.value))
                  }
                  placeholder={`Enter value${budgetQuestion.range ? ` (${budgetQuestion.range})` : ""}`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {budgetQuestion.unit && (
                  <span className="text-sm text-gray-600">{budgetQuestion.unit}</span>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || answeredCount !== totalQuestions}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Calculating...
                </span>
              ) : (
                `Generate Estimation (${answeredCount}/${totalQuestions})`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
