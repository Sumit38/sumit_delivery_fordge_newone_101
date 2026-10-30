// Comprehensive estimation: team composition (which developers, how many,
// how senior) and testing questions. Used when the estimation form sends
// `team` and `testing` answers. Older estimations without them still use the
// original formula in estimation-calculator.ts.

export type Seniority = "Junior" | "Mid" | "Senior";

export interface RoleAllocation {
  count: number;
  seniority: Seniority;
  involvement?: number; // support roles only: share of their week on this project (0-1)
}

export interface TeamAnswers {
  workstreams: string[]; // which kinds of work the solution needs
  roles: Record<string, RoleAllocation>; // developer roles
  support: Record<string, RoleAllocation>; // designer, BA, architect, PM
}

export interface TestingAnswers {
  testers: Record<string, RoleAllocation>;
  testTypes: string[];
  automationCoverage: number; // 0-1
  testCycles: number;
  approach: "in-sprint" | "after-dev";
  environment: "ready" | "shared" | "setup";
  testData: "available" | "create" | "mask";
  defectBuffer: number; // 0-1
}

export interface RoleDef {
  id: string;
  label: string;
  hint: string;
}

export const DEVELOPER_ROLES: RoleDef[] = [
  { id: "ui", label: "UI / Frontend developer", hint: "Screens, forms, client-side logic" },
  { id: "backend", label: "Backend / API developer", hint: "Business rules, services, APIs" },
  { id: "database", label: "Database developer", hint: "Schema, queries, stored procedures, migration scripts" },
  { id: "fullstack", label: "Full-stack developer", hint: "Can take UI, backend and simple database work" },
  { id: "mobile", label: "Mobile developer", hint: "iOS / Android apps" },
  { id: "integration", label: "Integration developer", hint: "Connectors to external systems, file transfer, messaging" },
  { id: "ai", label: "AI / ML & agent developer", hint: "LLM agents, prompts, models, AI workflows" },
  { id: "devops", label: "DevOps / Cloud engineer", hint: "Environments, CI/CD, infrastructure, monitoring" },
];

export const SUPPORT_ROLES: RoleDef[] = [
  { id: "ux", label: "UX / UI designer", hint: "Wireframes, visual design" },
  { id: "ba", label: "Business analyst", hint: "Requirement clarification, story grooming" },
  { id: "architect", label: "Solution architect", hint: "Design decisions, reviews" },
  { id: "pm", label: "Project manager / Scrum master", hint: "Planning, ceremonies, reporting" },
];

export const TESTER_ROLES: RoleDef[] = [
  { id: "manual", label: "Manual / functional tester", hint: "Test design, manual execution, UAT support" },
  { id: "automation", label: "Automation tester", hint: "Automated UI/API scripts" },
  { id: "performance", label: "Performance tester", hint: "Load and stress testing" },
  { id: "security", label: "Security tester", hint: "Vulnerability and penetration testing" },
];

export interface WorkstreamDef {
  id: string;
  label: string;
  weight: number; // relative share of development effort
  primary: string[]; // roles that do this work at normal speed
  fallback: string[]; // roles that can do it, but slower
}

export const WORKSTREAMS: WorkstreamDef[] = [
  { id: "ui", label: "User interface (web screens)", weight: 1.0, primary: ["ui", "fullstack"], fallback: ["mobile"] },
  { id: "backend", label: "Backend logic / APIs", weight: 1.2, primary: ["backend", "fullstack"], fallback: ["integration"] },
  { id: "database", label: "Database design / data work", weight: 0.6, primary: ["database"], fallback: ["backend", "fullstack"] },
  { id: "integration", label: "Integrations with external systems", weight: 0.7, primary: ["integration", "backend"], fallback: ["fullstack"] },
  { id: "ai", label: "AI / agent features", weight: 1.0, primary: ["ai"], fallback: ["backend", "fullstack"] },
  { id: "mobile", label: "Mobile app", weight: 1.0, primary: ["mobile"], fallback: ["ui", "fullstack"] },
  { id: "devops", label: "Infrastructure / CI-CD / cloud setup", weight: 0.4, primary: ["devops"], fallback: ["backend", "fullstack"] },
];

export const TEST_TYPES = [
  "Functional",
  "Regression",
  "API testing",
  "Test automation",
  "Performance / load",
  "Security",
  "Accessibility",
  "Cross-browser / device",
  "UAT support",
  "Data migration",
] as const;

