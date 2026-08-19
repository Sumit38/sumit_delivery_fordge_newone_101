import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { rawRequirement } = await request.json();

    if (!rawRequirement || rawRequirement.trim().length < 30) {
      return NextResponse.json(
        { error: "Raw requirement must be at least 30 characters" },
        { status: 400 }
      );
    }

    console.log("🔍 Refining requirement...");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are a requirements analyst. Convert the following raw requirement details into a structured use case with clarifying questions.

RAW REQUIREMENT:
${rawRequirement}

YOUR TASK:
1. Generate a clear use case name
2. Write a concise use case description
3. Identify all actors involved
4. List preconditions required
5. Define the main flow (5-8 steps)
6. Generate 10-15 clarifying questions that would help make this requirement more comprehensive
7. For each question, suggest an answer based on the raw requirement provided

RESPOND IN THIS EXACT JSON FORMAT (no markdown, just pure JSON):
{
  "useCaseName": "Clear name for this use case",
  "useCaseDescription": "2-3 sentence description",
  "actors": ["Actor1", "Actor2", "Actor3"],
  "preconditions": ["Precondition 1", "Precondition 2", "Precondition 3"],
  "mainFlow": ["Step 1: description", "Step 2: description", "..."],
  "questions": [
    {
      "id": "q1",
      "question": "What is the specific requirement?",
      "suggestedAnswer": "Based on your input, the answer might be...",
      "options": ["Option 1", "Option 2", "Option 3"]
    },
    {
      "id": "q2",
      "question": "Next clarifying question?",
      "suggestedAnswer": "Suggested answer based on context...",
      "options": ["Choice A", "Choice B", "Choice C"]
    }
  ]
}

CRITICAL INSTRUCTIONS FOR OPTIONS:
- For each question, provide 2-4 realistic predefined options based on the requirement context
- Options should be concise (under 20 words each)
- Always include specific, actionable choices relevant to the question
- Options should represent common scenarios, not generic yes/no

CRITICAL INSTRUCTIONS:
- Return ONLY valid JSON, no other text
- Suggested answers should be realistic based on the raw input
- Questions should uncover missing flows, edge cases, error handling, security, performance
- Make questions specific and actionable
- Ensure 10-15 questions total`,
        },
      ],
    });

    console.log("✅ Received response from Claude");

    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        jsonText += block.text;
      }
    }

    // Extract JSON (in case there's extra text)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const refinedData = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!refinedData.useCaseName || !refinedData.questions) {
      throw new Error("Invalid response structure");
    }

    return NextResponse.json({
      success: true,
      refinedData: {
        useCaseName: refinedData.useCaseName,
        useCaseDescription: refinedData.useCaseDescription,
        actors: refinedData.actors || [],
        preconditions: refinedData.preconditions || [],
        mainFlow: refinedData.mainFlow || [],
        questions: (refinedData.questions || []).map((q: any) => ({
          id: q.id || `q${Math.random()}`,
          question: q.question,
          suggestedAnswer: q.suggestedAnswer,
          options: q.options || [],
          selectedOptions: [],
          userAnswer: "",
        })),
      },
    });
  } catch (error) {
    console.error("❌ Refinement error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to refine requirement",
      },
      { status: 500 }
    );
  }
}
