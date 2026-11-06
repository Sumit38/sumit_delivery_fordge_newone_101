import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});

export interface StoryQuestion {
  id: string;
  question: string;
  why: string;
  options: string[];
  multi: boolean;
  suggested: string[];
}

// The story-planning agent reads the requirement and asks the questions it
// needs answered before writing user stories (scope, users, rules, priorities).
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const limited = checkRateLimit(auth.userId);
  if (limited) return limited;

  try {
    const { requirement, complexity } = await request.json();
    if (!requirement || typeof requirement !== "string" || requirement.trim().length < 50) {
      return NextResponse.json({ error: "Requirement must be at least 50 characters" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are a product owner preparing to write user stories with a delivery team.
Read the requirement and ask the 5 or 6 questions whose answers would most change the user stories.

REQUIREMENT:
${requirement.slice(0, 20000)}

COMPLEXITY LEVEL: ${complexity || "unknown"}

Rules:
- Ask about this requirement specifically: who the users are, which features are in or out of the first release, business rules that are unclear, external systems, data, notifications, reporting.
- Do NOT ask about sprint length, velocity, number of sprints, story size or acceptance-criteria format; those are asked separately.
- Do NOT ask something the requirement already answers clearly.
- Each question has 2-5 short options taken from the requirement's own wording. Set "multi" to true when more than one option can apply.
- "suggested" holds the option(s) the requirement points to most; it may be empty.
- "why" is one short sentence on how the answer changes the stories.

Respond with JSON only, no markdown:
{"questions":[{"id":"q1","question":"...","why":"...","options":["..."],"multi":false,"suggested":["..."]}]}`,
        },
      ],
    });

    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No valid JSON found in response");
    const parsed = JSON.parse(match[0]);

    const questions: StoryQuestion[] = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .filter((q: any) => q && typeof q.question === "string" && q.question.trim())
      .slice(0, 6)
      .map((q: any, i: number) => {
        const options = (Array.isArray(q.options) ? q.options : [])
          .filter((o: unknown) => typeof o === "string" && o.trim())
          .slice(0, 6);
        return {
          id: `ai${i + 1}`,
          question: q.question.trim(),
          why: typeof q.why === "string" ? q.why.trim() : "",
          options,
          multi: Boolean(q.multi),
          suggested: (Array.isArray(q.suggested) ? q.suggested : []).filter((s: unknown) => options.includes(s)),
        };
      });

    return NextResponse.json({ success: true, questions });
  } catch (error) {
    console.error("❌ Story questions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare questions" },
      { status: 500 }
    );
  }
}
