import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { requirementText, requirementType } = await request.json();

    if (!requirementText || requirementText.trim().length < 50) {
      return NextResponse.json(
        { error: "Requirement must be at least 50 characters" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are a technical complexity expert. Analyze this ${requirementType || "feature"} requirement for BOTH development and testing complexity.

REQUIREMENT:
${requirementText}

ANALYZE COMPLEXITY IN THREE DIMENSIONS:

1. DEVELOPMENT COMPLEXITY (McCabe's Complexity M = E - N + 2P)
   - Nodes (N): Design decisions, architectural components, integrations
   - Edges (E): Transitions, dependencies, interfaces
   - Paths (P): Distinct implementation paths
   - Calculate: M = E - N + 2P
   - List specific components that increase complexity
   - Effort estimate (dev days)

2. TESTING COMPLEXITY (McCabe's Complexity for test scenarios)
   - Nodes (N): Test decision points, state transitions, user actions
   - Edges (E): Test flow transitions, preconditions, outcomes
   - Paths (P): Distinct test scenarios needed
   - Calculate: M = E - N + 2P
   - Test types needed: unit, integration, E2E, performance, security, etc.
   - Edge cases and error scenarios
   - Effort estimate (QA days)

3. OPERATIONAL COMPLEXITY (DevOps/Infrastructure)
   - Deployment complexity: Low/Medium/High
   - Infrastructure changes needed
   - Monitoring & alerting needs
   - Rollback complexity
   - Effort estimate (DevOps days)

RESPOND IN THIS EXACT JSON FORMAT (no markdown):
{
  "development": {
    "nodesCount": 12,
    "edgesCount": 18,
    "pathsCount": 5,
    "complexityScore": 15,
    "components": ["Component 1", "Component 2"],
    "estimatedDays": 20,
    "keyComplexities": ["Description of complexity 1", "Description of complexity 2"],
    "implementationApproach": "Big bang / Incremental / Phased"
  },
  "testing": {
    "nodesCount": 20,
    "edgesCount": 35,
    "pathsCount": 8,
    "complexityScore": 21,
    "testTypes": ["Unit", "Integration", "E2E", "Performance"],
    "estimatedDays": 15,
    "edgeCases": ["Edge case 1", "Edge case 2"],
    "automationRatio": "70%"
  },
  "operations": {
    "deploymentComplexity": "Medium",
    "infrastructureChanges": ["Change 1", "Change 2"],
    "monitoringNeeds": ["Metric 1", "Metric 2"],
    "estimatedDays": 5
  },
  "riskFactors": {
    "high": ["Risk 1"],
    "medium": ["Risk 2"],
    "low": ["Risk 3"]
  }
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

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Dual complexity analysis error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}
