// AI side of the architecture design (server only). The graph facts and all checks come from
// lib/architecture-graph.ts; Haiku proposes the questions, the components and the wording.

import Anthropic from "@anthropic-ai/sdk";
import {
  factsForPrompt,
  normalizeEffortTasks,
  normalizeNarrative,
  normalizeQuestions,
  normalizeStructure,
  type ArchAnswer,
  type ArchDesign,
  type ArchQuestion,
  type EffortTask,
  type GraphFacts,
} from "./architecture-graph";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

function parseJson(text: string): any {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const body = block ? block[1] : text;
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  try {
    return JSON.parse(match[0]);
  } catch {
    return JSON.parse(match[0].replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
  }
}

async function ask(prompt: string, maxTokens: number, timeout: number): Promise<any> {
  const response = await anthropic.messages.create(
    { model: MODEL, max_tokens: maxTokens, temperature: 0, messages: [{ role: "user", content: prompt }] },
    { timeout, maxRetries: 0 }
  );
  if (response.stop_reason === "max_tokens") console.warn("Architecture call hit max_tokens; trying to read what came back");
  return parseJson(response.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
}

const kindSummary = (facts: GraphFacts) =>
  Object.entries(facts.byKind)
    .filter(([k, list]) => k !== "logic" && list.length)
    .map(([k, list]) => `${k}: steps ${list.slice(0, 15).join(", ")}${list.length > 15 ? " …" : ""}`)
    .join("\n") || "none detected";

export async function writeArchitectureQuestions(requirement: string, facts: GraphFacts, timeout = 60_000): Promise<ArchQuestion[]> {
  const prompt = `You are a senior solution architect. A requirement has been analysed into a process graph. Before proposing a technical architecture, you ask the business and technical stakeholders the questions whose answers change the architecture.

REQUIREMENT (excerpt):
${requirement.slice(0, 12_000)}

PROCESS GRAPH STEPS (numbered):
${factsForPrompt(facts)}

STEPS THAT LOOK LIKE (keyword-based, may be incomplete):
${kindSummary(facts)}

Write 8 to 12 questions. Cover, where relevant to THIS requirement:
- platform and hosting (cloud / on-premise / an existing platform such as ServiceNow, Salesforce, SAP, or custom build)
- architecture style (single application, modular services, low-code on a platform)
- channels (web, mobile, portal, email, chat)
- one question for EACH external system the steps talk to (how to connect: REST API, file transfer, middleware/ESB, events; real-time or batch) - up to 4 such questions
- data (where records live, volumes, retention, migration of existing data)
- identity and access (SSO, roles, external users)
- non-functional needs (users, availability, performance)
- security and compliance (personal data, audit)
- environments and deployment (how many environments, CI/CD)
- reporting and analytics, if the steps include reports

Rules:
- Every question must say why it matters for THIS requirement ("why") and which step numbers it comes from ("basedOnSteps"; empty only for general questions).
- 3 to 6 short options each. "multiple": true only when several options can apply together.
- "suggested": the option(s) the requirement text points to; if the text says nothing, suggest the most common safe choice.
- No questions about team size, budget or timeline (the estimation asks those later).

Respond with JSON only, no markdown:
{"questions":[{"topic":"Integration","question":"...","why":"...","basedOnSteps":[4,9],"options":["...","..."],"multiple":false,"suggested":["..."]}]}`;
  const raw = await ask(prompt, 4000, timeout);
  return normalizeQuestions(raw, facts.steps.length);
}

const answersForPrompt = (answers: ArchAnswer[]) =>
  answers
    .map((a) => `${a.id} [${a.topic}] ${a.question}\n   Answer: ${a.answer.length ? a.answer.join("; ") : "SKIPPED (not decided - treat as an assumption or open question)"}${a.note ? `\n   Note: ${a.note}` : ""}`)
    .join("\n");

const changesForPrompt = (feedback?: string, previous?: ArchDesign | null) =>
  feedback
    ? `\nTHE USER REVIEWED THE PREVIOUS VERSION AND ASKED FOR THESE CHANGES (apply them):\n${feedback}\n${
        previous ? `Previous components: ${previous.components.map((c) => `${c.name} (${c.type}${c.technology ? `, ${c.technology}` : ""})`).join("; ")}\n` : ""
      }`
    : "";

async function writeStructure(requirement: string, facts: GraphFacts, answers: ArchAnswer[], feedback: string | undefined, previous: ArchDesign | null, timeout: number) {
  const prompt = `You are a senior solution architect. Propose the components of the technical architecture for this requirement.

REQUIREMENT (excerpt):
${requirement.slice(0, 10_000)}

PROCESS GRAPH STEPS (numbered):
${factsForPrompt(facts)}

ARCHITECTURE ANSWERS:
${answersForPrompt(answers)}
${changesForPrompt(feedback, previous)}
Rules:
- 4 to 15 components. Each has: "name", "type" (one of ui, backend, database, integration, ai, mobile, devops), "layer" (one of channel, application, integration, data, platform), "technology" (follow the answers; short, e.g. "React web app", "ServiceNow Flow Designer", "PostgreSQL"), "responsibilities" (one sentence), "steps" (the step numbers it delivers), "external" (true only for an existing or third-party system the team connects to but does not build).
- EVERY step number from 1 to ${facts.steps.length} must be delivered by at least one component that is not external. A step may belong to several components (e.g. a screen and the service behind it).
- For each external system, also add the team's own integration component (type "integration") that delivers the steps talking to it.
- If the platform is an existing product (e.g. ServiceNow), name its real modules/features as components and mark platform-provided ones by saying so in "technology".
- "connections": how components talk ("from"/"to" are component names, "label" a few words like "REST", "events", "reads/writes").

Respond with JSON only, no markdown:
{"components":[{"name":"...","type":"backend","layer":"application","technology":"...","responsibilities":"...","steps":[1,2],"external":false}],"connections":[{"from":"...","to":"...","label":"..."}]}`;
  return normalizeStructure(await ask(prompt, 6000, timeout), facts.steps.length);
}

async function writeNarrative(requirement: string, title: string, facts: GraphFacts, answers: ArchAnswer[], feedback: string | undefined, previous: ArchDesign | null, timeout: number) {
  const prompt = `You are a senior solution architect writing the decision and risk parts of a Technical Design Document.

TITLE: ${title}

REQUIREMENT (excerpt):
${requirement.slice(0, 10_000)}

PROCESS GRAPH STEPS (numbered):
${factsForPrompt(facts, 80)}

ARCHITECTURE ANSWERS:
${answersForPrompt(answers)}
${changesForPrompt(feedback, previous)}
Write:
- "title": the solution name
- "summary": 3-4 sentences: what is built, on what platform, main components and integrations
- "decisions": 5-10 architecture decisions: "decision" (the question decided), "choice", "reason" (tie it to the requirement), "basedOn" (answer ids such as "Q3")
- "risks": 5-10 delivery and technical risks that could cause failure or rework LATER if ignored now (integration unknowns, data migration, performance, security, unclear rules, skipped answers). Each: "risk", "impact" (High/Medium/Low), "likelihood" (High/Medium/Low), "mitigation" (a concrete action now), "steps" (affected step numbers)
- "sections": one paragraph each: "integration" (approach per external system), "data" (main entities, storage, retention, migration), "security" (identity, roles, data protection, audit), "nfr" (availability, performance, scalability, monitoring), "deployment" (environments, CI/CD, release)
- "assumptions": what this design assumes; every SKIPPED answer must appear here as an assumption
- "openQuestions": decisions still needed from the business

Respond with JSON only, no markdown:
{"title":"...","summary":"...","decisions":[{"decision":"...","choice":"...","reason":"...","basedOn":["Q1"]}],"risks":[{"risk":"...","impact":"High","likelihood":"Medium","mitigation":"...","steps":[3]}],"sections":{"integration":"...","data":"...","security":"...","nfr":"...","deployment":"..."},"assumptions":["..."],"openQuestions":["..."]}`;
  return normalizeNarrative(
    await ask(prompt, 5000, timeout),
    facts.steps.length,
    answers.map((a) => a.id)
  );
}

// A short follow-up when the AI left steps without a component: it only picks, for each missing
// step, which existing components deliver it
async function assignMissingSteps(
  facts: GraphFacts,
  structure: ReturnType<typeof normalizeStructure>,
  missing: number[],
  timeout: number
): Promise<void> {
  const built = structure.components.filter((c) => !c.external);
  if (!missing.length || !built.length) return;
  const prompt = `These process steps are not yet delivered by any component of the architecture.

STEPS TO PLACE:
${missing.map((n) => `${n}. ${facts.steps[n - 1]?.label}`).join("\n")}

COMPONENTS:
${built.map((c) => `${c.id}: ${c.name} (${c.type}) - ${c.responsibilities}`).join("\n")}

For each step, pick the component id(s) that would build it (usually 1, at most 3).
Respond with JSON only: {"assign":[{"step":8,"components":["C2"]}]}`;
  const raw = await ask(prompt, 1500, timeout);
  for (const a of Array.isArray(raw?.assign) ? raw.assign : []) {
    const step = Math.round(Number(a?.step));
    if (!missing.includes(step)) continue;
    for (const id of Array.isArray(a?.components) ? a.components.slice(0, 3) : []) {
      const c = built.find((x) => x.id === String(id).trim().toUpperCase());
      if (c && !c.steps.includes(step)) c.steps.push(step);
    }
  }
  for (const c of built) c.steps.sort((x, y) => x - y);
}

// ---------- Estimated build hours ----------

const EFFORT_BATCH = 6; // components per AI call (calls run in parallel)

async function writeEffortBatch(design: ArchDesign, answers: ArchAnswer[], batch: ArchDesign["components"], timeout: number): Promise<unknown[]> {
  const stepLabel = new Map(design.steps.map((s) => [s.no, s.label]));
  const others = design.components.filter((c) => !batch.includes(c));
  const prompt = `You are a senior delivery lead estimating the BUILD effort of a solution bottom-up, from its approved technical architecture.

SOLUTION: ${design.title}
${design.summary}

KEY DECISIONS:
${design.decisions.map((d) => `- ${d.decision}: ${d.choice}`).join("\n") || "- none recorded"}

ARCHITECTURE ANSWERS:
${answers.map((a) => `- ${a.question} -> ${a.answer.length ? a.answer.join("; ") : "SKIPPED"}${a.note ? ` (${a.note})` : ""}`).join("\n") || "- none"}

NON-FUNCTIONAL / SECURITY NOTES:
${[design.sections.nfr, design.sections.security].filter(Boolean).join("\n").slice(0, 1500) || "none"}

OTHER COMPONENTS (context only, do not estimate): ${others.map((c) => `${c.id} ${c.name}${c.external ? " (external)" : ""}`).join("; ") || "none"}

COMPONENTS TO ESTIMATE:
${batch
  .map(
    (c) =>
      `${c.id}: ${c.name} [${c.type}] technology: ${c.technology || "not named"}\n   does: ${c.responsibilities || "-"}\n   delivers process steps: ${c.steps.map((n) => `${n}. ${stepLabel.get(n) || ""}`).join("; ") || "none listed"}`
  )
  .join("\n")}

For EACH component above, list the tasks the team must do to build it: design/configuration, build, unit tests, wiring to the components it talks to, data model or migration where relevant, and its share of security and non-functional work.
Rules:
- Hours are for ONE mid-level developer who knows the technology (the estimation adjusts for seniority and familiarity later).
- Do NOT include system testing, UAT, business analysis or project management (estimated separately).
- If the technology is an existing platform feature (e.g. ServiceNow, Salesforce, SAP module), estimate configuration, not custom code.
- 3 to 10 tasks per component; split anything above 40 likely hours. "steps": the process step numbers the task serves.
- "low" / "likely" / "high": hours if it goes well / as expected / if the known unknowns bite.

Respond with JSON only, no markdown:
{"tasks":[{"component":"C1","task":"...","steps":[1,2],"low":6,"likely":10,"high":16}]}`;
  const raw = await ask(prompt, 6000, timeout);
  return Array.isArray(raw?.tasks) ? raw.tasks : [];
}

// Proposes the build tasks and hours of every component the team builds
export async function writeEffortBreakdown(
  design: ArchDesign,
  answers: ArchAnswer[],
  timeout = 100_000
): Promise<{ tasks: EffortTask[]; missingComponents: string[] }> {
  const built = design.components.filter((c) => !c.external);
  if (!built.length) throw new Error("The design has no components the team builds.");
  const batches: ArchDesign["components"][] = [];
  for (let i = 0; i < built.length; i += EFFORT_BATCH) batches.push(built.slice(i, i + EFFORT_BATCH));
  const results = await Promise.allSettled(batches.map((b) => writeEffortBatch(design, answers, b, timeout)));
  const raw: unknown[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") raw.push(...r.value);
    else console.error(`Effort batch ${i + 1} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
  });
  const tasks = normalizeEffortTasks(raw, design);
  if (!tasks.length) throw new Error("The hours could not be estimated. Please try again.");
  const covered = new Set(tasks.map((t) => t.component));
  return { tasks, missingComponents: built.filter((c) => !covered.has(c.id)).map((c) => c.name) };
}

export async function writeArchitectureDesign(opts: {
  requirement: string;
  title: string;
  facts: GraphFacts;
  answers: ArchAnswer[];
  feedback?: string;
  previous?: ArchDesign | null;
  timeout?: number;
}): Promise<ArchDesign> {
  const started = Date.now();
  const timeout = opts.timeout ?? 100_000;
  const previous = opts.previous ?? null;
  const [structure, narrative] = await Promise.all([
    writeStructure(opts.requirement, opts.facts, opts.answers, opts.feedback, previous, timeout),
    writeNarrative(opts.requirement, opts.title, opts.facts, opts.answers, opts.feedback, previous, timeout),
  ]);
  if (!structure.components.length) throw new Error("The architecture came back without components. Please try again.");

  const covered = new Set(structure.components.filter((c) => !c.external).flatMap((c) => c.steps));
  const missing = opts.facts.steps.map((s) => s.no).filter((n) => !covered.has(n));
  const left = timeout - (Date.now() - started);
  if (missing.length && left > 12_000) {
    try {
      await assignMissingSteps(opts.facts, structure, missing, Math.min(25_000, left - 3_000));
    } catch (err) {
      // the steps stay "unassigned": shown to the user and still estimated
      console.error("Assigning missing steps failed:", err instanceof Error ? err.message : err);
    }
  }
  return {
    title: narrative.title || opts.title,
    summary: narrative.summary,
    components: structure.components,
    connections: structure.connections,
    decisions: narrative.decisions,
    risks: narrative.risks,
    sections: narrative.sections,
    assumptions: narrative.assumptions,
    openQuestions: narrative.openQuestions,
    steps: opts.facts.steps.map((s) => ({ no: s.no, label: s.label, points: s.points })),
  };
}
