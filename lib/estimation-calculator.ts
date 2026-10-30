import {
  getSkillFactor,
  getTechFactor,
  getTestFactor,
  getRiskFactor,
  getDeadlineFactor,
} from "./estimation-questions";
import {
  calculateComprehensive,
  countRoles,
  seniorityFactor,
  type ComprehensiveDetails,
  type TeamAnswers,
  type TestingAnswers,
} from "./estimation-team";

export interface EstimationResult {
  baseEffort: number;
  totalEffort: number;
  timeline: number;
  teamSize: number;
  costPerHour?: number;
  totalBudget?: number;
  riskLevel: string;
  skillLevel: string;
  techFamiliarity: string;
  testingLevel: string;
  confidence: number;
  breakdown: {
    skillFactor: number;
    techFactor: number;
    testFactor: number;
    riskFactor: number;
    deadlineFactor: number;
    // Present only for estimations made with the team and testing questions
    details?: ComprehensiveDetails;
  };
  assumptions: string[];
}

export interface EstimationContext {
  paths?: number;
  testScenarios?: number;
}

export function calculateEstimation(
  complexityScore: number,
  answers: Record<string, any>,
  context: EstimationContext = {}
): EstimationResult {
  if (answers?.team && answers?.testing) {
    return calculateComprehensiveEstimation(complexityScore, answers, context);
  }

  // Extract answers
  const skillLevel = answers[1];
  const teamSize = answers[2] || 4;
  const availability = answers[3] || 40;
  const techFamiliarity = answers[4];
  const testingLevel = answers[5];
  const riskTolerance = answers[6];
  const deadline = answers[7];

  // Budget is optional (only if user enabled it)
  const costPerHour = answers[8] || undefined;
  const includeBudget = costPerHour !== undefined;

  // Get factors
  const skillFactor = getSkillFactor(skillLevel);
  const techFactor = getTechFactor(techFamiliarity);
  const testFactor = getTestFactor(testingLevel);
  const riskFactor = getRiskFactor(riskTolerance);
  const deadlineFactor = getDeadlineFactor(deadline);

  // Base effort formula: complexity score * 8 hours per point
  const baseEffort = complexityScore * 8;

  // Total effort with all factors
  const totalEffort = Math.round(
    baseEffort * skillFactor * techFactor * testFactor * riskFactor
  );

  // Calculate timeline (accounting for deadline/risk pressure)
  const hoursPerWeek = teamSize * availability;
  const timeline = Math.ceil((totalEffort / hoursPerWeek) * deadlineFactor);

  // Calculate budget only if provided
  const totalBudget = includeBudget ? Math.round(totalEffort * costPerHour!) : undefined;

  // Calculate confidence score
  const confidence = calculateConfidenceScore(
    skillFactor,
    riskFactor,
    testFactor
  );

  // Build assumptions list
  const assumptions = buildAssumptions({
    complexityScore,
    teamSize,
    skillLevel,
    techFamiliarity,
    testingLevel,
    riskTolerance,
  });

  return {
    baseEffort,
    totalEffort,
    timeline,
    teamSize,
    costPerHour,
    totalBudget,
    riskLevel: riskTolerance,
    skillLevel,
    techFamiliarity,
    testingLevel,
    confidence,
    breakdown: {
      skillFactor,
      techFactor,
      testFactor,
      riskFactor,
      deadlineFactor,
    },
    assumptions,
  };
}

// Uses the team composition and testing answers instead of a single
// "number of developers" and "testing level".
function calculateComprehensiveEstimation(
  complexityScore: number,
  answers: Record<string, any>,
  context: EstimationContext
): EstimationResult {
  const team = answers.team as TeamAnswers;
  const testing = answers.testing as TestingAnswers;
  const skillLevel = answers[1];
  const availability = Number(answers[3]) || 40;
  const techFamiliarity = answers[4];
  const riskTolerance = answers[6];
  const deadline = answers[7];
  const costPerHour = answers[8] || undefined;

  const techFactor = getTechFactor(techFamiliarity);
  const riskFactor = getRiskFactor(riskTolerance);
  const deadlineFactor = getDeadlineFactor(deadline);

  const { totalEffort, timeline, devBase, details } = calculateComprehensive({
    complexityScore,
    paths: context.paths,
    testScenarios: context.testScenarios,
    availability,
    techFactor,
    riskFactor,
    deadlineFactor,
    team,
    testing,
  });

  const developers = countRoles(team.roles);

  // Average developer seniority, weighted by headcount
  const devRoles = Object.values(team.roles || {}).filter((r) => (Number(r.count) || 0) > 0);
  const skillFactor = developers
    ? Math.round(
        (devRoles.reduce((s, r) => s + seniorityFactor(r.seniority) * Number(r.count), 0) / developers) * 100
      ) / 100
    : getSkillFactor(skillLevel);
  const testFactor = details.devHours
    ? Math.round(((details.devHours + details.testingHours) / details.devHours) * 100) / 100
    : 1;

  let confidence = 75;
  if (skillFactor <= 0.85) confidence += 10;
  if (skillFactor >= 1.4) confidence -= 10;
  if (riskFactor >= 1.2) confidence += 10;
  if (riskFactor <= 0.8) confidence -= 15;
  const types = testing.testTypes || [];
  if (types.includes("Functional") && types.includes("Regression")) confidence += 5;
  for (const g of details.gaps) confidence -= g.severity === "high" ? 8 : g.severity === "medium" ? 4 : 0;
  confidence = Math.max(40, Math.min(95, confidence));

  const testingLevel = `Custom: ${types.length} test type${types.length === 1 ? "" : "s"}`;
  const roleSummary = devRoles.length
    ? Object.entries(team.roles)
        .filter(([, r]) => (Number(r.count) || 0) > 0)
        .map(([id, r]) => `${r.count} ${r.seniority} ${id}`)
        .join(", ")
    : "none";

  const assumptions = [
    `Project complexity score of ${complexityScore} used as baseline (M = E - N + 2P)`,
    `Developers: ${developers} (${roleSummary}); testers: ${countRoles(testing.testers)}; support roles: ${countRoles(team.support)}`,
    `Work areas: ${(team.workstreams || []).join(", ") || "none selected"}`,
    `Test types: ${types.join(", ") || "none selected"}; approach: ${details.testApproach}`,
    `Availability: ${availability} hours per week per person`,
    `Technology familiarity: ${techFamiliarity}; risk approach: ${riskTolerance}; deadline: ${deadline}`,
    ...details.formulas,
  ];

  return {
    baseEffort: devBase,
    totalEffort,
    timeline,
    teamSize: developers,
    costPerHour,
    totalBudget: costPerHour ? Math.round(totalEffort * costPerHour) : undefined,
    riskLevel: riskTolerance,
    skillLevel: skillLevel || "Mixed",
    techFamiliarity,
    testingLevel,
    confidence,
    breakdown: { skillFactor, techFactor, testFactor, riskFactor, deadlineFactor, details },
    assumptions,
  };
}

