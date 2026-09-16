export interface EstimationQuestion {
  id: number;
  question: string;
  type: "radio" | "number" | "select";
  options?: string[];
  range?: string;
  default?: any;
  unit?: string;
  helpText?: string;
}

export const estimationQuestions: EstimationQuestion[] = [
  {
    id: 1,
    question: "What is your team's average skill level?",
    type: "radio",
    options: ["Junior (0-2 years)", "Mid-level (2-5 years)", "Senior (5+ years)"],
    helpText: "This affects effort multiplier",
  },
  {
    id: 2,
    question: "How many developers are available for this project?",
    type: "number",
    range: "1-50",
    default: 4,
    unit: "developers",
    helpText: "Team size impacts timeline",
  },
  {
    id: 3,
    question: "Team availability (hours per week per developer)?",
    type: "number",
    range: "10-40",
    default: 40,
    unit: "hours/week",
    helpText: "Full-time = 40 hrs, Part-time = 20-30 hrs",
  },
  {
    id: 4,
    question: "How familiar is your team with the technology stack?",
    type: "radio",
    options: ["Very Familiar", "Moderately Familiar", "New/Complex Stack"],
    helpText: "New technology increases effort",
  },
  {
    id: 5,
    question: "What is your testing requirement level?",
    type: "radio",
    options: ["Basic Testing", "Standard Testing", "Comprehensive Testing"],
    helpText: "Comprehensive testing adds 30-50% effort",
  },
  {
    id: 6,
    question: "What is your risk tolerance for timeline?",
    type: "radio",
    options: ["Aggressive (Tight)", "Moderate (Realistic)", "Conservative (Padded)"],
    helpText: "Affects timeline buffer and quality assurance",
  },
  {
    id: 7,
    question: "What is your project deadline preference?",
    type: "radio",
    options: ["ASAP (Within estimation)", "Flexible", "Extended Timeline Available"],
    helpText: "Impacts resource allocation strategy",
  },
];

// Optional budget question (only if user wants budget calculation)
export const budgetQuestion: EstimationQuestion = {
  id: 8,
  question: "What is your cost per developer per hour? ($)",
  type: "number",
  range: "25-300",
  default: 75,
  unit: "$/hour",
  helpText: "Used to calculate total project budget",
};

export interface EstimationFactors {
  skillFactor: number;
  techFactor: number;
  testFactor: number;
  riskFactor: number;
  deadlineFactor: number;
}

export function getSkillFactor(skillLevel: string): number {
  const factors: Record<string, number> = {
    "Junior (0-2 years)": 1.5,
    "Mid-level (2-5 years)": 1.0,
    "Senior (5+ years)": 0.8,
  };
  return factors[skillLevel] || 1.0;
}

export function getTechFactor(familiarity: string): number {
  const factors: Record<string, number> = {
    "Very Familiar": 0.9,
    "Moderately Familiar": 1.0,
    "New/Complex Stack": 1.3,
  };
  return factors[familiarity] || 1.0;
}

export function getTestFactor(testingLevel: string): number {
  const factors: Record<string, number> = {
    "Basic Testing": 1.0,
    "Standard Testing": 1.2,
    "Comprehensive Testing": 1.5,
  };
  return factors[testingLevel] || 1.0;
}

export function getRiskFactor(riskTolerance: string): number {
  const factors: Record<string, number> = {
    "Aggressive (Tight)": 0.8,
    "Moderate (Realistic)": 1.0,
    "Conservative (Padded)": 1.3,
  };
  return factors[riskTolerance] || 1.0;
}

export function getDeadlineFactor(deadline: string): number {
  const factors: Record<string, number> = {
    "ASAP (Within estimation)": 1.0,
    "Flexible": 1.1,
    "Extended Timeline Available": 0.9,
  };
  return factors[deadline] || 1.0;
}
