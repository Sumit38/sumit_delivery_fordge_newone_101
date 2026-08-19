import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ComplexityAnalysis {
  nodes: string[];
  edges: Array<{ from: string; to: string; condition?: string }>;
  paths: string[][];
  nodesCount: number;
  edgesCount: number;
  connectedComponents: number;
  complexityScore: number;
  testScenarios: number;
  analysis: string;
  decisionPoints: string[];
  alternativePaths: number;
}

export async function analyzeRequirementComplexity(
  requirementText: string
): Promise<ComplexityAnalysis> {
  try {
    console.log("🔍 Analyzing requirement with cyclomatic complexity formula...");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 5000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Analyze this requirement using McCabe's Cyclomatic Complexity formula: M = E - N + 2P

Requirement:
${requirementText}

INSTRUCTIONS:
1. Count N (Nodes): Every state, decision point, operation, and endpoint. Include Start and End.
2. Count E (Edges): Every transition between states. Include success, failure, and retry paths.
3. Count P (Distinct Paths): Every unique execution route from Start to End. Count all combinations of:
   - Different decision branches (yes/no at each choice)
   - Loop variants (fail once vs fail twice vs fail 3x)
   - Operation sequences (order matters)
   - Error scenarios with retries
4. Calculate M = E - N + 2P

RESPOND WITH ONLY THIS FORMAT - NOTHING ELSE:

N = [count]
E = [count]
P = [count]
M = [count]

That's it. No explanation, no paths, no analysis text. Just the four numbers.`,
        },
      ],
    });

    console.log("✅ Response received from Claude");

    // Extract text from response
    let fullText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        fullText += block.text + "\n";
      }
    }

    console.log("\n📝 Claude Analysis:\n", fullText);

    // Extract N, E, P, M - try multiple patterns for robustness
    let nMatch = fullText.match(/N\s*=\s*(\d+)/);
    let eMatch = fullText.match(/E\s*=\s*(\d+)/);
    let pMatch = fullText.match(/P\s*=\s*(\d+)/);
    let mMatch = fullText.match(/M\s*=\s*(\d+)/);

    // Try extracting from FINAL ANSWER section if standard patterns fail
    if (!nMatch) nMatch = fullText.match(/===== FINAL ANSWER[\s\S]*?N\s*=\s*(\d+)/);
    if (!eMatch) eMatch = fullText.match(/===== FINAL ANSWER[\s\S]*?E\s*=\s*(\d+)/);
    if (!pMatch) pMatch = fullText.match(/===== FINAL ANSWER[\s\S]*?P\s*=\s*(\d+)/);
    if (!mMatch) mMatch = fullText.match(/===== FINAL ANSWER[\s\S]*?M\s*=\s*(\d+)/);

    // Try alternative formats with asterisks or bold markdown
    if (!nMatch) nMatch = fullText.match(/\*\*N\s*=\s*(\d+)\*\*/);
    if (!eMatch) eMatch = fullText.match(/\*\*E\s*=\s*(\d+)\*\*/);
    if (!pMatch) pMatch = fullText.match(/\*\*P\s*=\s*(\d+)\*\*/);
    if (!mMatch) mMatch = fullText.match(/\*\*M\s*=\s*(\d+)\*\*/);

    if (!nMatch || !eMatch || !pMatch || !mMatch) {
      console.log(
        "⚠️ Could not extract N, E, P, M. Using fallback analysis."
      );
      console.log("Expected format: N = X, E = X, P = X, M = X");
      console.log("\n🔍 What we found:");
      console.log(`  N Match: ${nMatch ? nMatch[1] : "NOT FOUND"}`);
      console.log(`  E Match: ${eMatch ? eMatch[1] : "NOT FOUND"}`);
      console.log(`  P Match: ${pMatch ? pMatch[1] : "NOT FOUND"}`);
      console.log(`  M Match: ${mMatch ? mMatch[1] : "NOT FOUND"}`);
      console.log("\n📋 Claude response last 500 chars:");
      console.log(fullText.slice(-500));
      return createFallbackAnalysis();
    }

    const n = parseInt(nMatch[1]);
    const e = parseInt(eMatch[1]);
    const p = parseInt(pMatch[1]);
    const m = parseInt(mMatch[1]);
    const testScenarios = 2 * p;

    console.log("\n🧮 FORMULA CALCULATION (McCabe Cyclomatic Complexity):");
    console.log(`   N (Nodes) = ${n}`);
    console.log(`   E (Edges) = ${e}`);
    console.log(`   P (Distinct Paths) = ${p}`);
    console.log(`   M = E - N + 2P`);
    console.log(`   M = ${e} - ${n} + 2(${p})`);
    console.log(`   M = ${m}`);
    console.log(`\n✅ COMPLEXITY SCORE (M): ${m}`);
    console.log(`✅ TEST SCENARIOS REQUIRED (2P): ${testScenarios}\n`);

    return {
      nodes: [],
      edges: [],
      paths: [],
      nodesCount: n,
      edgesCount: e,
      connectedComponents: p,
      complexityScore: m,
      testScenarios: testScenarios,
      analysis: `N=${n}, E=${e}, P=${p} → M = ${e} - ${n} + 2(${p}) = ${m}`,
      decisionPoints: [],
      alternativePaths: p,
    };
  } catch (error) {
    console.error("❌ Error in complexity analysis:", error);
    return createFallbackAnalysis();
  }
}

function createFallbackAnalysis(): ComplexityAnalysis {
  console.log("⚠️ Using fallback analysis");
  return {
    nodes: [],
    edges: [],
    paths: [],
    nodesCount: 0,
    edgesCount: 0,
    connectedComponents: 0,
    complexityScore: 5,
    testScenarios: 5,
    analysis: "Fallback analysis - unable to calculate",
    decisionPoints: [],
    alternativePaths: 5,
  };
}

export function getComplexityLevel(
  complexity: number
): "Low" | "Medium" | "High" | "Very High" {
  if (complexity <= 5) return "Low";
  if (complexity <= 15) return "Medium";
  if (complexity <= 30) return "High";
  return "Very High";
}
