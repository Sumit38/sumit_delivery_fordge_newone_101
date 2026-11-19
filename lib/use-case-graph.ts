// Comprehensive use case built from the analysis graph (server only).
// Structure comes from lib/use-case-flows.ts (every decision outcome, every path);
// Haiku writes the wording: first the business rules, then the frame (actors, trigger,
// guarantees, main success scenario) and the extensions in parallel batches.

import Anthropic from "@anthropic-ai/sdk";
import { applyFlowWording, salvageObjects, type FlowStep, type UseCaseExtension, type UseCaseStructure } from "./use-case-flows";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

const FLOWS_PER_BATCH = 4;
const MAX_WORDED_FLOWS = 60; // beyond this, flows keep the generated text (keeps time in check)

export interface UseCaseFrame {
  useCaseTitle: string;
  description: string;
  trigger: string;
  primaryActor: { name: string; role: string };
  secondaryActors: Array<{ name: string; role: string }>;
  stakeholders: Array<{ name: string; interest: string }>;
  preconditions: string[];
  successPostconditions: string[];
  failurePostconditions: string[];
  businessRules: Array<{ id: string; rule: string }>;
  assumptions: string[];
  mainSteps: Array<FlowStep & { step: number; rules: string[] }>;
  mainAcceptanceCriteria: string[];
  wording: "AI" | "Generated";
}

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

async function askText(prompt: string, maxTokens: number, timeout: number): Promise<string> {
  const response = await anthropic.messages.create(
    { model: MODEL, max_tokens: maxTokens, temperature: 0, messages: [{ role: "user", content: prompt }] },
    { timeout, maxRetries: 0 }
  );
  return response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function ask(prompt: string, maxTokens: number, timeout: number): Promise<any> {
  return parseJson(await askText(prompt, maxTokens, timeout));
}


const s = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const strings = (v: unknown) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);
const ruleIds = (v: unknown) => strings(v).filter((r) => /^BR-\d+$/i.test(r)).map((r) => r.toUpperCase());

// Plain frame from the graph, used when the AI part fails
export function generatedFrame(title: string, structure: UseCaseStructure): UseCaseFrame {
  return {
    useCaseTitle: title,
    description: `Use case for "${title}", covering ${structure.coverage.decisions} decisions and ${structure.coverage.paths} paths from the complexity analysis.`,
    trigger: `The first step starts: ${structure.mainRoute[0] || "the process begins"}.`,
    primaryActor: { name: "User", role: "Starts the process" },
    secondaryActors: [{ name: "System", role: "Performs the automated steps" }],
    stakeholders: [],
    preconditions: [],
    successPostconditions: [`The process completes after "${structure.mainRoute[structure.mainRoute.length - 1] || "the last step"}".`],
    failurePostconditions: ["No partial or inconsistent data is saved, and the affected users are informed."],
    businessRules: [],
    assumptions: [],
    mainSteps: structure.mainRoute.map((label, i) => ({ step: i + 1, actor: "System / User", action: label, rules: [] })),
    mainAcceptanceCriteria: [],
    wording: "Generated",
  };
}

