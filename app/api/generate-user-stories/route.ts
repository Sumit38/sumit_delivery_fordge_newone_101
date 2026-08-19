import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { requirement, complexity } = await request.json();

    if (!requirement || requirement.trim().length < 50) {
      return NextResponse.json(
        { error: "Requirement must be at least 50 characters" },
        { status: 400 }
      );
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
