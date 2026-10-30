import { faker } from '@faker-js/faker';

/**
 * Q&A answers in the shape POST /api/analyze accepts (`questionsMetadata`).
 * Mixes valid and invalid answers to reach each analysis path (FR-13):
 * 0 valid → Assumption, 1–7 → Hybrid, 8 or more → Guided.
 */

export type QuestionAnswer = {
  questionNumber: number;
  question: string;
  answer: string;
  isAnswered: boolean;
};

/** Answers the PRD treats as not valid (FR-10). */
export const INVALID_ANSWERS = ["don't know", 'maybe', 'not sure', 'Maybe?', 'dont know', '   '] as const;

export const TOTAL_QUESTIONS = 15;

export function createAnswers({ valid, invalid = 0 }: { valid: number; invalid?: number }): QuestionAnswer[] {
  if (valid + invalid > TOTAL_QUESTIONS) {
    throw new Error(`valid + invalid must be ≤ ${TOTAL_QUESTIONS}`);
  }

  const answers: QuestionAnswer[] = [];
  for (let i = 0; i < valid; i++) {
    answers.push({
      questionNumber: i + 1,
      question: faker.lorem.sentence(),
      answer: `Selected: ${faker.lorem.words(4)}`,
      isAnswered: true,
    });
  }
  for (let i = 0; i < invalid; i++) {
    answers.push({
      questionNumber: valid + i + 1,
      question: faker.lorem.sentence(),
      answer: INVALID_ANSWERS[i % INVALID_ANSWERS.length],
      isAnswered: true,
    });
  }
  return answers;
}
