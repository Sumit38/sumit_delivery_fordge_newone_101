import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Scenario {
  id: number;
  name: string;
  description: string;
  complexity: "Low" | "Medium" | "High" | "Very High";
  actors: string[];
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  testCases: TestCase[];
  isTemplate?: boolean; // true if generated template, false/undefined if detailed from Claude
}

interface TestCase {
  id: string;
  name: string;
  steps: string[];
  expectedResult: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [1/3] Extracting scenarios from requirement...");

    const { requirementText, n, e, p, complexityScore } = await request.json();

    if (!requirementText) {
      return NextResponse.json(
        { error: "Requirement text is required" },
        { status: 400 }
      );
    }

    console.log(`📊 Complexity metrics: N=${n}, E=${e}, P=${p}, M=${complexityScore}`);
    console.log(`🎯 Analyzing requirement to extract meaningful test scenarios`);

    // Ask Claude to extract scenarios
    // Independent analysis: find meaningful test scenarios from requirement
    // Don't force a count - let Claude identify realistic scenarios
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `EXTRACT ALL MEANINGFUL TEST SCENARIOS FROM THIS REQUIREMENT

REQUIREMENT:
${requirementText}

COMPLEXITY METRICS (for reference only):
- Nodes (N): ${n} (decision points and states)
- Edges (E): ${e} (transitions between nodes)
- Paths (P): ${p} (distinct execution paths)
- Complexity Score (M): ${complexityScore} (M = E - N + 2P = shows how complex)

YOUR MISSION:
Analyze the requirement and extract ALL meaningful, distinct test scenarios.

Do NOT force a specific count - identify realistic scenarios:
- Each scenario represents a distinct, meaningful use case
- Different user journeys through the system
- Different success/failure paths
- Different decision outcomes
- Different operation combinations

Quality over quantity:
- Only include scenarios that represent REAL test cases
- Avoid generic/placeholder scenarios
- Each scenario must be complete with concrete details
- Steps, preconditions, and expected results must be specific

The requirement has:
- ${n} nodes (decision points, states)
- ${e} edges (transitions between nodes)
- ${p} distinct execution paths identified
- Complexity score of ${complexityScore} (shows high complexity)

Based on this complexity, identify ALL meaningful scenarios that a tester needs to execute.

STRICT QUALITY REQUIREMENTS:
✓ EVERY scenario needs AT LEAST 4 detailed, specific steps (minimum)
✓ EVERY step must reference REAL elements from the requirement (not generic placeholders)
✓ EVERY scenario must have a UNIQUE execution path (different from other scenarios)
✓ EVERY scenario must have CONCRETE preconditions, not vague ones
✓ EVERY scenario must have a MEASURABLE expected result
✓ NO empty scenarios, NO incomplete scenarios, NO padding

DISQUALIFYING PATTERNS (DO NOT USE):
✗ Generic step names like "Step 1", "Step 2", or "Scenario 1"
✗ Vague preconditions like "System ready" or "User logged in" (be specific)
✗ Scenarios with fewer than 4 steps
✗ Missing actors or preconditions
✗ Repeated scenarios with only minor variations (all 12 must be DISTINCT)
✗ Any scenario that could be deleted without changing the test coverage

EACH SCENARIO MUST HAVE:
- Scenario Name: Specific action (e.g., "Process Refund with Failed Payment Retry")
- Description: What path/variation this covers (e.g., "Handles payment failures with automatic retry logic")
- Complexity: Low/Medium/High/Very High (based on actual step count and branches)
- Actors: Specific roles (e.g., "Customer Service Agent", "Payment System")
- Preconditions: Specific to THIS scenario (e.g., "Order placed; payment processor down; retry enabled")
- Steps: MINIMUM 4 steps, each with concrete details (e.g., "Agent navigates to Order #12345 in system and clicks 'Retry Payment'")
- Expected Result: Specific outcome (e.g., "Payment successfully processed; order status changed to 'Confirmed'; customer receives SMS notification")

FORMAT STRICTLY:
---
**SCENARIO [NUMBER]: [SCENARIO NAME]**

Description: [unique aspect of this scenario]
Complexity: [Low/Medium/High/Very High]
Actors: [actor1], [actor2]
Preconditions: [specific condition 1], [specific condition 2], [specific condition 3]

Steps:
1. [concrete step with real system details]
2. [concrete step with real system details]
3. [concrete step with real system details]
4. [concrete step with real system details]
5. [if applicable, more concrete steps]

Expected Result: [specific, measurable outcome]
---

GENERATE ALL ${p} SCENARIOS NOW.
EVERY scenario must be complete and distinct.
NO skipping, NO vague scenarios, NO placeholders.`,
        },
      ],
    });

    console.log("✅ Response received from Claude");

    // Extract text from response
    let fullText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        fullText += block.text;
      }
    }

    console.log("\n📝 Claude Scenarios:\n", fullText);

    // Parse scenarios from Claude's response
    // Claude independently identifies meaningful scenarios from requirement
    let detailedScenarios = parseScenarios(fullText, p, complexityScore);

    // Calculate total scenarios needed (2P = 2 * distinct paths)
    const totalScenariosNeeded = 2 * p;

    console.log(`✅ Extracted ${detailedScenarios.length} detailed scenarios (from Claude)`);
    console.log(`📊 Total scenarios needed (2P): ${totalScenariosNeeded}`);

    // Apply distributed approach: detailed + templates
    const scenarios = distributeScenarios(detailedScenarios, totalScenariosNeeded, requirementText);

    return NextResponse.json({
      success: true,
      scenarios,
      complexity: {
        n,
        e,
        p,
        complexityScore,
      },
    });
  } catch (error) {
    console.error("❌ Error extracting scenarios:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract scenarios",
      },
      { status: 500 }
    );
  }
}