async function writeFrame(
  requirement: string,
  title: string,
  structure: UseCaseStructure,
  businessRules: Array<{ id: string; rule: string }>,
  timeout: number
): Promise<UseCaseFrame> {
  const decisions = [...new Set(structure.extensions.map((x) => x.decision))];
  const prompt = `You are a senior business analyst writing a formal use case (Cockburn style) for this requirement.

REQUIREMENT:
${requirement}

MAIN SUCCESS SCENARIO from the analysed control-flow graph (${structure.mainRoute.length} steps, in order):
${structure.mainRoute.map((st, i) => `${i + 1}. ${st}`).join("\n")}

DECISION POINTS in the process:
${decisions.map((d) => `- ${d}`).join("\n") || "- none"}

BUSINESS RULES:
${businessRules.map((r) => `${r.id}: ${r.rule}`).join("\n") || "none"}

Write the use case frame. Rules:
- "mainSteps": one entry per listed step, using its number in "step". Each names the actor who does it (a real role, or "System") and the action in one clear sentence. "rules" lists the business rule ids the step applies (may be empty).
- "failurePostconditions": what must still be true when the use case fails or is cancelled (the minimal guarantee: no partial data, audit kept, users notified ...).
- "assumptions": things taken as given that the business should confirm.
- "mainAcceptanceCriteria": 3-5 criteria in "Given ..., when ..., then ..." form for the main success scenario.
- Keep every text value to one sentence. Be specific to this requirement.

Respond with JSON only, no markdown:
{"useCaseTitle":"...","description":"2-3 sentence summary","trigger":"...","primaryActor":{"name":"...","role":"..."},"secondaryActors":[{"name":"...","role":"..."}],"stakeholders":[{"name":"...","interest":"..."}],"preconditions":["..."],"successPostconditions":["..."],"failurePostconditions":["..."],"assumptions":["..."],"mainSteps":[{"step":1,"actor":"...","action":"...","rules":["BR-01"]}],"mainAcceptanceCriteria":["Given ..., when ..., then ..."]}`;

  const d = await ask(prompt, 6000, timeout);
  const fallback = generatedFrame(title, structure);
  // Matched by step number; a step the AI left out keeps the graph's own wording
  const written = new Map<number, { actor: string; action: string; rules: string[] }>();
  (Array.isArray(d.mainSteps) ? d.mainSteps : []).forEach((st: any, i: number) => {
    const no = Number(st?.step) || i + 1;
    if (s(st?.action) && !written.has(no)) written.set(no, { actor: s(st?.actor) || "System", action: s(st?.action), rules: ruleIds(st?.rules) });
  });
  const mainSteps = fallback.mainSteps.map((st) => (written.has(st.step) ? { step: st.step, ...written.get(st.step)! } : st));
  const aiSteps = fallback.mainSteps.filter((st) => written.has(st.step)).length;
  const people = (v: unknown, key: "role" | "interest") =>
    (Array.isArray(v) ? v : [])
      .map((p: any) => ({ name: s(p?.name), [key]: s(p?.[key]) }))
      .filter((p: any) => p.name) as any[];

  return {
    useCaseTitle: s(d.useCaseTitle) || title,
    description: s(d.description) || fallback.description,
    trigger: s(d.trigger) || fallback.trigger,
    primaryActor: d.primaryActor && s(d.primaryActor.name) ? { name: s(d.primaryActor.name), role: s(d.primaryActor.role) } : fallback.primaryActor,
    secondaryActors: people(d.secondaryActors, "role"),
    stakeholders: people(d.stakeholders, "interest"),
    preconditions: strings(d.preconditions),
    successPostconditions: strings(d.successPostconditions).length ? strings(d.successPostconditions) : fallback.successPostconditions,
    failurePostconditions: strings(d.failurePostconditions).length ? strings(d.failurePostconditions) : fallback.failurePostconditions,
    businessRules,
    assumptions: strings(d.assumptions),
    mainSteps,
    mainAcceptanceCriteria: strings(d.mainAcceptanceCriteria).slice(0, 5),
    wording: aiSteps >= mainSteps.length / 2 ? "AI" : "Generated",
  };
}

// Business rules come first (one short call) so the frame and every flow can refer to them
async function writeBusinessRules(requirement: string, timeout: number): Promise<Array<{ id: string; rule: string }>> {
  const d = await ask(
    `You are a senior business analyst. List the business rules of this requirement: thresholds, approvals, validations, limits, SLAs, data and retention rules that are stated or clearly implied.

REQUIREMENT:
${requirement}

Write 5-15 rules, one sentence each, numbered BR-01, BR-02 ...

Respond with JSON only, no markdown:
{"businessRules":[{"id":"BR-01","rule":"..."}]}`,
    2000,
    timeout
  );
  return (Array.isArray(d.businessRules) ? d.businessRules : [])
    .map((r: any, i: number) => ({ id: /^BR-\d+$/i.test(s(r?.id)) ? s(r.id).toUpperCase() : `BR-${String(i + 1).padStart(2, "0")}`, rule: s(r?.rule) }))
    .filter((r: any) => r.rule)
    .slice(0, 15);
}

