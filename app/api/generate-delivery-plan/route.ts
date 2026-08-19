import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { requirementText, classification, devComplexity, testComplexity } = await request.json();

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
          content: `You are an enterprise delivery consultant. Create a comprehensive delivery plan from raw requirement to production.

REQUIREMENT:
${requirementText}

REQUIREMENT CLASSIFICATION:
Type: ${classification?.type || "Feature"}
Business Impact: ${classification?.businessImpact || "High"}
Scope: ${classification?.scope || "Large"}

COMPLEXITY ESTIMATES:
Dev Complexity: ${devComplexity || "High"}
Test Complexity: ${testComplexity || "High"}

CREATE A COMPLETE DELIVERY PLAN INCLUDING:

1. EXECUTIVE SUMMARY
   - What's being delivered
   - Why it matters
   - Success definition
   - Timeline & Budget

2. DELIVERY PHASES WITH TIMELINE
   - Phase 1: Requirements & Design Review (weeks)
   - Phase 2: Development (weeks)
   - Phase 3: Testing & QA (weeks)
   - Phase 4: Staging & UAT (weeks)
   - Phase 5: Production Deployment (days)
   - Phase 6: Post-Launch Support (weeks)

3. TEAM STRUCTURE & ALLOCATION
   - Development team (roles, count, seniority)
   - QA/Testing team (count, specializations)
   - DevOps/Infrastructure (if needed)
   - Project Management & Communication

4. MILESTONES & DELIVERABLES
   - Design Review Complete
   - Development Complete
   - Testing Complete
   - UAT Sign-off
   - Production Ready
   - Launch

5. DEPENDENCIES & BLOCKERS
   - Internal dependencies
   - External dependencies
   - 3rd party integrations
   - Resource constraints

6. BUDGET BREAKDOWN
   - Development costs
   - QA costs
   - Infrastructure/DevOps
   - Contingency (15%)
   - Total Budget

7. RISK MANAGEMENT
   - Identified risks (High/Medium/Low)
   - Impact assessment
   - Mitigation strategies
   - Contingency plans

8. SUCCESS CRITERIA & METRICS
   - Functional acceptance criteria
   - Performance benchmarks
   - Quality gates
   - Go-live readiness checklist

9. COMMUNICATION & GOVERNANCE
   - Stakeholder communication plan
   - Status reporting cadence
   - Decision-making process
   - Escalation procedures

10. GO-LIVE PLAN
    - Deployment strategy (canary, blue-green, etc.)
    - Rollback procedures
    - Monitoring & alerting
    - Support readiness

RESPOND IN THIS EXACT JSON FORMAT (no markdown):
{
  "executiveSummary": {
    "whatIsBeingDelivered": "Description",
    "whyItMatters": "Business value",
    "successDefinition": "How we know it succeeded",
    "timelineWeeks": 12,
    "budgetEstimate": 150000
  },
  "deliveryPhases": [
    {
      "phase": "Phase 1: Requirements & Design",
      "duration": 2,
      "team": ["PM", "Architect", "Tech Lead"],
      "deliverables": ["Design doc", "Architecture diagram"]
    },
    {
      "phase": "Phase 2: Development",
      "duration": 6,
      "team": ["3 Developers", "DevOps"],
      "deliverables": ["Code", "API docs"]
    },
    {
      "phase": "Phase 3: Testing & QA",
      "duration": 3,
      "team": ["2 QA Engineers"],
      "deliverables": ["Test report", "Defect log"]
    }
  ],
  "teamStructure": {
    "development": {
      "count": 3,
      "roles": ["1 Tech Lead (senior)", "1 Mid-level", "1 Junior"],
      "cost": 75000
    },
    "qa": {
      "count": 2,
      "roles": ["1 QA Lead", "1 QA Automation"],
      "cost": 40000
    },
    "devops": {
      "count": 1,
      "roles": ["DevOps Engineer"],
      "cost": 20000
    }
  },
  "milestones": [
    {
      "milestone": "Design Review Complete",
      "week": 2,
      "criteria": "Architecture approved by stakeholders"
    },
    {
      "milestone": "Development Complete",
      "week": 8,
      "criteria": "All features coded and code-reviewed"
    },
    {
      "milestone": "Testing Complete",
      "week": 11,
      "criteria": "All tests pass, critical bugs fixed"
    },
    {
      "milestone": "Production Launch",
      "week": 12,
      "criteria": "Zero blocking issues, monitoring active"
    }
  ],
  "dependencies": {
    "internal": ["Database team for schema changes"],
    "external": ["3rd party API - OAuth provider"],
    "blockers": "None identified"
  },
  "budget": {
    "development": 75000,
    "qa": 40000,
    "devops": 20000,
    "infrastructure": 5000,
    "contingency": 15000,
    "total": 155000
  },
  "risks": [
    {
      "risk": "API rate limiting from 3rd party",
      "impact": "High",
      "mitigation": "Implement caching, fallback mechanism"
    },
    {
      "risk": "Database migration delays",
      "impact": "Medium",
      "mitigation": "Start migration early, parallel testing"
    }
  ],
  "successCriteria": {
    "functional": ["All user stories accepted", "Zero critical bugs in prod"],
    "performance": ["API response < 200ms", "Page load < 3s"],
    "quality": ["85% code coverage", "0 security vulnerabilities"],
    "gol ive": ["All stakeholders signed off", "Support team trained"]
  },
  "goLivePlan": {
    "strategy": "Canary deployment - 10% traffic first",
    "rollbackTime": "< 30 minutes",
    "monitoring": "Real-time dashboards, alerting active",
    "supportReadiness": "24/7 on-call team"
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

    const plan = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Delivery plan generation error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Plan generation failed",
      },
      { status: 500 }
    );
  }
}
