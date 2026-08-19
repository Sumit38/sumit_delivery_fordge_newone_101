import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { requirementText, testingComplexity } = await request.json();

    if (!requirementText || requirementText.trim().length < 50) {
      return NextResponse.json(
        { error: "Requirement must be at least 50 characters" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are a QA strategy expert. Create a comprehensive testing strategy for this requirement.

REQUIREMENT:
${requirementText}

TESTING COMPLEXITY LEVEL: ${testingComplexity || "Medium"}

CREATE A COMPLETE TESTING STRATEGY INCLUDING:

1. TEST PYRAMID DISTRIBUTION
   - % Unit Tests (isolated component testing)
   - % Integration Tests (component interaction)
   - % E2E Tests (user workflows)
   - % Performance Tests
   - % Security Tests

2. TEST TYPES NEEDED
   - Functional testing approach
   - Non-functional testing needs
   - Performance testing targets
   - Security testing requirements
   - Compliance testing

3. MANUAL vs AUTOMATED
   - What to automate
   - What to test manually
   - Automation ROI estimate

4. TEST COVERAGE STRATEGY
   - Coverage target %
   - Critical paths to cover
   - Edge cases & error scenarios
   - Browser/device coverage (if applicable)

5. TESTING PHASES
   - Phase 1: Component testing
   - Phase 2: Integration testing
   - Phase 3: System testing
   - Phase 4: UAT

6. TEST ENVIRONMENT SETUP
   - Environments needed (dev, staging, prod)
   - Data requirements
   - Tools & frameworks

7. QUALITY GATES
   - Entry criteria for each phase
   - Exit criteria/acceptance
   - Defect severity levels

8. RESOURCE ESTIMATION
   - QA team size
   - Testing timeline
   - Budget estimate

RESPOND IN THIS EXACT JSON FORMAT (no markdown):
{
  "testPyramid": {
    "unit": 60,
    "integration": 30,
    "e2e": 10,
    "description": "Test distribution strategy"
  },
  "testTypes": {
    "functional": ["Test type 1", "Test type 2"],
    "nonFunctional": ["Performance", "Security"],
    "compliance": ["GDPR", "SOC2"]
  },
  "automationStrategy": {
    "automatedPercentage": 75,
    "toAutomate": ["Login flows", "Core business logic"],
    "manual": ["UX/UI edge cases", "Browser compatibility"],
    "roi": "High - 70% faster regression testing"
  },
  "coverageTargets": {
    "codeCoverage": "85%",
    "scenarioCoverage": "100%",
    "criticalPaths": ["Path 1", "Path 2"]
  },
  "testingPhases": [
    {
      "phase": "Component Testing",
      "duration": "2 weeks",
      "focus": "Unit tests + component testing"
    }
  ],
  "resources": {
    "qaTeamSize": 2,
    "testingDays": 15,
    "estimatedCost": "18000"
  },
  "qualityGates": {
    "unitTestPass": "100%",
    "integrationTestPass": "95%",
    "criticalBugsFound": "0"
  },
  "successCriteria": ["Criteria 1", "Criteria 2"],
  "risks": ["Risk 1", "Risk 2"]
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

    const strategy = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      strategy,
    });
  } catch (error) {
    console.error("Testing strategy error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Strategy generation failed",
      },
      { status: 500 }
    );
  }
}
