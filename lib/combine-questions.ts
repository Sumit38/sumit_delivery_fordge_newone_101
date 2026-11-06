// Guided path for "Combine 2–3 documents": one shared set of clarifying questions
// across all documents. Each answer is applied to every document it concerns, so the
// documents are analysed with the same assumptions and their scores stay comparable.
// Pure functions, no AI calls.

export const COMBINE_QUESTION_COUNT = 10;

export interface CombineQuestion {
  id: string;
  question: string;
  suggestedAnswer: string;
  options: string[];
  // 0-based indexes of the documents this question concerns
  appliesTo: number[];
  selectedOptions: string[];
  userAnswer: string;
}

// Same shape the single-requirement Refine flow sends to /api/analyze
export interface CombineAnswerStatus {
  questionNumber: number;
  question: string;
  answer: string;
  isAnswered: boolean;
}

// Cleans the AI's questions: at most 10, known documents only (1-based in the AI answer),
// a question with no valid document applies to all of them.
export function normaliseQuestions(raw: unknown, docCount: number): CombineQuestion[] {
  const list = Array.isArray(raw) ? raw : [];
  const all = Array.from({ length: docCount }, (_, i) => i);
  return list
    .filter((q: any) => q && typeof q.question === "string" && q.question.trim())
    .slice(0, COMBINE_QUESTION_COUNT)
    .map((q: any, i: number) => {
      const docs = Array.isArray(q.appliesTo) ? q.appliesTo : [];
      const appliesTo = [...new Set<number>(docs.map((d: unknown) => Number(d) - 1))]
        .filter((d) => Number.isInteger(d) && d >= 0 && d < docCount)
        .sort((a, b) => a - b);
      return {
        id: `cq${i + 1}`,
        question: String(q.question).trim(),
        suggestedAnswer: String(q.suggestedAnswer ?? "").trim(),
        options: (Array.isArray(q.options) ? q.options : [])
          .map((o: unknown) => String(o).trim())
          .filter(Boolean)
          .slice(0, 4),
        appliesTo: appliesTo.length ? appliesTo : all,
        selectedOptions: [],
        userAnswer: "",
      };
    });
}

// The user's own answer ("Selected: ..." plus typed text), or "" when skipped
export function userAnswerOf(q: Pick<CombineQuestion, "selectedOptions" | "userAnswer">): string {
  const selected = q.selectedOptions.length ? `Selected: ${q.selectedOptions.join(", ")}` : "";
  return [selected, q.userAnswer.trim()].filter(Boolean).join("\n");
}

export function isAnswered(q: Pick<CombineQuestion, "selectedOptions" | "userAnswer">): boolean {
  return userAnswerOf(q).length > 0;
}

export function questionsFor(docIndex: number, questions: CombineQuestion[]): CombineQuestion[] {
  return questions.filter((q) => q.appliesTo.includes(docIndex));
}

// Answer status for one document, numbered in the order the questions appear in its text
export function answerStatusFor(docIndex: number, questions: CombineQuestion[]): CombineAnswerStatus[] {
  return questionsFor(docIndex, questions).map((q, i) => {
    const own = userAnswerOf(q);
    return { questionNumber: i + 1, question: q.question, answer: own || q.suggestedAnswer, isAnswered: own.length > 0 };
  });
}

// Text sent to the analysis for one document. The answers go first because the
// analysis reads only the first 80,000 characters.
export function guidedTextFor(docIndex: number, docTitle: string, docText: string, questions: CombineQuestion[]): string {
  const mine = questionsFor(docIndex, questions);
  if (!mine.length) return docText;
  const qa = mine
    .map((q) => `Q: ${q.question}\nA: ${userAnswerOf(q) || q.suggestedAnswer}`)
    .join("\n\n");
  return `CLARIFICATIONS & ANSWERS:
${qa}

REQUIREMENT DOCUMENT${docTitle.trim() ? `: ${docTitle.trim()}` : ""}
${docText}`;
}
