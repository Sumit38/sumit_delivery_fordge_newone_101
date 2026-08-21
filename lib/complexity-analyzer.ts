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
  reasoning?: string; // Detailed step-by-step reasoning from Claude
  confidenceScore?: number; // 0-100 confidence in the analysis
  confidenceReason?: string; // Why we're confident or not
}

export async function analyzeRequirementComplexity(
  requirementText: string
): Promise<ComplexityAnalysis> {
  try {
    console.log("🔍 Analyzing requirement with cyclomatic complexity formula...");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 12000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Use McCabe's formula M = E - N + 2P to analyze this requirement. Be thorough and explicit.

REQUIREMENT:
${requirementText}

STEP-BY-STEP INSTRUCTIONS:

1. IDENTIFY ALL NODES (states/decision points):
   - List Start node
   - List each state, decision point, process step, or condition check
   - List End node
   - For each node, briefly explain why it's a node

2. IDENTIFY ALL EDGES (transitions/flows):
   - For each transition between nodes, describe the condition/trigger
   - Include success paths, failure paths, error handling, retries, loops
   - For each edge, explain what triggers this transition

3. TRACE ALL DISTINCT PATHS:
   - List every unique route from Start to End
   - Consider: happy path, error cases, edge cases, retry logic, alternative flows
   - For each path, list the nodes in order

4. REASONING & VALIDATION:
   - Are there any loops or cycles? If yes, explain how they affect paths
   - Are there parallel flows or conditional branches?
   - Did you consider error handling and edge cases?

Output in this format:

REASONING:
[Detailed explanation of how you identified nodes, edges, and paths. Include any assumptions or complexities found.]

NODES:
- Start
- [list each node with brief description]
- End

EDGES:
- Start -> [node] (condition/trigger)
- [list all edges with conditions]

PATHS:
- Path 1: [Start -> ... -> End]
- Path 2: [Start -> ... -> End]
- [list all distinct paths]

CALCULATION:
N = [number] (nodes count including Start and End)
E = [number] (edges count)
P = [number] (distinct paths count)
M = E - N + 2P = [number]`,
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

    // Parse nodes - try structured format first, then fallback to scanning for node-like content
    let nodesList: string[] = [];
    const nodesMatch = fullText.match(/NODES:\s*([\s\S]*?)(?=EDGES:|$)/i);
    if (nodesMatch) {
      nodesList = nodesMatch[1]
        .split("\n")
        .map((line) => line.replace(/^[-•]\s*/, "").trim())
        .filter((line) => line.length > 0 && !line.includes("->"));
      console.log("✅ Nodes parsed from structured format:", nodesList.length);
    }

    // Parse edges - try structured format first
    let edgesList: Array<{ from: string; to: string; condition?: string }> = [];
    const edgesMatch = fullText.match(/EDGES:\s*([\s\S]*?)(?=PATHS:|$)/i);
    if (edgesMatch) {
      const edgeLines = edgesMatch[1].split("\n");
      edgeLines.forEach((line) => {
        const cleaned = line.replace(/^[-•]\s*/, "").trim();
        const edgeRegex = /^(.*?)\s*->\s*(.+?)(?:\s*\((.+?)\))?$/;
        const match = cleaned.match(edgeRegex);
        if (match) {
          edgesList.push({
            from: match[1].trim(),
            to: match[2].trim(),
            condition: match[3]?.trim(),
          });
        }
      });
      console.log("✅ Edges parsed from structured format:", edgesList.length);
    }

    // Parse paths
    let pathsList: string[][] = [];
    const pathsMatch = fullText.match(/PATHS:\s*([\s\S]*?)(?=CALCULATION:|$)/i);
    if (pathsMatch) {
      const pathLines = pathsMatch[1].split("\n");
      pathLines.forEach((line) => {
        const cleaned = line.replace(/^[-•]\s*/, "").trim();
        if (cleaned.length > 0 && !cleaned.startsWith("CALCULATION")) {
          const path = cleaned.split("->").map((p) => p.trim()).filter((p) => p.length > 0);
          if (path.length > 0) {
            pathsList.push(path);
          }
        }
      });
      console.log("✅ Paths parsed from structured format:", pathsList.length);
    }

    // Aggressive extraction - try many formats
    const extractNumber = (pattern: RegExp) => {
      const match = fullText.match(pattern);
      return match ? parseInt(match[1]) : null;
    };

    // Extract N - try multiple formats
    let n = extractNumber(/^N\s*[:=]\s*(\d+)/im);
    if (n === null) n = extractNumber(/N\s*[:=]\s*(\d+)/);
    if (n === null) n = nodesList.length || extractNumber(/Nodes?.*?(\d+)/i);

    // Extract E - try multiple formats
    let e = extractNumber(/^E\s*[:=]\s*(\d+)/im);
    if (e === null) e = extractNumber(/E\s*[:=]\s*(\d+)/);
    if (e === null) e = edgesList.length || extractNumber(/Edges?.*?(\d+)/i);

    // Extract P - try multiple formats
    let p = extractNumber(/^P\s*[:=]\s*(\d+)/im);
    if (p === null) p = extractNumber(/P\s*[:=]\s*(\d+)/);
    if (p === null) p = pathsList.length || extractNumber(/Paths?.*?(\d+)/i);

    // Extract M - try multiple formats
    let m = extractNumber(/^M\s*[:=]\s*(\d+)/im);
    if (m === null) m = extractNumber(/M\s*[:=]\s*(\d+)/);
    if (m === null) m = extractNumber(/Complexity.*?(\d+)/i);

    // Validate extraction
    if (n === null || e === null || p === null || m === null) {
      console.log("⚠️ Could not extract values. Found:");
      console.log(`  N: ${n}, E: ${e}, P: ${p}, M: ${m}`);
      console.log("\n📋 Full Claude response:");
      console.log(fullText);
      return createFallbackAnalysis();
    }


    const testScenarios = 2 * p;

    // Extract reasoning from REASONING section
    let reasoning = "";
    const reasoningMatch = fullText.match(/REASONING:\s*([\s\S]*?)(?=NODES:|$)/i);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
    }

    // Calculate confidence score based on multiple validation factors
    const confidenceData = calculateConfidenceScore(n, e, p, nodesList, edgesList, pathsList, reasoning);

    console.log("\n🧮 FORMULA CALCULATION (McCabe Cyclomatic Complexity):");
    console.log(`   N (Nodes) = ${n}`);
    console.log(`   E (Edges) = ${e}`);
    console.log(`   P (Distinct Paths) = ${p}`);
    console.log(`   M = E - N + 2P`);
    console.log(`   M = ${e} - ${n} + 2(${p})`);
    console.log(`   M = ${m}`);
    console.log(`\n✅ COMPLEXITY SCORE (M): ${m}`);
    console.log(`✅ TEST SCENARIOS REQUIRED (2P): ${testScenarios}`);
    console.log(`\n📊 CONFIDENCE SCORE: ${confidenceData.score}% - ${confidenceData.reason}\n`);

    return {
      nodes: nodesList,
      edges: edgesList,
      paths: pathsList,
      nodesCount: n,
      edgesCount: e,
      connectedComponents: p,
      complexityScore: m,
      testScenarios: testScenarios,
      analysis: `N=${n}, E=${e}, P=${p} → M = ${e} - ${n} + 2(${p}) = ${m}`,
      decisionPoints: nodesList.filter(
        (node) => node.toLowerCase().includes("decision") || node.toLowerCase().includes("check")
      ),
      alternativePaths: p,
      reasoning: reasoning,
      confidenceScore: confidenceData.score,
      confidenceReason: confidenceData.reason,
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

function calculateConfidenceScore(
  n: number,
  e: number,
  p: number,
  nodes: string[],
  edges: Array<{ from: string; to: string; condition?: string }>,
  paths: string[][],
  reasoning: string
): { score: number; reason: string } {
  let score = 85; // Start with baseline high confidence
  let reasons: string[] = [];

  // Check 1: Graph structure validity (E >= N for connected graphs)
  if (e < n - 1) {
    score -= 15;
    reasons.push("Graph may be disconnected");
  } else if (e >= n) {
    reasons.push("Well-formed graph structure");
  }

  // Check 2: Path count sanity check
  const maxPossiblePaths = Math.pow(2, Math.min(n - 2, 10)); // Cap at 2^10 for calculation
  if (p > maxPossiblePaths) {
    score -= 10;
    reasons.push("Path count seems high");
  }

  // Check 3: Minimal complexity check
  if (n <= 3 && e <= 2 && p === 1) {
    score -= 5;
    reasons.push("Very simple requirement");
  }

  // Check 4: Complex requirement check
  if (n > 20 || p > 10) {
    score -= 10;
    reasons.push("High complexity - manual review recommended");
  }

  // Check 5: Data extraction quality
  if (nodes.length === 0 || edges.length === 0) {
    score -= 20;
    reasons.push("Incomplete node or edge extraction");
  } else if (nodes.length < n || edges.length < e) {
    score -= 5;
    reasons.push("Some nodes/edges may be missing");
  }

  // Check 6: Reasoning quality
  if (!reasoning || reasoning.length < 50) {
    score -= 10;
    reasons.push("Limited reasoning provided");
  } else if (reasoning.includes("loop") || reasoning.includes("parallel") || reasoning.includes("error")) {
    reasons.push("Complex flows identified");
  }

  // Check 7: Path validation
  if (paths.length === 0) {
    score -= 15;
    reasons.push("No paths extracted");
  } else if (paths.length < p) {
    score -= 5;
    reasons.push("Some paths may be missing");
  }

  // Ensure score stays in valid range
  score = Math.max(0, Math.min(100, score));

  // Build confidence reason
  let finalReason = "";
  if (score >= 80) {
    finalReason = "High confidence - detailed analysis completed";
  } else if (score >= 60) {
    finalReason = "Moderate confidence - some complexity noted";
  } else if (score >= 40) {
    finalReason = "Lower confidence - manual review recommended";
  } else {
    finalReason = "Low confidence - requires manual verification";
  }

  if (reasons.length > 0) {
    finalReason += ` (${reasons.slice(0, 2).join(", ")})`;
  }

  return { score, reason: finalReason };
}

export function getComplexityLevel(
  complexity: number
): "Low" | "Medium" | "High" | "Very High" {
  if (complexity <= 5) return "Low";
  if (complexity <= 15) return "Medium";
  if (complexity <= 30) return "High";
  return "Very High";
}
