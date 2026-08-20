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
      max_tokens: 8000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Use McCabe's formula M = E - N + 2P to analyze this requirement:

${requirementText}

First, identify all nodes and edges, then calculate:
- N = Nodes (states, decisions, Start, End)
- E = Edges (all transitions, success/failure/retry paths)
- P = Distinct paths (all unique routes from Start to End)
- M = E - N + 2P

Output in this format:
NODES:
- Start
- [list each node/state]
- End

EDGES:
- Start -> [node1] (condition if any)
- [list each edge with from -> to]

PATHS:
- [list path 1]
- [list path 2]
- [list each distinct path]

CALCULATION:
N = [number]
E = [number]
P = [number]
M = [number]`,
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

    // Parse nodes
    const nodesMatch = fullText.match(/NODES:\s*([\s\S]*?)(?=EDGES:|$)/i);
    const nodesList = nodesMatch
      ? nodesMatch[1]
          .split("\n")
          .map((line) => line.replace(/^[-•]\s*/, "").trim())
          .filter((line) => line.length > 0)
      : [];

    // Parse edges
    const edgesMatch = fullText.match(/EDGES:\s*([\s\S]*?)(?=PATHS:|$)/i);
    const edgesList: Array<{ from: string; to: string; condition?: string }> = [];
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
    }

    // Parse paths
    const pathsMatch = fullText.match(/PATHS:\s*([\s\S]*?)(?=CALCULATION:|$)/i);
    const pathsList: string[][] = [];
    if (pathsMatch) {
      const pathLines = pathsMatch[1].split("\n");
      pathLines.forEach((line) => {
        const cleaned = line.replace(/^[-•]\s*/, "").trim();
        if (cleaned.length > 0) {
          pathsList.push(cleaned.split("->").map((p) => p.trim()));
        }
      });
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
