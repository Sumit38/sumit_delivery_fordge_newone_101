import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { COMBINE_QUESTION_COUNT, normaliseQuestions } from "@/lib/combine-questions";

// Guided path for "Combine 2–3 documents": writes one set of 10 clarifying questions
// across all the documents, so every document is analysed with the same answers.

export const maxDuration = 120; // Vercel Hobby with Fluid compute allows up to 300 s

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});

// Keeps the prompt small enough for a quick answer; the questions only need the gist
const MAX_CHARS_PER_DOC = 25_000;

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const limited = checkRateLimit(auth.userId);
  if (limited) return limited;

  try {
    const body = await request.json();
    const documents: Array<{ title: string; text: string }> = (Array.isArray(body?.documents) ? body.documents : [])
      .filter((d: any) => d && typeof d.text === "string" && d.text.trim().length >= 50)
      .slice(0, 3)
      .map((d: any, i: number) => ({
        title: typeof d.title === "string" && d.title.trim() ? d.title.trim().slice(0, 200) : `Document ${i + 1}`,
        text: d.text.slice(0, MAX_CHARS_PER_DOC),
      }));

    if (documents.length < 2) {
      return NextResponse.json({ error: "Add at least two documents of 50 characters or more." }, { status: 400 });
    }

    const docsText = documents
      .map((d, i) => `=== DOCUMENT ${i + 1}: ${d.title} ===\n${d.text}`)
      .join("\n\n");

    const prompt = `You are a requirements analyst. These ${documents.length} requirement documents will each be analysed for cyclomatic complexity (their control-flow graphs, decisions and Start-to-End paths) and then compared with each other.

${docsText}

Write exactly ${COMBINE_QUESTION_COUNT} clarifying questions whose answers make the analysis more accurate and keep the documents comparable. Focus on:
- decisions whose outcomes or targets are unclear (what happens on reject, on missing data, on timeout)
- loops with no clear exit or retry limit
- steps or rules that differ between the documents, or that one document leaves out, so both are analysed with the same assumption
- error handling and exception flows that change the paths

For each question:
- "appliesTo": the document numbers it concerns (for example [1, 2]); use all documents when it is a shared rule
- "suggestedAnswer": the most likely answer based on the documents
- "options": 2-4 short, specific choices (under 20 words each), not plain yes/no
- Mention the document title in the question when it concerns only one document

Respond with JSON only, no markdown:
{"questions":[{"question":"...","appliesTo":[1,2],"suggestedAnswer":"...","options":["...","..."]}]}`;

    const response = await anthropic.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      },
      { timeout: 100_000, maxRetries: 0 }
    );

    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No valid JSON found in response");
    const questions = normaliseQuestions(JSON.parse(match[0]).questions, documents.length);
    if (!questions.length) throw new Error("No questions were written");

    return NextResponse.json({ success: true, questions });
  } catch (error) {
    console.error("Combine questions error:", error);
    return NextResponse.json(
      { error: "Could not prepare the guided questions. Please try again, or use the direct path." },
      { status: 500 }
    );
  }
}
