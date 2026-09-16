export interface PitchDeckQuestion {
  id: number;
  question: string;
  type: "text" | "textarea" | "radio" | "checkbox";
  options?: string[];
  helpText?: string;
  placeholder?: string;
}

export const pitchDeckQuestions: PitchDeckQuestion[] = [
  {
    id: 1,
    question: "What is the primary target audience/customer segment?",
    type: "textarea",
    placeholder: "e.g., Enterprise CTOs, SMB managers, individual developers...",
    helpText: "Define who will benefit most from this solution",
  },
  {
    id: 2,
    question: "What is the core value proposition (1-2 sentences)?",
    type: "textarea",
    placeholder: "e.g., Reduces deployment time by 80% while improving reliability...",
    helpText: "The key benefit that sets you apart",
  },
  {
    id: 3,
    question: "What problem does this solve?",
    type: "textarea",
    placeholder: "e.g., Manual deployments are slow and error-prone...",
    helpText: "The pain point your solution addresses",
  },
  {
    id: 4,
    question: "Who are the main competitors?",
    type: "textarea",
    placeholder: "e.g., Jenkins, GitLab CI/CD, GitHub Actions...",
    helpText: "List key competitors in the market",
  },
  {
    id: 5,
    question: "What is your competitive advantage?",
    type: "textarea",
    placeholder: "e.g., Fastest setup time, lowest cost, best UX...",
    helpText: "Why customers should choose you over competitors",
  },
  {
    id: 6,
    question: "What is the business model?",
    type: "radio",
    options: ["SaaS (Subscription)", "One-time Purchase", "Freemium", "Open Source", "Other"],
    helpText: "How will you generate revenue?",
  },
  {
    id: 7,
    question: "What are the key metrics/KPIs for success?",
    type: "textarea",
    placeholder: "e.g., 50% reduction in deployment time, 99.9% uptime...",
    helpText: "Measurable outcomes that demonstrate value",
  },
  {
    id: 8,
    question: "What is the go-to-market strategy?",
    type: "textarea",
    placeholder: "e.g., Direct sales to enterprises, self-serve for SMBs, community-driven...",
    helpText: "How will you reach and acquire customers?",
  },
  {
    id: 9,
    question: "What is the estimated market size opportunity?",
    type: "textarea",
    placeholder: "e.g., $5B TAM, $500M SAM...",
    helpText: "Total addressable market and serviceable market",
  },
  {
    id: 10,
    question: "What is the timeline to market?",
    type: "radio",
    options: ["0-3 months", "3-6 months", "6-12 months", "12+ months"],
    helpText: "Expected launch timeline",
  },
];

export interface PitchDeckAnswers {
  [key: number]: string | string[];
}

export interface PitchDeckData {
  requirementId: string;
  answers: PitchDeckAnswers;
  generatedAt?: string;
  slideCount?: number;
  status?: "draft" | "validated" | "final";
}
