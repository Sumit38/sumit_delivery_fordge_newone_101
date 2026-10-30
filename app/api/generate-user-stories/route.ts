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

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const STORY_TYPES = ["Functional", "Non-functional", "Technical", "Spike", "Integration", "Reporting"];
const FIB = [1, 2, 3, 5, 8, 13];

function toFibonacci(n: unknown): number {
  const v = Number(n) || 3;
  return FIB.reduce((best, f) => (Math.abs(f - v) < Math.abs(best - v) ? f : best), FIB[0]);
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

  const prompt = `You are a product owner writing user stories with a delivery team. Use the team's answers below; do not guess where they have answered.

REQUIREMENT:
${String(body.requirement).slice(0, 20000)}

COMPLEXITY LEVEL: ${body.complexity}

SPRINT AND PROJECT ANSWERS:
${describePlanningAnswers(answers, sprintPlanningQuestions)}
${extra.length ? `\nANSWERS ABOUT THIS REQUIREMENT:\n${extra.map((qa) => `- ${qa.question}\n  Answer: ${qa.answer}`).join("\n")}` : ""}
${previous.length ? `\nCURRENT STORIES (revise these):\n${JSON.stringify(previous.map((s: any) => ({ id: s.id, title: s.title, priority: s.priority, storyPoints: s.storyPoints, type: s.type, persona: s.persona })))}` : ""}
${feedback ? `\nTEAM FEEDBACK TO APPLY:\n${feedback}` : ""}

RULES:
1. Team capacity is ${velocity} points per sprint × ${sprintCount} sprints = ${capacity} points. Write 8-15 stories. Cover the release goal first; work beyond capacity is allowed but must be Should-Have or Nice-to-Have.
2. No story above ${maxPoints} points (Fibonacci: 1, 2, 3, 5, 8). Split bigger work.
3. Only include story types the team selected. "type" is one of: ${STORY_TYPES.join(", ")}.
4. "persona" is the user or role the story serves, using the team's answers.
5. Acceptance criteria: 3-5 per story, ${gherkin ? 'each written as "Given ..., when ..., then ..."' : "a short checklist of testable statements"}.
6. "dependsOn" lists ids of stories that must be done first (may be empty).
7. Priority: Must-Have, Should-Have or Nice-to-Have. estimatedDays is the effort for one developer.

Respond with JSON only, no markdown:
{"stories":[{"id":"US-001","priority":"Must-Have","type":"Functional","persona":"...","title":"...","description":"As a ..., I want ..., so that ...","acceptanceCriteria":["..."],"storyPoints":3,"estimatedDays":1.5,"dependsOn":[]}],"summary":"..."}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No valid JSON found in response");
  const data = JSON.parse(match[0]);
  if (!Array.isArray(data.stories)) throw new Error("Invalid stories structure");

  // Clean up: unique ids, Fibonacci points within the agreed size, known priorities
  const seen = new Set<string>();
  const stories = data.stories.slice(0, 20).map((s: any, i: number) => {
    let id = typeof s.id === "string" && s.id.trim() ? s.id.trim() : `US-${String(i + 1).padStart(3, "0")}`;
    if (seen.has(id)) id = `US-${String(i + 1).padStart(3, "0")}-${i}`;
    seen.add(id);
    return {
      id,
      priority: ["Must-Have", "Should-Have", "Nice-to-Have"].includes(s.priority) ? s.priority : "Should-Have",
      type: STORY_TYPES.includes(s.type) ? s.type : "Functional",
      persona: typeof s.persona === "string" ? s.persona : "",
      title: String(s.title || "Untitled story"),
      description: String(s.description || ""),
      acceptanceCriteria: Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria.map(String) : [],
      storyPoints: Math.min(toFibonacci(s.storyPoints), maxPoints),
      estimatedDays: Number(s.estimatedDays) || 1,
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : [],
    };
  });

  const { stories: planned, plan } = allocateSprints(stories, velocity, sprintCount, answers.sprintLength);

  return NextResponse.json({
    success: true,
    stories: planned,
    summary: data.summary || "",
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

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are a product requirements expert. Generate comprehensive, actionable user stories from this requirement.

REQUIREMENT:
${requirement}

COMPLEXITY LEVEL: ${complexity}

YOUR TASK:
1. Generate 8-12 detailed user stories
2. Each story format: "As a [user/actor], I want to [action], so that [business value]"
3. Make stories role-agnostic and comprehensive (anyone can understand and work on them)
4. Include acceptance criteria for each story (3-5 criteria per story)
5. Estimate story points (1-13 scale, fibonacci: 1,2,3,5,8,13)
6. Prioritize: Must-Have → Should-Have → Nice-to-Have
7. Stories should cover: Core features, Edge cases, Error handling, Security, Performance

RESPOND IN THIS EXACT JSON FORMAT (no markdown):
{
  "stories": [
    {
      "id": "US-001",
      "priority": "Must-Have",
      "title": "Story title",
      "description": "As a [user], I want to [action], so that [benefit]",
      "acceptanceCriteria": [
        "Criteria 1",
        "Criteria 2",
        "Criteria 3"
      ],
      "storyPoints": 5,
      "estimatedDays": 2.5
    }
  ],
  "summary": "Brief overview of all stories and coverage"
}`,
        },
      ],
    });

    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        jsonText += block.text;
      }
    }

    // Extract JSON
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const storiesData = JSON.parse(jsonMatch[0]);

    if (!storiesData.stories || !Array.isArray(storiesData.stories)) {
      throw new Error("Invalid stories structure");
    }

    return NextResponse.json({
      success: true,
      stories: storiesData.stories,
      summary: storiesData.summary,
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