function calculateConfidenceScore(
  skillFactor: number,
  riskFactor: number,
  testFactor: number
): number {
  // Higher skill (lower factor) = higher confidence
  // Lower risk (1.0) = higher confidence
  // Comprehensive testing = higher confidence

  let confidence = 75; // Base confidence

  // Adjust for skill level
  if (skillFactor <= 0.8) confidence += 15; // Senior team
  if (skillFactor >= 1.5) confidence -= 15; // Junior team

  // Adjust for risk
  if (riskFactor >= 1.2) confidence += 10; // Conservative approach
  if (riskFactor <= 0.8) confidence -= 15; // Aggressive approach

  // Adjust for testing
  if (testFactor >= 1.4) confidence += 10; // Comprehensive testing

  return Math.max(40, Math.min(95, confidence)); // Clamp between 40-95%
}

function buildAssumptions(params: {
  complexityScore: number;
  teamSize: number;
  skillLevel: string;
  techFamiliarity: string;
  testingLevel: string;
  riskTolerance: string;
}): string[] {
  const assumptions: string[] = [];

  assumptions.push(
    `Project complexity score of ${params.complexityScore} used as baseline`
  );
  assumptions.push(`Team size: ${params.teamSize} developers (full-time)`);
  assumptions.push(`Team skill level: ${params.skillLevel}`);
  assumptions.push(`Technology familiarity: ${params.techFamiliarity}`);
  assumptions.push(`Testing level: ${params.testingLevel}`);
  assumptions.push(
    `Risk approach: ${params.riskTolerance} (may affect timeline buffer)`
  );
  assumptions.push(
    "No major scope changes after project initiation"
  );
  assumptions.push("Requirements are stable and clearly defined");
  assumptions.push(
    "Development environment and tools are readily available"
  );
  assumptions.push(
    "Team has continuous access to stakeholders for clarifications"
  );

  return assumptions;
}

export interface ProposedManDays {
  devManDays: number;
  qaManDays: number;
  supportManDays: number;
  fromEstimation: boolean; // true when based on the team and testing answers
}

// Dev and QA man-days shown across the app. Once an estimation with the team
// and testing questions exists, they come from it (development + defect
// fixing for Dev, every testing activity for QA). Otherwise the quick
// estimate from the complexity score is used: Dev = M × 0.8, QA = M × 0.5.
export function getProposedManDays(
  complexityScore: number,
  estimation?: { breakdown?: { details?: ComprehensiveDetails } | null } | null
): ProposedManDays {
  const d = estimation?.breakdown?.details;
  if (d && d.mode === "comprehensive") {
    return {
      devManDays: (d.devHours + d.defectFixHours) / 8,
      qaManDays: d.testingHours / 8,
      supportManDays: d.overheadHours / 8,
      fromEstimation: true,
    };
  }
  return {
    devManDays: complexityScore * 0.8,
    qaManDays: complexityScore * 0.5,
    supportManDays: 0,
    fromEstimation: false,
  };
}

export function getEstimationCategory(
  complexityScore: number
): "Simple" | "Moderate" | "Complex" | "Very Complex" {
  if (complexityScore <= 15) return "Simple";
  if (complexityScore <= 30) return "Moderate";
  if (complexityScore <= 50) return "Complex";
  return "Very Complex";
}

export function formatDuration(weeks: number): string {
  if (weeks < 1) return `${Math.ceil(weeks * 7)} days`;
  if (weeks < 4) return `${weeks} week${weeks > 1 ? "s" : ""}`;
  const months = Math.floor(weeks / 4);
  const remainingWeeks = weeks % 4;
  if (remainingWeeks === 0) return `${months} month${months > 1 ? "s" : ""}`;
  return `${months} month${months > 1 ? "s" : ""} ${remainingWeeks} week${remainingWeeks > 1 ? "s" : ""}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}
