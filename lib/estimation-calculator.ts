import {
  getSkillFactor,
  getTechFactor,
  getTestFactor,
  getRiskFactor,
  getDeadlineFactor,
  EstimationFactors,
} from "./estimation-questions";

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
  };
  assumptions: string[];
}

export function calculateEstimation(
  complexityScore: number,
  answers: Record<number, any>
): EstimationResult {
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
