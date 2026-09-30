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

    // Generate pitch deck using Claude - with structured data for professional design
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 5000,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: `Create a professional executive-grade pitch deck based on these answers:

PROJECT: ${requirementTitle}

ANSWERS:
${answersSummary}

Generate a compelling 9-slide pitch deck with UNIQUE styling for each slide type:

STRUCTURE & SLIDE TYPES:
1. TITLE SLIDE - Project name with compelling tagline (full-screen impact)
2. PROBLEM SLIDE - Current challenge/pain point (problem statement)
3. SOLUTION SLIDE - Your solution approach (how you solve it)
4. MARKET OPPORTUNITY - Market size & growth potential (opportunity slide)
5. VALUE PROPOSITION - Key benefits & differentiation (value statement)
6. ROADMAP SLIDE - Project timeline with phases & milestones (timeline visualization)
7. COMPETITIVE ADVANTAGE - Why you're better (competitive positioning)
8. KEY METRICS - Success measures & KPIs (metrics dashboard)
9. CALL TO ACTION - Next steps & engagement (closing slide)

For ROADMAP SLIDE specifically, provide:
- phases: Array of {name, duration, startMonth, endMonth, description}
- milestones: Array of {name, month, description}
- Example: phases: [{name: "Planning", duration: "2 weeks", startMonth: 1, endMonth: 1}, ...]

For each slide, provide:
- slideType: "title" | "problem" | "solution" | "market" | "value" | "roadmap" | "competitive" | "metrics" | "cta"
- title: Compelling slide title
- description: 2-3 sentence overview
- content: Array of key points (3-5 items)
- notes: Optional presenter notes
- specialData: For roadmap/metrics - structured data for visualization

Format EXACTLY as JSON (no markdown):
{
  "title": "Project Name - Executive Pitch Deck",
  "slides": [
    {
      "slideNumber": 1,
      "slideType": "title",
      "title": "Slide Title",
      "tagline": "For title slide only",
      "description": "Brief overview",
      "content": ["Point 1", "Point 2"],
      "notes": "Presenter notes",
      "specialData": {}
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
      title: pitchDeckData.title || `${requirementTitle} - Executive Pitch Deck`,
      slides: pitchDeckData.slides.map((slide: any) => ({
        slideNumber: slide.slideNumber || 0,
        slideType: slide.slideType || "content",
        title: slide.title || "Untitled Slide",
        tagline: slide.tagline || "",
        description: slide.description || "",
        content: Array.isArray(slide.content) ? slide.content : [String(slide.content)],
        notes: slide.notes || "",
        specialData: slide.specialData || {},
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
