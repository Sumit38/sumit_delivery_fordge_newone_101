import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { requirementText } = await request.json();

    if (!requirementText || requirementText.trim().length < 50) {
      return NextResponse.json(
        { error: "Requirement must be at least 50 characters" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are an enterprise architecture expert. Analyze this requirement and classify it comprehensively.

REQUIREMENT:
${requirementText}

CLASSIFY THE REQUIREMENT BY:
1. Type: Feature/Bug Fix/Technical Debt/Performance Optimization/Integration/Infrastructure/Security/Documentation
2. Business Impact: Low/Medium/High/Critical
3. Technical Risk: Low/Medium/High/Critical
4. Scope: Small (1-2 weeks) / Medium (2-4 weeks) / Large (1-2 months) / Very Large (2+ months)
5. Complexity: Low/Medium/High/Very High
6. Stakeholders Affected: List them
7. Dependencies: List any external dependencies
8. Success Metrics: What defines success?
9. Constraints: Time, budget, resource constraints
10. Key Challenges: What might go wrong?

RESPOND IN THIS EXACT JSON FORMAT (no markdown):
{
  "type": "Feature",
  "businessImpact": "High",
  "technicalRisk": "Medium",
  "scope": "Large",
  "complexity": "High",
  "stakeholders": ["Backend Team", "Frontend Team", "DevOps"],
  "dependencies": ["Database migration tool", "Third-party API"],
  "successMetrics": ["Performance < 2s", "100% uptime", "Zero bugs"],
  "constraints": "Must be live by Q3",
  "keyChallenges": "Complex data migration, backward compatibility",
  "executiveSummary": "Brief overview for stakeholders"
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

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const classification = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      classification,
    });
  } catch (error) {
    console.error("Classification error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Classification failed",
      },
      { status: 500 }
    );
  }
}