export const FALLBACK_FACTOR = 1.25; // a non-specialist takes 25% longer
export const TEST_CASES_PER_SCENARIO = 3; // positive, negative, edge

export function seniorityFactor(s: Seniority | string | undefined): number {
  if (s === "Junior") return 1.5;
  if (s === "Senior") return 0.8;
  return 1.0;
}

// Maps the existing Q1 answer ("Mid-level (2-5 years)") to a role seniority.
export function seniorityFromSkill(skill: string | undefined): Seniority {
  if (skill?.startsWith("Junior")) return "Junior";
  if (skill?.startsWith("Senior")) return "Senior";
  return "Mid";
}

export function countRoles(roles: Record<string, RoleAllocation> | undefined): number {
  return Object.values(roles || {}).reduce((sum, r) => sum + Math.max(0, Math.round(Number(r?.count) || 0)), 0);
}

export interface StaffLoad {
  role: string;
  label: string;
  count: number;
  seniority: Seniority | "-";
  hours: number;
  weeks: number;
  tasks: string[];
  // Testers only: weeks of work during sprints and in the end phase
  inSprintWeeks?: number;
  endWeeks?: number;
}

export interface Gap {
  severity: "high" | "medium" | "low";
  message: string;
}

export interface ComprehensiveDetails {
  mode: "comprehensive";
  devHours: number;
  defectFixHours: number;
  testingHours: number;
  overheadHours: number;
  devWeeks: number;
  testingWeeks: number;
  endPhaseWeeks: number;
  scenarios: number;
  testCases: number;
  automatedTestCases: number;
  devLoads: StaffLoad[];
  testLoads: StaffLoad[];
  supportLoads: StaffLoad[];
  workstreams: Array<{ id: string; label: string; hours: number; staffedBy: string; fallback: boolean }>;
  testActivities: Array<{ activity: string; hours: number; rule: string; owner: string; phase: "in-sprint" | "end" }>;
  gaps: Gap[];
  totalPeople: number;
  testApproach: string;
  approach?: "in-sprint" | "after-dev";
  deadlineFactor?: number;
  formulas: string[];
}

const roleLabel = (id: string) =>
  [...DEVELOPER_ROLES, ...SUPPORT_ROLES, ...TESTER_ROLES].find((r) => r.id === id)?.label || id;

const round = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

interface Bucket {
  inSprint: number;
  end: number;
  tasks: Set<string>;
}

export interface ComprehensiveInput {
  complexityScore: number;
  paths?: number;
  testScenarios?: number;
  availability: number; // hours per week per person
  techFactor: number;
  riskFactor: number;
  deadlineFactor: number;
  team: TeamAnswers;
  testing: TestingAnswers;
}