function parseScenarios(text: string, pathCount: number, complexityScore: number): Scenario[] {
  const scenarios: Scenario[] = [];

  // Split by scenario markers
  const scenarioBlocks = text.split(/(?=---\s*\*\*SCENARIO)/);

  for (let i = 0; i < scenarioBlocks.length; i++) {
    const block = scenarioBlocks[i];
    if (!block.trim()) continue;

    try {
      const scenario = parseScenarioBlock(block, i + 1, complexityScore);
      if (scenario) {
        scenarios.push(scenario);
      }
    } catch (err) {
      console.warn(`Warning parsing scenario ${i + 1}:`, err);
    }
  }

  // Return parsed scenarios (incomplete scenarios are silently filtered)
  return scenarios;
}

function parseScenarioBlock(block: string, index: number, complexityScore: number): Scenario | null {
  try {
    // Extract scenario name
    const nameMatch = block.match(/\*\*SCENARIO\s*\d+:\s*(.+?)\*\*/);
    const name = nameMatch ? nameMatch[1].trim() : `Scenario ${index}`;

    // Extract description
    const descMatch = block.match(/Description:\s*(.+?)(?=\n|$)/i);
    const description = descMatch ? descMatch[1].trim() : "";

    // Extract complexity
    const complexMatch = block.match(/Complexity:\s*(.+?)(?=\n|$)/i);
    const complexity = (complexMatch ? complexMatch[1].trim() : "Medium") as any;

    // Extract actors
    const actorMatch = block.match(/Actors:\s*(.+?)(?=\n|$)/i);
    const actors = actorMatch ? actorMatch[1].split(",").map(a => a.trim()).filter(a => a) : [];

    // Extract preconditions
    const precondMatch = block.match(/Preconditions:\s*(.+?)(?=\n|$)/i);
    const preconditions = precondMatch
      ? precondMatch[1].split(",").map(p => p.trim()).filter(p => p)
      : [];

    // Extract steps
    const stepsMatch = block.match(/Steps:\s*([\s\S]+?)(?=Expected Result:|$)/i);
    const steps = stepsMatch
      ? stepsMatch[1]
          .split("\n")
          .filter((s) => s.trim())
          .map((s) => s.replace(/^\d+\.\s*/, "").trim())
          .filter((s) => s.length > 3) // Only keep steps with meaningful content (3+ chars)
      : [];

    // Extract expected result
    const resultMatch = block.match(/Expected Result:\s*(.+?)(?=\n|$)/i);
    const expectedResult = resultMatch ? resultMatch[1].trim() : "";

    // VALIDATION: Skip scenarios with insufficient content (silent filtering)
    if (steps.length < 2) {
      return null;
    }

    // Generate test cases
    const testCases = generateTestCases(name, steps, expectedResult, complexity);

    return {
      id: index,
      name,
      description,
      complexity: normalizeComplexity(complexity),
      actors,
      preconditions,
      steps,
      expectedResult,
      testCases,
    };
  } catch (err) {
    return null;
  }
}

