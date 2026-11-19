// What the approved architecture already tells the estimation: the technologies to ask
// familiarity for, the kinds of testing it implies, the roles its work areas need, and the
// environment answer given during the architecture Q&A.

import { effortSizing, technologyKey, type ArchAnswer, type ArchDesign, type ArchEffort } from "./architecture-graph";
import { DEVELOPER_ROLES, WORKSTREAMS } from "./estimation-team";

export interface EstimationHints {
  version: number;
  componentCount: number;
  likely: number;
  low: number;
  high: number;
  areas: Array<{ id: string; hours: number }>;
  technologies: Array<{ key: string; components: string[]; hours: number }>;
  suggestedTests: Array<{ type: string; reason: string }>;
  roleNeeds: Array<{ area: string; hours: number; roles: string[] }>;
  environmentAnswer?: string;
}

const answerText = (a: ArchAnswer) => `${a.answer.join("; ")}${a.note ? ` (${a.note})` : ""}`;

export function estimationHints(version: number, design: ArchDesign, answers: ArchAnswer[], effort: ArchEffort | null): EstimationHints {
  const sizing = effortSizing(design, effort);
  const built = design.components.filter((c) => !c.external);

  const techMap = new Map<string, { components: string[]; hours: number }>();
  for (const c of built) {
    const key = technologyKey(c);
    const t = techMap.get(key) || { components: [], hours: 0 };
    t.components.push(c.name);
    t.hours += sizing.components.find((x) => x.id === c.id)?.likely || 0;
    techMap.set(key, t);
  }
  const technologies = [...techMap.entries()]
    .map(([key, t]) => ({ key, components: t.components, hours: Math.round(t.hours) }))
    .sort((a, b) => b.hours - a.hours);

  const answered = answers.filter((a) => a.answer.length);
  const corpus = [...answered.map((a) => `${a.question} ${answerText(a)}`), design.sections.data, design.sections.security, design.sections.nfr].join(" \n ");
  const count = (type: string) => built.filter((c) => c.type === type).length;
  const tests: Array<{ type: string; reason: string }> = [
    { type: "Functional", reason: "every process step of the analysis" },
    { type: "Regression", reason: "changes across several components" },
    { type: "UAT support", reason: "business sign-off of the approved design" },
  ];
  if (count("integration")) tests.push({ type: "API testing", reason: `${count("integration")} integration component(s)` });
  if (/migrat/i.test(corpus)) tests.push({ type: "Data migration", reason: "the design includes migrating existing data" });
  if (/(personal|sensitive|pii|gdpr|hipaa|pci|regulat|complian|audit)/i.test(corpus)) {
    tests.push({ type: "Security", reason: "personal/sensitive data or compliance in the design" });
  }
  if (/(high availability|99\.\d|peak|concurrent|\b\d{1,3},?\d{3}\+? users|thousands|load)/i.test(corpus)) {
    tests.push({ type: "Performance / load", reason: "volume or availability targets in the design" });
  }
  if (count("ui") || count("mobile")) tests.push({ type: "Cross-browser / device", reason: `${count("ui") + count("mobile")} screen/mobile component(s)` });

  const roleLabel = (id: string) => DEVELOPER_ROLES.find((r) => r.id === id)?.label || id;
  const roleNeeds = WORKSTREAMS.filter((w) => (sizing.byType[w.id] || 0) > 0).map((w) => ({
    area: w.label,
    hours: Math.round(sizing.byType[w.id]),
    roles: w.primary.map(roleLabel),
  }));

  const env = answers.find((a) => /(environment|deploy|ci\/?cd|release)/i.test(`${a.topic} ${a.question}`));

  return {
    version,
    componentCount: built.length,
    likely: sizing.likely,
    low: sizing.low,
    high: sizing.high,
    areas: Object.entries(sizing.byType)
      .filter(([, h]) => h > 0)
      .map(([id, hours]) => ({ id, hours: Math.round(hours) })),
    technologies,
    suggestedTests: tests,
    roleNeeds,
    ...(env ? { environmentAnswer: env.answer.length ? `${env.question} → ${answerText(env)}` : `${env.question} → skipped` } : {}),
  };
}
