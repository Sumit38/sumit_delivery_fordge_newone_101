import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { requirementText, devComplexity } = await request.json();

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
          content: `You are a software architecture expert. Create a comprehensive development strategy for this requirement.

REQUIREMENT:
${requirementText}

DEVELOPMENT COMPLEXITY LEVEL: ${devComplexity || "Medium"}

CREATE A COMPLETE DEVELOPMENT STRATEGY INCLUDING:

1. IMPLEMENTATION APPROACH
   - Big Bang vs Incremental vs Phased
   - Rationale for choice
   - Release strategy

2. ARCHITECTURAL DECISIONS
   - System design overview
   - Components to build/modify
   - Integration points
   - Database changes needed

3. TECHNOLOGY RECOMMENDATIONS
   - Languages/Frameworks suggested
   - Libraries/Dependencies
   - Design patterns to use
   - Best practices to follow

4. DEVELOPMENT BREAKDOWN
   - Features to implement (with priority)
   - Components to create
   - Refactoring needs
   - Code quality standards

5. DEVELOPMENT PHASES
   - Phase 1: Foundation/Setup
   - Phase 2: Core Features
   - Phase 3: Integration
   - Phase 4: Polish & Optimization

6. CODE REVIEW REQUIREMENTS
   - Mandatory reviews for critical code
   - Performance benchmarks
   - Security requirements

7. DOCUMENTATION NEEDS
   - Architecture documentation
   - API documentation
   - Developer guides
   - Code comments

8. RESOURCE ESTIMATION
   - Dev team size & seniority
   - Development timeline
   - Budget estimate
   - Dependencies on other teams

RESPOND IN THIS EXACT JSON FORMAT (no markdown):
{
  "implementationApproach": {
    "type": "Phased",
    "phases": ["Phase 1 description", "Phase 2 description"],
    "rationale": "Why this approach",
    "releaseStrategy": "Canary / Blue-Green / Feature Flags"
  },
  "architecture": {
    "designOverview": "High-level design",
    "componentsToCreate": ["Component 1", "Component 2"],
    "componentsToModify": ["Component X"],
    "integrationPoints": ["Integration 1"],
    "databaseChanges": ["Migration 1", "New table"]
  },
  "technology": {
    "languages": ["Go", "TypeScript"],
    "frameworks": ["Next.js"],
    "libraries": ["Lodash", "Axios"],
    "patterns": ["Observer", "Factory"],
    "bestPractices": ["Clean code", "SOLID principles"]
  },
  "developmentBreakdown": [
    {
      "feature": "Feature 1",
      "priority": "P0",
      "components": ["Component A", "Component B"],
      "estimatedDays": 5
    }
  ],
  "developmentPhases": [
    {
      "phase": "Phase 1: Foundation",
      "duration": "1 week",
      "deliverables": ["Architecture doc", "Setup"]
    }
  ],
  "codeReview": {
    "criticalPaths": ["Authentication", "Payment"],
    "performanceBenchmarks": "API response < 200ms",
    "securityRequirements": ["Input validation", "OWASP compliance"]
  },
  "documentation": {
    "architecture": "System design document",
    "api": "OpenAPI/Swagger spec",
    "developer": "Setup & coding guide",
    "deployment": "Deployment runbook"
  },
  "resources": {
    "teamSize": 3,
    "seniority": "2 senior + 1 mid-level",
    "estimatedDays": 30,
    "estimatedCost": "45000",
    "dependencies": ["DevOps team for infrastructure", "Design team for UI specs"]
  },
  "risks": {
    "technical": ["Risk 1"],
    "schedule": ["Risk 2"],
    "resource": ["Risk 3"]
  },
  "successCriteria": ["Criteria 1", "Criteria 2"]
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

    function repairJSON(json: string): string {
      // Fix unescaped newlines in string values
      // This regex finds content between quotes and escapes newlines
      json = json.replace(/"([^"]*(?:\n[^"]*)*)"/g, (match) => {
        return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
      });

      // Remove trailing commas before ] or }
      json = json.replace(/,(\s*[}\]])/g, "$1");

      // Fix single quotes to double quotes (only outside of already quoted strings)
      // This is risky, so we only do it as a last resort

      return json;
    }

    let strategy;

    // Try multiple approaches to extract and parse JSON
    const attempts = [
      // Attempt 1: Direct parse
      () => {
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        return JSON.parse(jsonMatch[0]);
      },
      // Attempt 2: Repair and parse
      () => {
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        const repaired = repairJSON(jsonMatch[0]);
        return JSON.parse(repaired);
      },
      // Attempt 3: Remove trailing commas
      () => {
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        const cleaned = jsonMatch[0].replace(/,(\s*[}\]])/g, "$1");
        return JSON.parse(cleaned);
      },
      // Attempt 4: Remove comments and fix common issues
      () => {
        let json = jsonText.match(/\{[\s\S]*\}/)?.[0];
        if (!json) throw new Error("No JSON found");
        json = repairJSON(json);
        json = json.replace(/\/\/.*$/gm, "");
        json = json.replace(/\/\*[\s\S]*?\*\//g, "");
        return JSON.parse(json);
      },
      // Attempt 5: Try to fix incomplete JSON by adding closing braces
      () => {
        let json = jsonText.match(/\{[\s\S]*\}/)?.[0] || "";
        if (!json) throw new Error("No JSON found");
        json = repairJSON(json);

        // Count braces
        const openBraces = (json.match(/\{/g) || []).length;
        const closeBraces = (json.match(/\}/g) || []).length;

        // Add missing closing braces
        for (let i = closeBraces; i < openBraces; i++) {
          json += "}";
        }

        return JSON.parse(json);
      },
    ];

    let lastError: Error | null = null;
    for (const attempt of attempts) {
      try {
        strategy = attempt();
        break;
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    if (!strategy) {
      console.error("Failed to parse JSON after all attempts");
      console.error("Original response (first 500 chars):", jsonText.substring(0, 500));
      throw lastError || new Error("Failed to parse development strategy response");
    }

    return NextResponse.json({
      success: true,
      strategy,
    });
  } catch (error) {
    console.error("Development strategy error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Strategy generation failed",
      },
      { status: 500 }
    );
  }
}