function normalizeComplexity(
  complexity: string
): "Low" | "Medium" | "High" | "Very High" {
  const lower = complexity.toLowerCase();
  if (lower.includes("low")) return "Low";
  if (lower.includes("very high") || lower.includes("very-high"))
    return "Very High";
  if (lower.includes("high")) return "High";
  if (lower.includes("medium")) return "Medium";
  return "Medium";
}

function generateTestCases(
  scenarioName: string,
  steps: string[],
  expectedResult: string,
  complexity: string
): TestCase[] {
  const testCases: TestCase[] = [];
  const complexityWeight =
    complexity === "Low" ? 1 : complexity === "Medium" ? 2 : 3;

  // Generate test cases based on complexity and steps
  for (let i = 0; i < complexityWeight; i++) {
    const testCase: TestCase = {
      id: `TC-${scenarioName.replace(/\s+/g, "-")}-${i + 1}`,
      name: `${scenarioName} - Path ${i + 1}`,
      steps: steps.slice(0, Math.ceil(steps.length / complexityWeight) * (i + 1)),
      expectedResult,
    };
    testCases.push(testCase);
  }

  return testCases;
}

function distributeScenarios(detailedScenarios: Scenario[], totalScenariosNeeded: number, requirementText: string): Scenario[] {
  // Distribution proportions: 20% Low, 35% Medium, 30% High, 15% Very High
  const proportions = {
    Low: 0.20,
    Medium: 0.35,
    High: 0.30,
    "Very High": 0.15,
  };

  // Count current detailed scenarios by complexity
  const currentCount = {
    Low: detailedScenarios.filter(s => s.complexity === "Low").length,
    Medium: detailedScenarios.filter(s => s.complexity === "Medium").length,
    High: detailedScenarios.filter(s => s.complexity === "High").length,
    "Very High": detailedScenarios.filter(s => s.complexity === "Very High").length,
  };

  // Calculate target count for each complexity level
  const targetCount = {
    Low: Math.round(totalScenariosNeeded * proportions.Low),
    Medium: Math.round(totalScenariosNeeded * proportions.Medium),
    High: Math.round(totalScenariosNeeded * proportions.High),
    "Very High": Math.round(totalScenariosNeeded * proportions["Very High"]),
  };

  // Identify which complexity levels need template scenarios
  const templatesNeeded = {
    Low: Math.max(0, targetCount.Low - currentCount.Low),
    Medium: Math.max(0, targetCount.Medium - currentCount.Medium),
    High: Math.max(0, targetCount.High - currentCount.High),
    "Very High": Math.max(0, targetCount["Very High"] - currentCount["Very High"]),
  };

  const totalTemplatesNeeded = Object.values(templatesNeeded).reduce((a, b) => a + b, 0);

  console.log(`📋 Distribution Plan:`);
  console.log(`   Low: ${currentCount.Low} detailed → ${targetCount.Low} total (need ${templatesNeeded.Low} templates)`);
  console.log(`   Medium: ${currentCount.Medium} detailed → ${targetCount.Medium} total (need ${templatesNeeded.Medium} templates)`);
  console.log(`   High: ${currentCount.High} detailed → ${targetCount.High} total (need ${templatesNeeded.High} templates)`);
  console.log(`   Very High: ${currentCount["Very High"]} detailed → ${targetCount["Very High"]} total (need ${templatesNeeded["Very High"]} templates)`);
  console.log(`   TOTAL: ${detailedScenarios.length} detailed + ${totalTemplatesNeeded} templates = ${totalScenariosNeeded} scenarios`);

  // Generate template scenarios
  const templateScenarios: Scenario[] = [];
  let templateId = detailedScenarios.length + 1;

  const complexityLevels: Array<"Low" | "Medium" | "High" | "Very High"> = ["Low", "Medium", "High", "Very High"];

  for (const complexity of complexityLevels) {
    for (let i = 0; i < templatesNeeded[complexity]; i++) {
      templateScenarios.push(createTemplateScenario(templateId++, complexity, requirementText));
    }
  }

  // Combine detailed and template scenarios
  let allScenarios = [...detailedScenarios, ...templateScenarios];

  // Filter out ONLY truly blank/empty scenarios (missing required content)
  allScenarios = allScenarios.filter(scenario => {
    // A scenario is blank only if it has critical missing data
    const isTrulyBlank =
      !scenario.name ||
      scenario.name.trim().length === 0 ||
      !scenario.steps ||
      scenario.steps.length < 1 ||
      !scenario.expectedResult ||
      scenario.expectedResult.trim().length === 0;

    return !isTrulyBlank;
  });

  console.log(`✅ Total scenarios created: ${allScenarios.length} (${detailedScenarios.length} detailed + ${templateScenarios.length} templates, blank scenarios filtered)`);

  return allScenarios;
}

