import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface QuestionMetadata {
  questionNumber: number;
  question: string;
  answer: string;
  isAnswered: boolean; // false if skipped
}

export interface AnalyzedScenarios {
  analysisPath: "guided" | "hybrid" | "direct";
  totalQuestions?: number;
  answeredQuestions?: number;
  inferredQuestions?: number;
  skippedQuestions?: number;
  coveragePercentage?: number;
  factsContribution?: number;
  inferenceContribution?: number;
  questionsAnalyzed?: QuestionMetadata[];
  questionsInferred?: Array<{
    questionNumber: number;
    description: string;
    keywords?: string;
  }>;
  requirementDetail?: string;
  note?: string;
  warning?: string;
}

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
  reasoning?: string;
  confidenceScore?: number;
  confidenceReason?: string;
  analyzedScenarios?: AnalyzedScenarios;
}

// Inference rules: Map keywords to likely question numbers
const inferenceRules: { [key: number]: { keywords: string[]; description: string } } = {
  2: { keywords: ['concurrent', 'simultaneous', 'parallel', 'users'], description: 'Multiple concurrent users' },
  3: { keywords: ['permission', 'role', 'access', 'authorize', 'security'], description: 'Role-based access' },
  4: { keywords: ['error', 'retry', 'fallback', 'exception', 'failure', 'handle'], description: 'Error handling' },
  6: { keywords: ['validate', 'check', 'verify', 'validation', 'quality', 'sanitize'], description: 'Data validation' },
  7: { keywords: ['approval', 'review', 'authorize', 'reject', 'accept', 'workflow'], description: 'Approval workflow' },
  8: { keywords: ['duplicate', 'same location', 'reschedule', 'recheck'], description: 'Duplicate handling' },
  9: { keywords: ['edit', 'delete', 'modify', 'change', 'remove', 'update'], description: 'Edit/delete capability' },
  10: { keywords: ['report', 'export', 'visualization', 'dashboard', 'analytics', 'chart'], description: 'Reports/visualizations' },
  11: { keywords: ['multiple language', 'localization', 'translation', 'regional', 'i18n'], description: 'Multi-language support' },
  12: { keywords: ['integration', 'sync', 'connect', 'api', 'external', 'erp', 'bi'], description: 'System integration' },
  13: { keywords: ['historical', 'archive', 'retention', 'storage', 'tiered', 'backup'], description: 'Data retention' },
  14: { keywords: ['offline', 'sync', 'cache', 'queue', 'connectivity'], description: 'Offline capability' },
  15: { keywords: ['mobile', 'app', 'progressive', 'pwa', 'push notification'], description: 'Mobile support' },
};

function inferQuestionsFromRequirement(
  requirementText: string,
  answeredQuestions: QuestionMetadata[]
): QuestionMetadata[] {
  const requirementLower = requirementText.toLowerCase();
  const answeredQNumbers = new Set(answeredQuestions.map(q => q.questionNumber));
  const inferred: QuestionMetadata[] = [];

  // Check each inference rule
  Object.entries(inferenceRules).forEach(([qNum, rule]) => {
    const questionNumber = parseInt(qNum);

    // Skip if already answered
    if (answeredQNumbers.has(questionNumber)) return;

    // Check if keywords match
    const matchCount = rule.keywords.filter(keyword =>
      requirementLower.includes(keyword)
    ).length;

    // If 2+ keywords match, consider it inferred
    if (matchCount >= 2) {
      inferred.push({
        questionNumber,
        question: rule.description,
        answer: `(Inferred from requirement text - ${matchCount} keyword matches)`,
        isAnswered: true, // Treat as analyzed for extraction
      });
    }
  });

  return inferred;
}

