import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 Generating comprehensive Excel export with all scenarios...");

    const { scenarios, requirementTitle, requirementText, complexity } = await request.json();

    if (!scenarios || !Array.isArray(scenarios)) {
      return NextResponse.json(
        { error: "Scenarios data is required" },
        { status: 400 }
      );
    }

    // Include all scenarios (both detailed and templates)
    const validScenarios = scenarios.filter((s: any) =>
      s.name && s.name.trim() !== "" &&
      s.testCases && s.testCases.length > 0
    );

    // Separate detailed vs template scenarios
    const detailedScenarios = validScenarios.filter((s: any) => !s.isTemplate);
    const templateScenarios = validScenarios.filter((s: any) => s.isTemplate);

    // Calculate complexity score using McCabe's formula: M = E - N + 2P
    const realComplexityScore = complexity.e - complexity.n + 2 * complexity.p;

    // Create CSV content (Excel compatible)
    let csvContent = "";

    // Header section
    csvContent += `COMPLEXITY ANALYSIS - TEST SCENARIO & TEST CASES REPORT\n`;
    csvContent += `\n`;
    csvContent += `REQUIREMENT DETAILS\n`;
    csvContent += `Title,${requirementTitle || "Unnamed Requirement"}\n`;
    if (requirementText) {
      csvContent += `Description,"${requirementText.substring(0, 500).replace(/"/g, '""')}"\n`;
    }
    csvContent += `Generated,${new Date().toISOString()}\n`;
    csvContent += `\n`;

    // Summary metrics
    if (complexity) {
      csvContent += `OVERALL COMPLEXITY METRICS\n`;
      csvContent += `Nodes (N),${complexity.n}\n`;
      csvContent += `Edges (E),${complexity.e}\n`;
      csvContent += `Connected Components (P),${complexity.p}\n`;
      csvContent += `Complexity Score (M),${realComplexityScore}\n`;
      csvContent += `Formula,"M = E - N + 2P = ${complexity.e} - ${complexity.n} + 2(${complexity.p}) = ${realComplexityScore}"\n`;
      csvContent += `\n`;
      csvContent += `INTERPRETATION\n`;
      csvContent += `Complexity Level,${realComplexityScore <= 10 ? "Low" : realComplexityScore <= 30 ? "Medium" : realComplexityScore <= 100 ? "High" : "Very High"}\n`;
      csvContent += `Total Test Scenarios (2P),${2 * complexity.p}\n`;
      csvContent += `\n`;
    }

    csvContent += `TEST SCENARIOS & TEST CASES\n`;
    csvContent += `\n`;
    csvContent += `SECTION 1: DETAILED SCENARIOS (${detailedScenarios.length} scenarios with full specification)\n`;
    csvContent += `================================================================================\n`;
    csvContent += `\n`;

    // Hierarchical structure: Scenario → Preconditions → Test Cases → Steps → Expected Results
    detailedScenarios.forEach((scenario: any, scenarioIdx: number) => {
      const preconditions = scenario.preconditions.join(" | ");
      const scenarioComplexityValue = scenario.complexity === "Low" ? 1 :
                                       scenario.complexity === "Medium" ? 2 :
                                       scenario.complexity === "High" ? 3 : 4;

      // === SCENARIO HEADER ===
      if (scenarioIdx > 0) csvContent += `\n`; // Only add newline before subsequent scenarios
      csvContent += `================================================================================\n`;
      csvContent += `SCENARIO #${scenarioIdx + 1}: ${scenario.name}\n`;
      csvContent += `================================================================================\n`;
      csvContent += `Complexity Level: ${scenario.complexity}\n`;
      csvContent += `Description: ${scenario.description || "N/A"}\n`;
      csvContent += `Preconditions: "${preconditions.replace(/"/g, '""')}"\n`;
      csvContent += `\n`;

      // TEST CASES FOR THIS SCENARIO
      if (scenario.testCases && Array.isArray(scenario.testCases) && scenario.testCases.length > 0) {
        csvContent += `TEST CASES FOR THIS SCENARIO:\n`;
        csvContent += `\n`;

        scenario.testCases.forEach((tc: any, tcIdx: number) => {
          const stepCount = tc.steps.length || 1;
          const testCaseComplexity = stepCount * scenarioComplexityValue;
          const cleanTestCaseName = tc.name.replace(/\s*-\s*Path\s*\d+\s*$/, "");

          // Test case header
          csvContent += `--- Test Case #${tcIdx + 1}: ${cleanTestCaseName} ---\n`;
          csvContent += `Preconditions: "${preconditions.replace(/"/g, '""')}"\n`;

          // Numbered steps
          if (tc.steps && tc.steps.length > 0) {
            csvContent += `Steps:\n`;
            tc.steps.forEach((step: string, stepIdx: number) => {
              csvContent += `  ${stepIdx + 1}. ${step.replace(/"/g, '""')}\n`;
            });
          }

          // Expected result
          csvContent += `Expected Result: "${tc.expectedResult.replace(/"/g, '""')}"\n`;
          csvContent += `Complexity Score: ${testCaseComplexity} (${stepCount} steps × ${scenarioComplexityValue}x ${scenario.complexity})\n`;
          csvContent += `\n`;
        });
      }

      // Blank line between scenarios
      csvContent += `\n`;
    });

    // Template scenarios section
    if (templateScenarios.length > 0) {
      csvContent += `\n`;
      csvContent += `================================================================================\n`;
      csvContent += `SECTION 2: TEMPLATE SCENARIOS (${templateScenarios.length} scenarios - distributed across complexity levels)\n`;
      csvContent += `================================================================================\n`;
      csvContent += `\n`;
      csvContent += `These template scenarios represent the remaining execution paths not fully detailed above.\n`;
      csvContent += `They are organized by complexity level to match the expected distribution (20% Low, 35% Medium, 30% High, 15% Very High).\n`;
      csvContent += `Each template can be expanded with specific test data and steps as needed during test execution.\n`;
      csvContent += `\n`;

      templateScenarios.forEach((scenario: any, scenarioIdx: number) => {
        const preconditions = scenario.preconditions.join(" | ");

        csvContent += `--- Template Scenario #${scenarioIdx + 1}: ${scenario.name} ---\n`;
        csvContent += `Complexity Level: ${scenario.complexity}\n`;
        csvContent += `Description: ${scenario.description}\n`;
        csvContent += `Preconditions: "${preconditions.replace(/"/g, '""')}"\n`;
        csvContent += `Actors: ${scenario.actors.join(", ")}\n`;
        csvContent += `Expected Result: "${scenario.expectedResult.replace(/"/g, '""')}"\n`;
        csvContent += `\n`;

        if (scenario.testCases && scenario.testCases.length > 0) {
          scenario.testCases.forEach((tc: any, tcIdx: number) => {
            csvContent += `  Test Case #${tcIdx + 1}: ${tc.name}\n`;
            csvContent += `  Steps: ${tc.steps.length} steps\n`;
            csvContent += `  Expected: ${tc.expectedResult}\n`;
            csvContent += `\n`;
          });
        }
      });
    }

    // Complexity calculation guide
    csvContent += `HOW COMPLEXITY IS CALCULATED\n`;
    csvContent += `Scenario Complexity Level,Multiplier\n`;
    csvContent += `Low,1x\n`;
    csvContent += `Medium,2x\n`;
    csvContent += `High,3x\n`;
    csvContent += `Very High,4x\n`;
    csvContent += `\n`;
    csvContent += `Test Case Complexity = Number of Steps × Scenario Complexity Multiplier\n`;
    csvContent += `Example: 5-step test case in Medium complexity scenario = 5 × 2 = Complexity Score of 10\n`;

    // Convert to Buffer
    const buffer = Buffer.from(csvContent, "utf-8");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="test-scenarios-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("❌ Error generating Excel:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate Excel",
      },
      { status: 500 }
    );
  }
}