export function calculateComprehensive(input: ComprehensiveInput) {
  const { complexityScore: M, availability, techFactor, riskFactor, deadlineFactor, team, testing } = input;
  const gaps: Gap[] = [];
  const roles = team.roles || {};
  const has = (id: string) => (Number(roles[id]?.count) || 0) > 0;

  // ---------- Development ----------
  const devBase = M * 8 * techFactor * riskFactor;
  const needed = WORKSTREAMS.filter((w) => team.workstreams?.includes(w.id));
  const sumW = needed.reduce((s, w) => s + w.weight, 0) || 1;
  const devBuckets = new Map<string, { hours: number; tasks: Set<string> }>();
  const addDev = (role: string, hours: number, task: string) => {
    const b = devBuckets.get(role) || { hours: 0, tasks: new Set<string>() };
    b.hours += hours;
    b.tasks.add(task);
    devBuckets.set(role, b);
  };
  const workstreamRows: ComprehensiveDetails["workstreams"] = [];

  for (const ws of needed) {
    const hours = (devBase * ws.weight) / sumW;
    let staff = ws.primary.filter(has);
    let fallback = false;
    if (staff.length === 0) {
      staff = ws.fallback.filter(has);
      fallback = staff.length > 0;
      if (fallback) {
        gaps.push({
          severity: "medium",
          message: `No ${roleLabel(ws.primary[0])} for "${ws.label}". ${staff.map(roleLabel).join(" / ")} will cover it, about 25% slower.`,
        });
      }
    }
    if (staff.length === 0) {
      gaps.push({
        severity: "high",
        message: `Nobody on the team can do "${ws.label}". Add a ${roleLabel(ws.primary[0])}; the timeline assumes one is added.`,
      });
      addDev("unstaffed", hours, ws.label);
      workstreamRows.push({ id: ws.id, label: ws.label, hours: round(hours), staffedBy: "Not staffed", fallback: false });
      continue;
    }
    const heads = staff.reduce((s, id) => s + (Number(roles[id].count) || 0), 0);
    for (const id of staff) {
      const share = hours * ((Number(roles[id].count) || 0) / heads);
      addDev(id, share * seniorityFactor(roles[id].seniority) * (fallback ? FALLBACK_FACTOR : 1), ws.label);
    }
    workstreamRows.push({ id: ws.id, label: ws.label, hours: round(hours), staffedBy: staff.map(roleLabel).join(", "), fallback });
  }

  for (const role of DEVELOPER_ROLES) {
    if (has(role.id) && !devBuckets.has(role.id)) {
      gaps.push({ severity: "low", message: `${roleLabel(role.id)} (${roles[role.id].count}) has no work in the selected areas.` });
    }
  }

  const buffer = Math.min(Math.max(Number(testing.defectBuffer) || 0, 0), 1);
  let devHours = 0;
  let defectFixHours = 0;
  const devLoads: StaffLoad[] = [];
  for (const [id, b] of devBuckets) {
    const fix = b.hours * buffer;
    devHours += b.hours;
    defectFixHours += fix;
    const count = id === "unstaffed" ? 1 : Number(roles[id].count) || 1;
    devLoads.push({
      role: id,
      label: id === "unstaffed" ? "Not staffed (to be hired)" : roleLabel(id),
      count,
      seniority: id === "unstaffed" ? "Mid" : roles[id].seniority,
      hours: round(b.hours + fix),
      weeks: r1((b.hours + fix) / (count * availability)),
      tasks: [...b.tasks],
    });
  }
  const devWeeks = devLoads.reduce((m, l) => Math.max(m, l.weeks), 0);

  // ---------- Testing ----------
  const testers = testing.testers || {};
  const hasT = (id: string) => (Number(testers[id]?.count) || 0) > 0;
  const types = new Set(testing.testTypes || []);
  const scenarios = Math.max(1, Math.round(input.testScenarios || (input.paths ? input.paths * 2 : M)));
  const testCases = scenarios * TEST_CASES_PER_SCENARIO;
  const coverage = types.has("Test automation") ? Math.min(Math.max(Number(testing.automationCoverage) || 0, 0), 1) : 0;
  const automated = Math.round(testCases * coverage);
  const manualCases = testCases - automated;
  const cycles = Math.max(1, Math.round(Number(testing.testCycles) || 1)) + (types.has("Regression") ? 1 : 0);
  const envFactor = testing.environment === "shared" ? 1.1 : 1;

  const activities: ComprehensiveDetails["testActivities"] = [];
  const testBuckets = new Map<string, Bucket>();
  const owner = (prefs: string[]): { id: string; slow: boolean } => {
    const direct = prefs[0];
    if (hasT(direct)) return { id: direct, slow: false };
    const alt = prefs.slice(1).find(hasT);
    if (alt) return { id: alt, slow: true };
    return { id: "unstaffed", slow: false };
  };
  const addTest = (activity: string, rawHours: number, rule: string, prefs: string[], phase: "in-sprint" | "end") => {
    if (rawHours <= 0) return;
    const o = owner(prefs);
    const factor = o.id === "unstaffed" ? 1 : seniorityFactor(testers[o.id].seniority) * (o.slow ? FALLBACK_FACTOR : 1);
    const hours = rawHours * factor;
    const b = testBuckets.get(o.id) || { inSprint: 0, end: 0, tasks: new Set<string>() };
    if (phase === "end") b.end += hours;
    else b.inSprint += hours;
    b.tasks.add(activity);
    testBuckets.set(o.id, b);
    activities.push({
      activity,
      hours: round(hours),
      rule,
      owner: o.id === "unstaffed" ? "Not staffed" : roleLabel(o.id) + (o.slow ? " (covering)" : ""),
      phase,
    });
  };

  const functional = types.has("Functional") || types.has("Regression");
  if (functional) {
    addTest("Test design (write test cases)", testCases * 0.5, `${testCases} test cases × 0.5 h`, ["manual", "automation"], "in-sprint");
    addTest(
      "Manual execution",
      manualCases * 0.25 * cycles * envFactor,
      `${manualCases} manual cases × 0.25 h × ${cycles} cycle(s)${envFactor > 1 ? " × 1.1 shared environment" : ""}`,
      ["manual", "automation"],
      "in-sprint"
    );
    if (buffer > 0) {
      addTest("Defect re-testing", manualCases * 0.25 * buffer, `manual execution × ${Math.round(buffer * 100)}% defect buffer`, ["manual", "automation"], "in-sprint");
    }
  }
  if (types.has("Test automation") && automated > 0) {
    addTest("Automation scripting", automated * 1.5, `${automated} automated cases × 1.5 h`, ["automation", "manual"], "in-sprint");
    addTest("Automation maintenance", automated * 0.1 * cycles, `${automated} scripts × 0.1 h × ${cycles} cycle(s)`, ["automation", "manual"], "in-sprint");
  }
  if (types.has("API testing")) addTest("API testing", scenarios * 1, `${scenarios} scenarios × 1 h`, ["automation", "manual"], "in-sprint");
  if (types.has("Cross-browser / device")) addTest("Cross-browser / device runs", manualCases * 0.25 * 0.3 * cycles, "30% of manual execution", ["manual", "automation"], "in-sprint");
  if (types.has("Accessibility")) addTest("Accessibility testing", 16 + scenarios * 0.25, `16 h + ${scenarios} scenarios × 0.25 h`, ["manual", "automation"], "end");
  if (types.has("Performance / load")) addTest("Performance / load testing", 40 + M * 1, `40 h setup + M(${M}) × 1 h`, ["performance", "automation"], "end");
  if (types.has("Security")) addTest("Security testing", 32 + M * 0.5, `32 h + M(${M}) × 0.5 h`, ["security"], "end");
  if (types.has("Data migration")) addTest("Data migration testing", 24 + M * 0.5, `24 h + M(${M}) × 0.5 h`, ["manual", "automation"], "end");
  if (types.has("UAT support")) addTest("UAT support", 24, "fixed 24 h", ["manual", "automation"], "end");
  if (testing.environment === "setup") addTest("Test environment setup", 40, "fixed 40 h (environment must be built)", ["automation", "manual"], "in-sprint");
  if (testing.testData === "create") addTest("Test data creation", 24, "fixed 24 h", ["manual", "automation"], "in-sprint");
  if (testing.testData === "mask") addTest("Test data masking", 40, "fixed 40 h (copy and mask production data)", ["automation", "manual"], "in-sprint");

  // Gaps for testing
  const anyTester = TESTER_ROLES.some((r) => hasT(r.id));
  if (!anyTester && activities.length > 0) {
    gaps.push({ severity: "high", message: "No testers on the team. Testing hours are counted, but someone must be added or developers must test." });
  } else {
    if (types.has("Test automation") && automated > 0 && !hasT("automation")) {
      gaps.push({ severity: "medium", message: "Automation is planned but there is no Automation tester; the manual tester will script it, about 25% slower." });
    }
    if (types.has("Performance / load") && !hasT("performance")) {
      gaps.push({
        severity: hasT("automation") ? "medium" : "high",
        message: hasT("automation")
          ? "No Performance tester; the Automation tester will run load tests, about 25% slower."
          : "Performance testing is planned but nobody can run it. Add a Performance tester.",
      });
    }
    if (types.has("Security") && !hasT("security")) {
      gaps.push({ severity: "high", message: "Security testing is planned but there is no Security tester. Add one or plan an external security audit." });
    }
  }
  if (!functional) {
    gaps.push({ severity: "medium", message: "Functional testing is not selected, so no test design or execution effort is included." });
  }
  if (testing.approach === "after-dev" && !types.has("Regression")) {
    gaps.push({ severity: "low", message: "Testing runs after development without a regression cycle; late defects may need an extra round." });
  }

  let testingHours = 0;
  const testLoads: StaffLoad[] = [];
  let inSprintWeeks = 0;
  let endPhaseWeeks = 0;
  for (const [id, b] of testBuckets) {
    const count = id === "unstaffed" ? 1 : Number(testers[id].count) || 1;
    const capacity = count * availability;
    testingHours += b.inSprint + b.end;
    inSprintWeeks = Math.max(inSprintWeeks, b.inSprint / capacity);
    endPhaseWeeks = Math.max(endPhaseWeeks, b.end / capacity);
    testLoads.push({
      role: id,
      label: id === "unstaffed" ? "Not staffed (to be added)" : roleLabel(id),
      count,
      seniority: id === "unstaffed" ? "-" : testers[id].seniority,
      hours: round(b.inSprint + b.end),
      weeks: r1((b.inSprint + b.end) / capacity),
      tasks: [...b.tasks],
      inSprintWeeks: r1(b.inSprint / capacity),
      endWeeks: r1(b.end / capacity),
    });
  }
  const testingWeeks = testLoads.reduce((m, l) => Math.max(m, l.weeks), 0);

  // ---------- Timeline ----------
  const coreWeeks =
    testing.approach === "after-dev"
      ? devWeeks + testingWeeks
      : Math.max(devWeeks, inSprintWeeks) + endPhaseWeeks;
  const timeline = Math.max(1, Math.ceil(coreWeeks * deadlineFactor));

  // ---------- Support roles (time-based) ----------
  const support = team.support || {};
  const supportLoads: StaffLoad[] = [];
  let overheadHours = 0;
  for (const r of SUPPORT_ROLES) {
    const a = support[r.id];
    const count = Number(a?.count) || 0;
    if (count <= 0) continue;
    const involvement = Math.min(Math.max(Number(a.involvement) || 0.5, 0.1), 1);
    const hours = count * availability * involvement * timeline;
    overheadHours += hours;
    supportLoads.push({
      role: r.id,
      label: r.label,
      count,
      seniority: a.seniority,
      hours: round(hours),
      weeks: timeline,
      tasks: [`${Math.round(involvement * 100)}% involvement for ${timeline} week(s)`],
    });
  }
  if (!support.ba?.count && team.workstreams?.length > 2) {
    gaps.push({ severity: "low", message: "No Business analyst: developers and testers will spend time clarifying requirements." });
  }

  // Sum of the rounded parts, so the report's rows add up to the total
  const totalEffort = round(devHours) + round(defectFixHours) + round(testingHours) + round(overheadHours);
  const totalPeople = countRoles(roles) + countRoles(testers) + countRoles(support);

  const formulas = [
    `Development base = M(${M}) × 8 h × tech ${techFactor} × risk ${riskFactor} = ${round(devBase)} h, shared across the selected work areas by weight.`,
    "Each developer's share is multiplied by seniority (Junior 1.5, Mid 1.0, Senior 0.8); a non-specialist covering an area takes 25% longer.",
    `Defect-fix buffer: ${Math.round(buffer * 100)}% of development = ${round(defectFixHours)} h.`,
    `Test scenarios = ${input.testScenarios ? "from the analysis" : input.paths ? "2 × paths" : "M"} = ${scenarios}; test cases = scenarios × ${TEST_CASES_PER_SCENARIO} = ${testCases} (positive, negative, edge).`,
    `Automation coverage ${Math.round(coverage * 100)}% → ${automated} automated, ${manualCases} manual test cases; ${cycles} execution cycle(s).`,
    testing.approach === "after-dev"
      ? `Timeline = (development ${r1(devWeeks)} wk + testing ${r1(testingWeeks)} wk) × deadline ${deadlineFactor}, rounded up.`
      : `Timeline = (max(development ${r1(devWeeks)} wk, in-sprint testing ${r1(inSprintWeeks)} wk) + end-phase testing ${r1(endPhaseWeeks)} wk) × deadline ${deadlineFactor}, rounded up.`,
    "Weeks per role = role hours ÷ (people in role × hours per week); the slowest role sets the pace.",
    "Support roles are counted by time: people × hours per week × involvement × timeline.",
  ];

  const details: ComprehensiveDetails = {
    mode: "comprehensive",
    devHours: round(devHours),
    defectFixHours: round(defectFixHours),
    testingHours: round(testingHours),
    overheadHours: round(overheadHours),
    devWeeks: r1(devWeeks),
    testingWeeks: r1(testingWeeks),
    endPhaseWeeks: r1(endPhaseWeeks),
    scenarios,
    testCases,
    automatedTestCases: automated,
    devLoads: devLoads.sort((a, b) => b.weeks - a.weeks),
    testLoads: testLoads.sort((a, b) => b.weeks - a.weeks),
    supportLoads,
    workstreams: workstreamRows,
    testActivities: activities,
    gaps,
    totalPeople,
    testApproach: testing.approach === "after-dev" ? "After development (separate phase)" : "Inside each sprint, alongside development",
    approach: testing.approach === "after-dev" ? "after-dev" : "in-sprint",
    deadlineFactor,
    formulas,
  };

  return { totalEffort, timeline, devBase: round(devBase), details };
}
