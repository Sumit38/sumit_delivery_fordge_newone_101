import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import {
  allocateSprints,
  describePlanningAnswers,
  sprintPlanningQuestions,
  type PlanningAnswers,
} from "@/lib/story-planning";

export const maxDuration = 120; // Vercel Hobby with Fluid compute allows up to 300 s

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});

const STORY_TYPES = ["Functional", "Non-functional", "Technical", "Spike", "Integration", "Reporting"];
const FIB = [1, 2, 3, 5, 8, 13];

// maxDuration is 120 s; finish well before Vercel stops the function
const DEADLINE_MS = 115_000;
const DETAIL_BATCH = 4;

function toFibonacci(n: unknown): number {
  const v = Number(n) || 3;
  return FIB.reduce((best, f) => (Math.abs(f - v) < Math.abs(best - v) ? f : best), FIB[0]);
}

function responseText(response: Anthropic.Message): string {
  return response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

function parseJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No valid JSON found in response");
  return JSON.parse(match[0]);
}

function uniqueId(raw: unknown, i: number, seen: Set<string>): string {
  let id = typeof raw === "string" && raw.trim() ? raw.trim() : `US-${String(i + 1).padStart(3, "0")}`;
  if (seen.has(id)) id = `US-${String(i + 1).padStart(3, "0")}-${i}`;
  seen.add(id);
  return id;
}

type Outline = { id: string; title: string; persona?: string; [key: string]: unknown };
type Detailed<T> = T & { description: string; acceptanceCriteria: string[] };

// Step 1 writes a short outline (titles, points, priorities ...). Step 2 writes the
// description and acceptance criteria for small groups of stories in parallel.
// Writing everything in one call took too long for big requirements.
async function generateInSteps<T extends Outline>(opts: {
  outlinePrompt: string;
  requirement: string;
  context: string;
  criteriaRule: string;
  clean: (stories: any[]) => T[];
}): Promise<{ stories: Detailed<T>[]; summary: string }> {
  const started = Date.now();

  const outlineResponse = await anthropic.messages.create(
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      temperature: 0,
      messages: [{ role: "user", content: opts.outlinePrompt }],
    },
    { timeout: 50_000, maxRetries: 0 }
  );
  const outlineData = parseJson(responseText(outlineResponse));
  if (!Array.isArray(outlineData.stories) || !outlineData.stories.length) throw new Error("Invalid stories structure");
  const outline = opts.clean(outlineData.stories);

  const batches: T[][] = [];
  for (let i = 0; i < outline.length; i += DETAIL_BATCH) batches.push(outline.slice(i, i + DETAIL_BATCH));

  const timeout = Math.max(DEADLINE_MS - (Date.now() - started) - 2_000, 8_000);
  const details = new Map<string, { description: string; acceptanceCriteria: string[] }>();
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const response = await anthropic.messages.create(
          {
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2500,
            temperature: 0,
            messages: [
              {
                role: "user",
                content: `You are a product owner. Write the details of the user stories listed below, based on this requirement.

REQUIREMENT:
${opts.requirement}
${opts.context}

STORIES TO DETAIL:
${JSON.stringify(batch)}

For each story write:
- "description": "As a ..., I want ..., so that ..." (use the story's persona when given)
- "acceptanceCriteria": ${opts.criteriaRule}

Respond with JSON only, no markdown:
{"stories":[{"id":"US-001","description":"As a ..., I want ..., so that ...","acceptanceCriteria":["..."]}]}`,
              },
            ],
          },
          { timeout, maxRetries: 0 }
        );
        const data = parseJson(responseText(response));
        for (const s of Array.isArray(data.stories) ? data.stories : []) {
          if (!s || typeof s.id !== "string") continue;
          details.set(s.id.trim(), {
            description: String(s.description || ""),
            acceptanceCriteria: Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria.map(String) : [],
          });
        }
      } catch (err) {
        console.error("User story details batch failed:", err instanceof Error ? err.message : err);
      }
    })
  );

  // A group that failed keeps a basic description so the stories still come back
  let missing = 0;
  const stories = outline.map((s) => {
    const d = details.get(s.id);
    if (d && d.description) return { ...s, description: d.description, acceptanceCriteria: d.acceptanceCriteria };
    missing++;
    const action = s.title.charAt(0).toLowerCase() + s.title.slice(1);
    return { ...s, description: `As a ${s.persona || "user"}, I want ${action}.`, acceptanceCriteria: [] as string[] };
  });

  let summary = typeof outlineData.summary === "string" ? outlineData.summary : "";
  if (missing) {
    summary += `${summary ? " " : ""}(Details for ${missing} ${missing === 1 ? "story" : "stories"} could not be written in time; generate again to fill them in.)`;
  }
  return { stories, summary };
}