export async function analyzeRequirementComplexity(
  requirementText: string,
  questionsMetadata?: QuestionMetadata[]
): Promise<ComplexityAnalysis> {
  try {
    console.log("🔍 Analyzing requirement with cyclomatic complexity formula...");

    // Calculate question coverage
    const totalQuestions = 15;
    const answeredQuestions = questionsMetadata?.filter(q => q.isAnswered) || [];
    const answeredCount = answeredQuestions.length;

    // HYBRID APPROACH: Infer unanswered questions from requirement text
    let inferredQuestions: QuestionMetadata[] = [];
    let analysispath: "guided" | "hybrid" | "direct" = "direct";

    if (answeredCount > 0 && answeredCount < 8) {
      // HYBRID PATH: User answered some but not all
      analysispath = "hybrid";
      inferredQuestions = inferQuestionsFromRequirement(requirementText, answeredQuestions);
      console.log(`\n🧠 HYBRID PATH: ${answeredCount} answered + ${inferredQuestions.length} inferred`);
    } else if (answeredCount >= 8) {
      // GUIDED PATH: User answered most questions
      analysispath = "guided";
      console.log(`\n📝 GUIDED PATH: ${answeredCount} questions answered`);
    } else {
      // DIRECT PATH: No questions answered
      analysispath = "direct";
      console.log(`\n🚀 DIRECT PATH: No questions provided, analyzing requirement text`);
    }

    // Combine answered + inferred for analysis
    const allAnalyzedQuestions = [...answeredQuestions, ...inferredQuestions];
    const totalAnalyzed = allAnalyzedQuestions.length;
    const coveragePercentage = Math.round((totalAnalyzed / totalQuestions) * 100);

    console.log(`📊 Coverage: ${answeredCount} answered + ${inferredQuestions.length} inferred = ${totalAnalyzed}/${totalQuestions} (${coveragePercentage}%)`);

    if (allAnalyzedQuestions.length > 0) {
      allAnalyzedQuestions.forEach(q => {
        const type = inferredQuestions.some(iq => iq.questionNumber === q.questionNumber) ? 'INFERRED' : 'ANSWERED';
        console.log(`   Q${q.questionNumber}: ✓ ${type} - "${q.question}"`);
      });
    }

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

${allAnalyzedQuestions.length > 0 ? `
ANALYZED SCENARIOS (Answered + Intelligently Inferred):
${allAnalyzedQuestions
  .map(q => {
    const isInferred = inferredQuestions.some(iq => iq.questionNumber === q.questionNumber);
    return `- Q${q.questionNumber} ${isInferred ? '[INFERRED]' : '[ANSWERED]'}: ${q.question}\n  ${isInferred ? 'Inference: ' : 'Answer: '}${q.answer}`;
  })
  .join('\n')}

SKIPPED SCENARIOS (NOT analyzed - DO NOT EXTRACT PATHS FOR THESE):
${questionsMetadata
  ?.filter(q => !q.isAnswered && !inferredQuestions.some(iq => iq.questionNumber === q.questionNumber))
  .map(q => `- Q${q.questionNumber}: ${q.question}`)
  .join('\n') || 'None'}

CRITICAL INSTRUCTION: Extract nodes, edges, and paths ONLY for the analyzed scenarios above.
For INFERRED scenarios, extract based on context. Do NOT guess or hallucinate paths for
truly skipped questions. The complexity must reflect only the analyzed scenarios.
` : ''}

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

    // Validate extraction - be strict about this
    console.log("📊 Extraction Results:");
    console.log(`   N: ${n}, E: ${e}, P: ${p}, M: ${m}`);
    console.log(`   Nodes extracted: ${nodesList.length}`);
    console.log(`   Edges extracted: ${edgesList.length}`);
    console.log(`   Paths extracted: ${pathsList.length}`);

    if (n === null || e === null || p === null || m === null) {
      console.error("❌ CRITICAL: Could not extract N, E, P, or M values!");
      console.error(`  N: ${n}, E: ${e}, P: ${p}, M: ${m}`);
      console.error("\n📋 Full Claude response:");
      console.error(fullText);
      return createFallbackAnalysis();
    }

    // CRITICAL: Validate graph structure (E >= N-1 for connected graph)
    // If invalid, it's likely hallucination or incomplete analysis
    if (e < n - 1) {
      console.error(`❌ CRITICAL: Invalid graph structure detected!`);
      console.error(`   E(${e}) < N-1(${n-1}). Graph is disconnected.`);
      console.error(`   This indicates incomplete/hallucinated analysis.`);
      console.error(`   Nodes: ${nodesList.length} extracted vs ${n} stated`);
      console.error(`   Edges: ${edgesList.length} extracted vs ${e} stated`);
      console.error(`   Paths: ${pathsList.length} extracted vs ${p} stated`);
      return createFallbackAnalysis();
    }

    // CRITICAL: Check if extracted data matches stated counts (99% minimum required)
    if (nodesList.length < n * 0.99 || edgesList.length < e * 0.99 || pathsList.length < p * 0.99) {
      console.error(`❌ CRITICAL: Extracted data INCOMPLETE (99% minimum required)!`);
      console.error(`   Nodes: extracted ${nodesList.length} vs stated ${n} (${((nodesList.length/n)*100).toFixed(1)}%) ${nodesList.length < n * 0.99 ? '❌ FAIL' : '✓'}`);
      console.error(`   Edges: extracted ${edgesList.length} vs stated ${e} (${((edgesList.length/e)*100).toFixed(1)}%) ${edgesList.length < e * 0.99 ? '❌ FAIL' : '✓'}`);
      console.error(`   Paths: extracted ${pathsList.length} vs stated ${p} (${((pathsList.length/p)*100).toFixed(1)}%) ${pathsList.length < p * 0.99 ? '❌ FAIL' : '✓'}`);
      console.error(`   Analysis is INCOMPLETE - Claude must extract ALL nodes/edges/paths!`);
    }

    // Validate M calculation: should be M = E - N + 2P
    const calculatedM = e - n + 2 * p;
    if (calculatedM < 0) {
      console.error(`❌ CRITICAL: Negative complexity detected: M = ${calculatedM}. Invalid analysis.`);
      return createFallbackAnalysis();
    }

    // Warn if calculated M doesn't match extracted M
    if (m !== calculatedM) {
      console.warn(`⚠️ M value mismatch: Claude said ${m}, but formula gives ${calculatedM}`);
      console.warn(`   Using calculated value: ${calculatedM}`);
      m = calculatedM;
    }


    const testScenarios = 2 * p;

    // Extract reasoning from REASONING section
    let reasoning = "";
    const reasoningMatch = fullText.match(/REASONING:\s*([\s\S]*?)(?=NODES:|$)/i);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
    }

    // THREE-PATH CONFIDENCE SYSTEM (NO BIAS, INTELLIGENT)
    let confidenceData: { score: number; reason: string; analysispath?: string };

    if (analysispath === "guided") {
      // PATH 1: GUIDED (User answered 8-15 questions)
      // Confidence = (Answered / 15) × 100
      confidenceData = {
        score: coveragePercentage,
        reason: `${answeredCount}/15 questions answered (${coveragePercentage}% coverage) - GUIDED PATH`,
        analysispath: "guided"
      };
      console.log(`\n📊 PATH 1 (GUIDED): Pure facts from ${answeredCount}/15 questions`);

    } else if (analysispath === "hybrid") {
      // PATH 2: HYBRID (User answered 2-7 questions + intelligent inference)
      // Confidence = (Answered + Inferred) / 15 × 100
      const hybridConfidence = coveragePercentage;
      const factsPercentage = Math.round((answeredCount / totalQuestions) * 100);
      const inferencePercentage = Math.round((inferredQuestions.length / totalQuestions) * 100);

      confidenceData = {
        score: hybridConfidence,
        reason: `${answeredCount}/15 answered (${factsPercentage}%) + ${inferredQuestions.length}/15 inferred (${inferencePercentage}%) = ${hybridConfidence}% - HYBRID PATH`,
        analysispath: "hybrid"
      };
      console.log(`\n📊 PATH 2 (HYBRID): ${answeredCount} facts + ${inferredQuestions.length} inferred = ${totalAnalyzed} total`);

    } else {
      // PATH 3: DIRECT (User skipped all questions, analyzing raw requirement)
      // Confidence based on requirement detail level (0-100)
      const wordCount = requirementText.split(/\s+/).length;

      // Heuristic: longer, more detailed requirements = higher confidence
      let detailConfidence = Math.min(100, Math.round((wordCount / 300) * 100));

      // Check for key complexity indicators
      const complexityIndicators = [
        'if', 'else', 'error', 'retry', 'validation', 'approval', 'reject',
        'condition', 'decision', 'branch', 'parallel', 'concurrent', 'sync',
        'offline', 'cache', 'queue', 'workflow', 'permission', 'role'
      ];
      const indicatorCount = complexityIndicators.filter(indicator =>
        requirementText.toLowerCase().includes(indicator)
      ).length;

      // Boost confidence if complexity indicators found
      detailConfidence = Math.min(100, Math.round(detailConfidence + (indicatorCount * 3)));

      confidenceData = {
        score: detailConfidence,
        reason: `Direct analysis of ${wordCount} words with ${indicatorCount} complexity indicators - DIRECT PATH`,
        analysispath: "direct"
      };
      console.log(`\n📊 PATH 3 (DIRECT): ${wordCount} words, ${indicatorCount} indicators detected`);
    }

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

    // CRITICAL FIX: If edges array is empty but we have paths, reconstruct edges from paths
    // This ensures edges data is never missing from the downloaded analysis
    if (edgesList.length === 0 && pathsList.length > 0) {
      console.log("⚠️ Reconstructing edges from paths (parsing failed or Claude didn't format edges)...");
      const uniqueEdges = new Map<string, { from: string; to: string; condition?: string }>();

      pathsList.forEach((path) => {
        for (let i = 0; i < path.length - 1; i++) {
          const from = path[i].trim();
          const to = path[i + 1].trim();
          const edgeKey = `${from}|${to}`;

          if (!uniqueEdges.has(edgeKey) && from && to) {
            uniqueEdges.set(edgeKey, {
              from: from,
              to: to,
              condition: `transition from ${from} to ${to}`
            });
          }
        }
      });

      edgesList = Array.from(uniqueEdges.values());
      console.log(`✅ Reconstructed ${edgesList.length} edges from ${pathsList.length} paths`);
    }

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
      // THREE-PATH METRICS: Show analysis path and breakdown
      analyzedScenarios: {
        analysisPath: analysispath,
        totalQuestions: totalQuestions,

        ...(analysispath === "guided" && {
          answeredQuestions: answeredCount,
          skippedQuestions: totalQuestions - answeredCount,
          coveragePercentage: coveragePercentage,
          questionsAnalyzed: answeredQuestions,
          note: `Pure facts: ${answeredCount}/${totalQuestions} scenarios analyzed`
        }),

        ...(analysispath === "hybrid" && {
          answeredQuestions: answeredCount,
          inferredQuestions: inferredQuestions.length,
          skippedQuestions: totalQuestions - answeredCount - inferredQuestions.length,
          coveragePercentage: coveragePercentage,
          factsContribution: Math.round((answeredCount / totalQuestions) * 100),
          inferenceContribution: Math.round((inferredQuestions.length / totalQuestions) * 100),
          questionsAnalyzed: answeredQuestions,
          questionsInferred: inferredQuestions.map(q => ({
            questionNumber: q.questionNumber,
            description: q.question,
            keywords: "Multiple matches detected in requirement text"
          })),
          note: `Hybrid: ${answeredCount} facts + ${inferredQuestions.length} inferred = ${totalAnalyzed}/${totalQuestions} analyzed`
        }),

        ...(analysispath === "direct" && {
          requirementDetail: `${requirementText.split(/\s+/).length} words analyzed`,
          note: "No questions provided - analyzing full requirement text as-is",
          warning: "More detailed requirement text = better analysis accuracy"
        })
      }
    };
  } catch (error) {
    console.error("❌ Error in complexity analysis:", error);
    return createFallbackAnalysis();
  }
}

