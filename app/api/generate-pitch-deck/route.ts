import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [1/3] Validating pitch deck request...");

    // Get auth header
    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;

    try {
      const token = authHeader?.replace("Bearer ", "");
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const parts = token.split(".");
      if (parts.length !== 3) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const decoded = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8")
      );
      userId = decoded.sub || null;

      console.log("✅ [1/3] Auth success. UserId:", userId);
    } catch (authError) {
      console.error("⚠️ [1/3] Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    console.log("🔍 [2/3] Parsing request body...");
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("❌ [2/3] Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { requirementId, requirementTitle, answers } = body;

    if (!requirementId || !requirementTitle || !answers) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("✅ [2/3] Request validation successful");
    console.log("🔍 [3/3] Generating pitch deck with Claude...");

    // Format answers for Claude
    const answersSummary = Object.entries(answers)
      .map(([qId, answer]) => {
        const questionNum = parseInt(qId);
        const answerText = Array.isArray(answer) ? answer.join(", ") : answer;
        return `Q${questionNum}: ${answerText}`;
      })
      .join("\n");

    // Generate pitch deck using Claude
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: `Create a professional 8-10 slide pitch deck outline based on these answers:

PROJECT: ${requirementTitle}

ANSWERS:
${answersSummary}

Generate a compelling pitch deck with the following structure:
1. Title Slide - Project name and tagline
2. Problem - What problem are we solving?
3. Solution - How does this solve the problem?
4. Market Opportunity - Size and potential
5. Value Proposition - Key benefits
6. Business Model - Revenue model
7. Competitive Advantage - Why us?
8. Go-to-Market - How we'll reach customers
9. Key Metrics - Success measures
10. Call to Action - Next steps

For each slide, provide:
- A compelling title
- 3-5 key bullet points
- Optional notes for the presenter

Format as JSON:
{
  "title": "Project Name - Pitch Deck",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Title",
      "content": ["Point 1", "Point 2", "Point 3"],
      "notes": "Optional presenter notes"
    }
  ]
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

    console.log("✅ [3/3] Claude response received");

    // Parse JSON from response
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in Claude response");
    }

    const pitchDeckData = JSON.parse(jsonMatch[0]);

    // Ensure proper structure
    if (!pitchDeckData.slides || !Array.isArray(pitchDeckData.slides)) {
      throw new Error("Invalid pitch deck structure");
    }

    const pitchDeck = {
      title: pitchDeckData.title || `${requirementTitle} - Pitch Deck`,
      slides: pitchDeckData.slides.map((slide: any) => ({
        slideNumber: slide.slideNumber || 0,
        title: slide.title || "Untitled Slide",
        content: Array.isArray(slide.content) ? slide.content : [String(slide.content)],
        notes: slide.notes,
      })),
      generatedAt: new Date().toISOString(),
    };

    console.log("✅ ✅ ✅ PITCH DECK GENERATED SUCCESSFULLY ✅ ✅ ✅");

    return NextResponse.json({
      success: true,
      pitchDeck,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("❌ ❌ ❌ PITCH DECK GENERATION ERROR ❌ ❌ ❌");
    console.error("Message:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate pitch deck",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