async function writeFlowBatch(
  requirement: string,
  mainRoute: string[],
  businessRules: Array<{ id: string; rule: string }>,
  batch: UseCaseExtension[],
  timeout: number
): Promise<any[]> {
  const prompt = `You are a senior business analyst writing the extensions (alternative and exception flows) of a formal use case.

REQUIREMENT (excerpt):
${requirement}

MAIN SUCCESS SCENARIO:
${mainRoute.map((st, i) => `${i + 1}. ${st}`).join("\n")}

BUSINESS RULES:
${businessRules.map((r) => `${r.id}: ${r.rule}`).join("\n") || "none"}

FLOWS TO WRITE (structure is fixed; keep it):
${JSON.stringify(
    batch.map((x) => ({
      id: x.id,
      label: x.label,
      kind: x.kind,
      branchesAt: x.decision,
      outcome: x.condition,
      branchesFromMainStep: x.branchFromStep,
      stepsInGraph: x.graphSteps,
      ending: x.ending,
    }))
  )}

For each flow write:
- "name": a short name (e.g. "Quote rejected by approver")
- "trigger": one sentence: the condition at the decision that starts this flow
- "steps": one step per entry in stepsInGraph, same order ({actor, action}, one sentence each). If stepsInGraph is empty, write one step describing what happens. The last step must match "ending".
- "acceptanceCriteria": 2-3 criteria in "Given ..., when ..., then ..." form. For Exception flows include what the system guarantees (clear message, no partial data, notification, audit).
- "rules": ids of the business rules this flow applies (may be empty)

Respond with JSON only, no markdown:
{"flows":[{"id":"E01","name":"...","trigger":"...","steps":[{"actor":"...","action":"..."}],"acceptanceCriteria":["Given ..., when ..., then ..."],"rules":["BR-01"]}]}`;
  const text = await askText(prompt, 6000, timeout);
  try {
    const d = parseJson(text);
    if (Array.isArray(d.flows)) return d.flows;
  } catch {
    // fall through to salvage
  }
  const salvaged = salvageObjects(text);
  if (!salvaged.length) throw new Error("Flow batch response had no usable JSON");
  return salvaged;
}

// Writes the whole graph-based use case within the time budget (ms from now)
export async function writeGraphUseCase(opts: {
  requirement: string;
  title: string;
  structure: UseCaseStructure;
  budgetMs: number;
}): Promise<{ frame: UseCaseFrame; extensions: UseCaseExtension[] }> {
  const started = Date.now();
  const left = () => opts.budgetMs - (Date.now() - started);
  const full = opts.requirement.slice(0, 30_000);
  const excerpt = opts.requirement.slice(0, 12_000);

  // 1. Business rules (short call), so the frame and the flows can refer to them
  let businessRules: Array<{ id: string; rule: string }> = [];
  try {
    businessRules = await writeBusinessRules(full, Math.min(30_000, left() / 3));
  } catch (err) {
    console.error("Use case business rules failed:", err instanceof Error ? err.message : err);
  }

  // 2. Frame and all flows at the same time
  const timeout = Math.max(left() - 3_000, 8_000);
  const toWord = opts.structure.extensions.slice(0, MAX_WORDED_FLOWS);
  const batches: UseCaseExtension[][] = [];
  for (let i = 0; i < toWord.length; i += FLOWS_PER_BATCH) batches.push(toWord.slice(i, i + FLOWS_PER_BATCH));

  const [frameResult, ...flowResults] = await Promise.allSettled([
    writeFrame(full, opts.title, opts.structure, businessRules, timeout),
    ...batches.map((b) => writeFlowBatch(excerpt, opts.structure.mainRoute, businessRules, b, timeout)),
  ]);

  let frame: UseCaseFrame;
  if (frameResult.status === "fulfilled") {
    frame = frameResult.value as UseCaseFrame;
  } else {
    console.error("Use case frame failed, using the graph's own steps:", frameResult.reason instanceof Error ? frameResult.reason.message : frameResult.reason);
    frame = { ...generatedFrame(opts.title, opts.structure), businessRules };
  }
  const wording = flowResults.flatMap((r) => (r.status === "fulfilled" ? (r.value as any[]) : []));
  flowResults.forEach(
    (r) => r.status === "rejected" && console.error("Use case flow batch failed:", r.reason instanceof Error ? r.reason.message : r.reason)
  );
  // One more try for flows still missing, only when there is clearly time for it;
  // anything still missing keeps the generated text
  const done = new Set(wording.map((w: any) => String(w?.id ?? "").trim()));
  const missing = toWord.filter((x) => !done.has(x.id));
  const failed: UseCaseExtension[][] = [];
  for (let i = 0; i < missing.length; i += FLOWS_PER_BATCH) failed.push(missing.slice(i, i + FLOWS_PER_BATCH));
  if (failed.length && left() > 45_000) {
    const retryTimeout = left() - 3_000;
    const retried = await Promise.allSettled(failed.map((b) => writeFlowBatch(excerpt, opts.structure.mainRoute, businessRules, b, retryTimeout)));
    for (const r of retried) {
      if (r.status === "fulfilled") wording.push(...(r.value as any[]));
      else console.error("Use case flow batch retry failed:", r.reason instanceof Error ? r.reason.message : r.reason);
    }
  }

  return { frame, extensions: applyFlowWording(opts.structure.extensions, wording) };
}