/**
 * NEW: Calculate confidence using DECISION MAKING GRAPH approach
 * For each Q&A pair, run a decision graph to validate if answer is CLEAR or VAGUE
 * Confidence = (Clear Answers / Total Questions) × 100
 */
function calculateConfidenceScoreUsingDecisionGraph(
  n: number,
  e: number,
  p: number,
  nodes: string[],
  edges: Array<{ from: string; to: string; condition?: string }>,
  paths: string[][],
  reasoning: string,
  fullText: string
): { score: number; reason: string } {
  const validationResults: { question: string; isClear: boolean; reason: string }[] = [];

  // QUESTION 1: "How many nodes identified?"
  // Decision Graph: Are ALL nodes extracted and listed?
  // CRITICAL: If N=29, must extract ALL 29 nodes (not just some) - 99% minimum
  const nodesMatch = nodes.length >= n * 0.99; // Allow only 1% rounding for very large graphs
  const q1Clear = n > 0 && n <= 100 && nodesMatch;
  validationResults.push({
    question: "Nodes identified (N)",
    isClear: q1Clear,
    reason: q1Clear
      ? `✓ Clear: ${nodes.length}/${n} nodes extracted (${((nodes.length/n)*100).toFixed(1)}% - COMPLETE)`
      : `❌ CRITICAL: ${nodes.length}/${n} nodes extracted (${((nodes.length/n)*100).toFixed(1)}% - INCOMPLETE, need ${Math.ceil(n * 0.99)} minimum)`,
  });

  // QUESTION 2: "What are the edges identified?"
  // Decision Graph: Are edges extracted? Do they MATCH stated count exactly?
  // CRITICAL: ALL edges must be extracted - 99% minimum
  const edgesMatch = edges.length >= e * 0.99; // Allow only 1% rounding
  const q2Clear = edges.length > 0 && edgesMatch;
  validationResults.push({
    question: "Edges identified (E)",
    isClear: q2Clear,
    reason: q2Clear
      ? `✓ Clear: ${edges.length}/${e} edges extracted (${((edges.length/e)*100).toFixed(1)}% - COMPLETE)`
      : `❌ CRITICAL: ${edges.length}/${e} edges extracted (${((edges.length/e)*100).toFixed(1)}% - INCOMPLETE, need ${Math.ceil(e * 0.99)} minimum)`,
  });

  // QUESTION 3: "What are the distinct paths?"
  // Decision Graph: Are ALL paths extracted and listed?
  // CRITICAL: If P=20, must extract ALL 20 paths (not just some) - 99% minimum
  const pathsMatch = paths.length >= p * 0.99; // Allow only 1% rounding
  const q3Clear = paths.length > 0 && pathsMatch;
  validationResults.push({
    question: "Distinct paths (P)",
    isClear: q3Clear,
    reason: q3Clear
      ? `✓ Clear: ${paths.length}/${p} paths traced (${((paths.length/p)*100).toFixed(1)}% - COMPLETE)`
      : `❌ CRITICAL: ${paths.length}/${p} paths traced (${((paths.length/p)*100).toFixed(1)}% - INCOMPLETE, need ${Math.ceil(p * 0.99)} minimum)`,
  });

  // QUESTION 4: "Are N, E, P values consistent?"
  // Decision Graph: Do EXTRACTED counts MATCH STATED values? Must be COMPLETE! - 99% minimum
  const graphValid = e >= n - 1; // Connected graph check
  const countsCompleteMatch = nodes.length >= n * 0.99 && edges.length >= e * 0.99 && paths.length >= p * 0.99;
  const q4Clear = graphValid && countsCompleteMatch;
  validationResults.push({
    question: "Graph structure validity",
    isClear: q4Clear,
    reason: q4Clear
      ? `✓ Clear: VALID & COMPLETE (N:${nodes.length}/${n} ${((nodes.length/n)*100).toFixed(1)}%, E:${edges.length}/${e} ${((edges.length/e)*100).toFixed(1)}%, P:${paths.length}/${p} ${((paths.length/p)*100).toFixed(1)}%)`
      : `❌ CRITICAL: Incomplete extraction (N:${nodes.length}/${n}, E:${edges.length}/${e}, P:${paths.length}/${p}) - need 99% minimum for each`,
  });

  // QUESTION 5: "What is the detailed reasoning?"
  // Decision Graph: Is reasoning specific? Does it explain the analysis? Length check?
  const q5Clear = !!(reasoning && reasoning.length > 100 && !reasoning.toLowerCase().includes("unclear"));
  validationResults.push({
    question: "Reasoning provided",
    isClear: q5Clear,
    reason: q5Clear
      ? `✓ Clear: ${reasoning.length} chars of detailed reasoning`
      : `❌ Vague: Reasoning too short (<100 chars) or unclear`,
  });

  // QUESTION 6: "Are decision points identified?"
  // Decision Graph: Are specific decision points listed? Are they concrete?
  const hasDecisionPoints = fullText.includes("decision") && nodes.length > 0;
  const q6Clear = hasDecisionPoints;
  validationResults.push({
    question: "Decision points identified",
    isClear: q6Clear,
    reason: q6Clear
      ? `✓ Clear: Decision points explicitly identified`
      : `❌ Vague: No specific decision points mentioned`,
  });

  // CALCULATE CONFIDENCE
  const clearAnswers = validationResults.filter((r) => r.isClear).length;
  const totalQuestions = validationResults.length;
  const confidenceScore = Math.round((clearAnswers / totalQuestions) * 100);

  // Build detailed reason
  console.log("\n📊 DECISION MAKING GRAPH RESULTS:");
  validationResults.forEach((v) => {
    console.log(`   ${v.reason}`);
  });

  const clearCount = clearAnswers;
  const vagueCount = totalQuestions - clearAnswers;

  let finalReason = "";
  if (confidenceScore >= 80) {
    finalReason = `High confidence - ${clearCount}/${totalQuestions} answers clear`;
  } else if (confidenceScore >= 60) {
    finalReason = `Moderate confidence - ${clearCount}/${totalQuestions} answers clear`;
  } else if (confidenceScore >= 40) {
    finalReason = `Lower confidence - ${clearCount}/${totalQuestions} answers clear`;
  } else {
    finalReason = `Low confidence - only ${clearCount}/${totalQuestions} answers clear (${vagueCount} vague)`;
  }

  console.log(`\n✅ CONFIDENCE SCORE: ${confidenceScore}% (${clearCount} clear / ${vagueCount} vague)\n`);

  return { score: confidenceScore, reason: finalReason };
}

function createFallbackAnalysis(): ComplexityAnalysis {
  console.error("🚨 FALLBACK TRIGGERED: Analysis failed validation. Returning minimal default.");
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
    reasoning: "Analysis could not be properly parsed or validated. Please review the requirement and try again.",
    confidenceScore: 0,  // ← ZERO confidence, not 75!
    confidenceReason: "Failed to validate analysis - fallback used",
  };
}

// OLD FUNCTION REPLACED: calculateConfidenceScore
// Now using: calculateConfidenceScoreUsingDecisionGraph (Q&A validation approach)

export function getComplexityLevel(
  complexity: number
): "Low" | "Medium" | "High" | "Very High" {
  if (complexity <= 5) return "Low";
  if (complexity <= 15) return "Medium";
  if (complexity <= 30) return "High";
  return "Very High";
}