async function generatePlannedStories(body: any) {
  const answers: PlanningAnswers = body.planningAnswers;
  const extra: Array<{ question: string; answer: string }> = Array.isArray(body.questionAnswers)
    ? body.questionAnswers
        .filter((qa: any) => qa && typeof qa.question === "string" && typeof qa.answer === "string" && qa.answer.trim())
        .slice(0, 10)
    : [];

  const velocity = Math.min(Math.max(Number(answers.velocity) || 30, 1), 500);
  const sprintCount = Math.min(Math.max(Number(answers.sprintCount) || 4, 1), 52);
  const capacity = velocity * sprintCount;
  const maxPoints = String(answers.storySize || "").startsWith("Small") ? 3 : String(answers.storySize || "").startsWith("Large") ? 8 : 5;
  const gherkin = String(answers.acceptanceStyle || "").startsWith("Given");

  const previous = Array.isArray(body.previousStories) ? body.previousStories.slice(0, 20) : [];
  const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 2000) : "";

  const requirementText = String(body.requirement).slice(0, 20000);
  const context = `
COMPLEXITY LEVEL: ${body.complexity}

SPRINT AND PROJECT ANSWERS:
${describePlanningAnswers(answers, sprintPlanningQuestions)}
${extra.length ? `\nANSWERS ABOUT THIS REQUIREMENT:\n${extra.map((qa) => `- ${qa.question}\n  Answer: ${qa.answer}`).join("\n")}` : ""}
${feedback ? `\nTEAM FEEDBACK TO APPLY:\n${feedback}` : ""}`;

  const outlinePrompt = `You are a product owner planning user stories with a delivery team. Use the team's answers below; do not guess where they have answered.

REQUIREMENT:
${requirementText}
${context}
${previous.length ? `\nCURRENT STORIES (revise these):\n${JSON.stringify(previous.map((s: any) => ({ id: s.id, title: s.title, priority: s.priority, storyPoints: s.storyPoints, type: s.type, persona: s.persona })))}` : ""}

RULES:
1. Team capacity is ${velocity} points per sprint × ${sprintCount} sprints = ${capacity} points. Plan 8-15 stories. Cover the release goal first; work beyond capacity is allowed but must be Should-Have or Nice-to-Have.
2. No story above ${maxPoints} points (Fibonacci: 1, 2, 3, 5, 8). Split bigger work.
3. Only include story types the team selected. "type" is one of: ${STORY_TYPES.join(", ")}.
4. "persona" is the user or role the story serves, using the team's answers.
5. "dependsOn" lists ids of stories that must be done first (may be empty).
6. Priority: Must-Have, Should-Have or Nice-to-Have. estimatedDays is the effort for one developer.
7. Titles are short and specific. Do NOT write descriptions or acceptance criteria yet.

Respond with JSON only, no markdown:
{"stories":[{"id":"US-001","priority":"Must-Have","type":"Functional","persona":"...","title":"...","storyPoints":3,"estimatedDays":1.5,"dependsOn":[]}],"summary":"..."}`;

  // Clean up: unique ids, Fibonacci points within the agreed size, known priorities
  const clean = (raw: any[]) => {
    const seen = new Set<string>();
    return raw.slice(0, 20).map((s: any, i: number) => ({
      id: uniqueId(s.id, i, seen),
      priority: ["Must-Have", "Should-Have", "Nice-to-Have"].includes(s.priority) ? s.priority : "Should-Have",
      type: STORY_TYPES.includes(s.type) ? s.type : "Functional",
      persona: typeof s.persona === "string" ? s.persona : "",
      title: String(s.title || "Untitled story"),
      storyPoints: Math.min(toFibonacci(s.storyPoints), maxPoints),
      estimatedDays: Number(s.estimatedDays) || 1,
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : [],
    }));
  };

  const data = await generateInSteps({
    outlinePrompt,
    requirement: requirementText,
    context,
    criteriaRule: `3-5 per story, ${gherkin ? 'each written as "Given ..., when ..., then ..."' : "a short checklist of testable statements"}`,
    clean,
  });

  const stories = data.stories.map((s) => ({
    id: s.id,
    priority: s.priority,
    type: s.type,
    persona: s.persona,
    title: s.title,
    description: s.description,
    acceptanceCriteria: s.acceptanceCriteria,
    storyPoints: s.storyPoints,
    estimatedDays: s.estimatedDays,
    dependsOn: s.dependsOn,
  }));

  const { stories: planned, plan } = allocateSprints(stories, velocity, sprintCount, answers.sprintLength);

  return NextResponse.json({
    success: true,
    stories: planned,
    summary: data.summary,
    sprintPlan: plan,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const limited = checkRateLimit(auth.userId);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { requirement, complexity } = body;

    if (!requirement || requirement.trim().length < 50) {
      return NextResponse.json(
        { error: "Requirement must be at least 50 characters" },
        { status: 400 }
      );
    }

    // Answers from the Q&A session: build stories for the team's sprints
    if (body.planningAnswers && typeof body.planningAnswers === "object") {
      return await generatePlannedStories(body);
    }

    const outlinePrompt = `You are a product requirements expert. Plan comprehensive, actionable user stories for this requirement.

REQUIREMENT:
${requirement}

COMPLEXITY LEVEL: ${complexity}

YOUR TASK:
1. Plan 8-12 user stories that anyone can understand and work on
2. Estimate story points (1-13 scale, fibonacci: 1,2,3,5,8,13) and estimatedDays
3. Prioritize: Must-Have → Should-Have → Nice-to-Have
4. Stories should cover: Core features, Edge cases, Error handling, Security, Performance
5. Titles are short and specific. Do NOT write descriptions or acceptance criteria yet.

RESPOND IN THIS EXACT JSON FORMAT (no markdown):
{"stories":[{"id":"US-001","priority":"Must-Have","title":"Story title","storyPoints":5,"estimatedDays":2.5}],"summary":"Brief overview of all stories and coverage"}`;

    const clean = (raw: any[]) => {
      const seen = new Set<string>();
      return raw.slice(0, 15).map((s: any, i: number) => ({
        id: uniqueId(s.id, i, seen),
        priority: typeof s.priority === "string" ? s.priority : "Should-Have",
        title: String(s.title || "Untitled story"),
        storyPoints: Number(s.storyPoints) || 3,
        estimatedDays: Number(s.estimatedDays) || 1,
      }));
    };

    const data = await generateInSteps({
      outlinePrompt,
      requirement: String(requirement),
      context: `\nCOMPLEXITY LEVEL: ${complexity}`,
      criteriaRule: "3-5 testable statements per story",
      clean,
    });

    return NextResponse.json({
      success: true,
      stories: data.stories.map((s) => ({
        id: s.id,
        priority: s.priority,
        title: s.title,
        description: s.description,
        acceptanceCriteria: s.acceptanceCriteria,
        storyPoints: s.storyPoints,
        estimatedDays: s.estimatedDays,
      })),
      summary: data.summary,
    });
  } catch (error) {
    console.error("❌ User stories generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate user stories",
      },
      { status: 500 }
    );
  }
}
