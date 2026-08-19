import { NextRequest, NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const { requirementText, requirementTitle } = await request.json();

    if (!requirementText) {
      return NextResponse.json(
        { error: "Requirement text is required" },
        { status: 400 }
      );
    }

    const client = new Anthropic();

    const prompt = `You are a business analyst expert. Analyze the following requirement and generate a structured use case document in JSON format.

REQUIREMENT:
${requirementText}

Generate a comprehensive use case with the following structure (respond ONLY with valid JSON):
{
  "useCaseTitle": "A clear title for this use case",
  "description": "A 2-3 sentence executive summary of what this use case accomplishes",
  "actors": [
    { "name": "Actor Name", "role": "What this actor does in the use case" }
  ],
  "preconditions": [
    "Precondition 1",
    "Precondition 2"
  ],
  "mainFlow": [
    { "step": 1, "actor": "Actor name", "action": "What the actor does" },
    { "step": 2, "actor": "System/User", "action": "Next step in the flow" }
  ],
  "alternativeFlows": [
    {
      "name": "Alternative Flow Name",
      "trigger": "When this happens",
      "steps": [
        { "step": 1, "actor": "Actor", "action": "Action" }
      ]
    }
  ],
  "exceptionFlows": [
    {
      "name": "Exception Name",
      "trigger": "If this error occurs",
      "resolution": "Then do this"
    }
  ],
  "postconditions": [
    "System state after use case completes",
    "Data persisted"
  ],
  "businessValue": "Why this use case is important",
  "kpis": [
    { "metric": "KPI Name", "target": "Target value", "currentState": "Current baseline" }
  ]
}

Rules:
- Be specific and detailed for the requirement provided
- Actors should be real roles (not generic)
- Main flow should have 5-8 clear steps
- Include at least 2 alternative flows
- Include at least 1 exception flow
- KPIs should be measurable and relevant
- All fields should be non-empty and specific to the requirement`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 6000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Extract and parse JSON response
    let useCaseData;
    let jsonText = content.text;

    // Remove markdown code blocks if present
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1];
    }

    try {
      // Try direct parse first
      useCaseData = JSON.parse(jsonText);
    } catch (parseError) {
      // If direct parse fails, try to extract JSON from the text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          useCaseData = JSON.parse(jsonMatch[0]);
        } catch (secondError) {
          // Try repairing common JSON issues
          let repaired = jsonMatch[0]
            .replace(/,\s*}/g, "}") // Remove trailing commas before }
            .replace(/,\s*]/g, "]") // Remove trailing commas before ]
            .replace(/\n/g, "\\n"); // Escape newlines in strings

          try {
            useCaseData = JSON.parse(repaired);
          } catch (thirdError) {
            console.error("Failed to parse Claude response. First 500 chars:", jsonText.substring(0, 500));
            console.error("Last 500 chars:", jsonText.substring(Math.max(0, jsonText.length - 500)));
            console.error("Parse error:", thirdError);
            return NextResponse.json(
              { error: "Failed to parse use case data. Please try again." },
              { status: 500 }
            );
          }
        }
      } else {
        console.error("No JSON found in response:", jsonText.substring(0, 500));
        return NextResponse.json(
          { error: "No valid use case data in response" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: useCaseData,
    });
  } catch (error) {
    console.error("Error generating use case QA:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