function createTemplateScenario(id: number, complexity: "Low" | "Medium" | "High" | "Very High", requirementText: string): Scenario {
  const complexityDescriptions = {
    Low: "simple, single-path scenario",
    Medium: "standard scenario with few branches",
    High: "complex scenario with multiple paths",
    "Very High": "critical scenario with extensive branching",
  };

  const complexityWeighting = {
    Low: 1,
    Medium: 2,
    High: 3,
    "Very High": 4,
  };

  const weight = complexityWeighting[complexity];
  const desc = complexityDescriptions[complexity];

  // Extract a key term from the requirement for realistic context
  const keyTerms = requirementText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || ["Application"];
  const keyTerm = keyTerms[id % keyTerms.length] || "Application";

  const steps: string[] = [];
  for (let i = 1; i <= weight + 2; i++) {
    steps.push(`Execute step ${i} of ${keyTerm} workflow (${complexity} complexity)`);
  }

  return {
    id,
    name: `${complexity} Template Scenario #${id}`,
    description: `${desc} covering a variant execution path`,
    complexity,
    actors: ["User", "System"],
    preconditions: [
      `System initialized with required ${keyTerm} data`,
      `User has necessary permissions`,
      `Environment ready for ${complexity.toLowerCase()} complexity execution`,
    ],
    steps,
    expectedResult: `${keyTerm} processing completed successfully at ${complexity} complexity level`,
    testCases: [
      {
        id: `TC-Template-${id}-Positive`,
        name: `${complexity} Scenario #${id} - Positive Path`,
        steps: steps.slice(0, Math.ceil(steps.length / 2)),
        expectedResult: `Positive outcome verified at ${complexity} complexity`,
      },
      {
        id: `TC-Template-${id}-Negative`,
        name: `${complexity} Scenario #${id} - Negative Path`,
        steps: steps,
        expectedResult: `Error handling confirmed at ${complexity} complexity`,
      },
    ],
    isTemplate: true,
  };
}

function createPlaceholderScenario(index: number): Scenario {
  return {
    id: index,
    name: `Scenario ${index}`,
    description: `Scenario ${index} of the workflow`,
    complexity: "Medium",
    actors: ["User"],
    preconditions: ["System ready"],
    steps: [`Step 1 for scenario ${index}`, `Step 2 for scenario ${index}`],
    expectedResult: `Expected outcome for scenario ${index}`,
    testCases: [
      {
        id: `TC-Scenario-${index}-1`,
        name: `Test Case 1 for Scenario ${index}`,
        steps: [`Step 1 for scenario ${index}`],
        expectedResult: `Expected outcome for scenario ${index}`,
      },
    ],
  };
}
