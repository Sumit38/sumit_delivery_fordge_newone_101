// Architecture design built on the analysis graph. Pure functions, no AI calls.
// - graphFacts: the steps of the requirement's graph, what kind of work each looks like
//   (integration, data, notification, ...) and how many points it carries.
// - normalizeDesign: makes the AI's design safe to use (known types, valid step numbers).
// - traceability / sizing: every graph step is delivered by a component; development effort
//   is the sum of the points of the steps each component delivers.
// - architectureMermaid: the layered diagram, drawn by code (no AI-written diagram syntax).

export interface GraphEdge {
  from: string;
  to: string;
  condition?: string;
}

export type StepKind = "integration" | "data" | "notification" | "input" | "approval" | "report" | "ai" | "security" | "logic";

export interface GraphStep {
  no: number; // 1-based, as shown to the AI and the user
  label: string;
  decision: boolean;
  outcomes: number; // outgoing branches
  kinds: StepKind[];
  points: number; // 1 per step + 1 per extra branch (the decision's share of McCabe's M)
}

export interface GraphFacts {
  steps: GraphStep[];
  decisions: number;
  totalPoints: number;
  byKind: Record<StepKind, number[]>; // step numbers per kind
  paths: number;
}

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const isTerminal = (s: string) => /^(start|end)$/i.test(s);

const KIND_PATTERNS: Array<[StepKind, RegExp]> = [
  ["integration", /\b(api|integrat\w*|sync\w*|interface|import\w*|export\w*|webhook|third[- ]party|external|vendor system|sap|crm|erp|salesforce|servicenow|gateway|feed|upload\w*|download\w*|transfer\w*|fetch\w*|call\w* (the )?\w+ (service|system))\b/i],
  ["data", /\b(store\w*|save\w*|record\w*|database|persist\w*|update\w*|create\w* (a |the )?(record|entry|ticket|request)|archive\w*|log\w*|master data|migrat\w*|retain\w*|retention)\b/i],
  ["notification", /\b(notif\w*|email\w*|e-mail|sms|alert\w*|remind\w*|message\w*|inform\w*|escalat\w*)\b/i],
  ["input", /\b(enter\w*|submit\w*|fill\w*|form|select\w*|upload\w*|request\w*|register\w*|log ?in|sign ?in|input|capture\w*)\b/i],
  ["approval", /\b(approv\w*|reject\w*|review\w*|sign[- ]off|authori[sz]\w*|consent)\b/i],
  ["report", /\b(report\w*|dashboard\w*|analytic\w*|kpi|metric\w*|insight\w*|summar\w*|visuali[sz]\w*)\b/i],
  ["ai", /\b(ai|ml|machine learning|llm|model|predict\w*|classif\w*|recommend\w*|agent|chatbot|nlp|ocr)\b/i],
  ["security", /\b(authenticat\w*|password|otp|mfa|sso|permission\w*|role\w*|access|encrypt\w*|mask\w*|audit\w*|compliance|gdpr|pii)\b/i],
];

export function stepKinds(label: string): StepKind[] {
  const kinds = KIND_PATTERNS.filter(([, re]) => re.test(label)).map(([k]) => k);
  return kinds.length ? kinds : ["logic"];
}

export function graphFacts(nodesIn: unknown, edgesIn: unknown, pathsIn?: unknown): GraphFacts | null {
  const edges: GraphEdge[] = (Array.isArray(edgesIn) ? edgesIn : [])
    .filter((e: any) => e && e.from && e.to)
    .map((e: any) => ({ from: norm(e.from), to: norm(e.to), condition: norm(e.condition) }));
  const labels: string[] = [];
  const add = (s: string) => s && !isTerminal(s) && !labels.includes(s) && labels.push(s);
  for (const n of Array.isArray(nodesIn) ? nodesIn : []) add(norm(typeof n === "string" ? n : (n as any)?.label ?? (n as any)?.id));
  for (const e of edges) {
    add(e.from);
    add(e.to);
  }
  if (!labels.length) return null;

  const out = new Map<string, Set<string>>();
  for (const e of edges) {
    const set = out.get(e.from) || new Set<string>();
    set.add(e.to);
    out.set(e.from, set);
  }
  const byKind = Object.fromEntries(KIND_PATTERNS.map(([k]) => [k, [] as number[]]).concat([["logic", []]])) as Record<StepKind, number[]>;
  const steps: GraphStep[] = labels.map((label, i) => {
    const outcomes = out.get(label)?.size || 0;
    const decision = outcomes > 1;
    const kinds = stepKinds(label);
    kinds.forEach((k) => byKind[k].push(i + 1));
    return { no: i + 1, label, decision, outcomes, kinds, points: 1 + Math.max(0, outcomes - 1) };
  });
  return {
    steps,
    decisions: steps.filter((s) => s.decision).length,
    totalPoints: steps.reduce((sum, s) => sum + s.points, 0),
    byKind,
    paths: Array.isArray(pathsIn) ? pathsIn.length : 0,
  };
}

// Short text of the graph for prompts: numbered steps with their kind
export function factsForPrompt(facts: GraphFacts, maxSteps = 120): string {
  return facts.steps
    .slice(0, maxSteps)
    .map((s) => `${s.no}. ${s.label}${s.decision ? ` [decision, ${s.outcomes} outcomes]` : ""}${s.kinds[0] !== "logic" ? ` (${s.kinds.join(", ")})` : ""}`)
    .join("\n");
}

// ---------- Questions and answers ----------

export interface ArchQuestion {
  id: string; // Q1..
  topic: string;
  question: string;
  why: string;
  basedOnSteps: number[];
  options: string[];
  multiple: boolean;
  suggested: string[];
}

export interface ArchAnswer {
  id: string;
  topic: string;
  question: string;
  answer: string[]; // empty = skipped
  note?: string;
}

export function normalizeQuestions(raw: unknown, stepCount: number): ArchQuestion[] {
  const list = Array.isArray((raw as any)?.questions) ? (raw as any).questions : Array.isArray(raw) ? raw : [];
  return list
    .map((q: any, i: number): ArchQuestion => {
      const options = (Array.isArray(q?.options) ? q.options : []).map(norm).filter(Boolean).slice(0, 8);
      const suggested = (Array.isArray(q?.suggested) ? q.suggested : [q?.suggested]).map(norm).filter((s: string) => options.includes(s));
      return {
        id: `Q${i + 1}`,
        topic: norm(q?.topic) || "Architecture",
        question: norm(q?.question),
        why: norm(q?.why),
        basedOnSteps: validSteps(q?.basedOnSteps, stepCount).slice(0, 8),
        options,
        multiple: Boolean(q?.multiple),
        suggested: q?.multiple ? suggested : suggested.slice(0, 1),
      };
    })
    .filter((q: ArchQuestion) => q.question && q.options.length >= 2)
    .slice(0, 12);
}

// ---------- Design ----------

// Component types match the estimation work areas (lib/estimation-team.ts WORKSTREAMS)
export const COMPONENT_TYPES = ["ui", "backend", "database", "integration", "ai", "mobile", "devops"] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];
export const LAYERS = ["channel", "application", "integration", "data", "platform"] as const;
export type Layer = (typeof LAYERS)[number];

export const LAYER_LABELS: Record<Layer, string> = {
  channel: "Users & channels",
  application: "Application",
  integration: "Integrations & external systems",
  data: "Data",
  platform: "Platform & operations",
};

export interface ArchComponent {
  id: string; // C1..
  name: string;
  type: ComponentType;
  layer: Layer;
  technology: string;
  responsibilities: string;
  steps: number[]; // graph steps it delivers
  external: boolean; // an existing / third-party system (not built by the team)
}

export interface ArchConnection {
  from: string; // component id
  to: string;
  label: string;
}

export interface ArchDecision {
  decision: string;
  choice: string;
  reason: string;
  basedOn: string[]; // question ids
}

export interface ArchRisk {
  risk: string;
  impact: "High" | "Medium" | "Low";
  likelihood: "High" | "Medium" | "Low";
  mitigation: string;
  steps: number[];
}

export interface ArchDesign {
  title: string;
  summary: string;
  components: ArchComponent[];
  connections: ArchConnection[];
  decisions: ArchDecision[];
  risks: ArchRisk[];
  sections: { integration: string; data: string; security: string; nfr: string; deployment: string };
  assumptions: string[];
  openQuestions: string[];
  steps: Array<{ no: number; label: string; points: number }>; // the graph steps the design was made for
}

export function validSteps(v: unknown, stepCount: number): number[] {
  const list = Array.isArray(v) ? v : [];
  const out: number[] = [];
  for (const x of list) {
    const n = Math.round(Number(String(x).replace(/^\D+/, "")));
    if (Number.isFinite(n) && n >= 1 && n <= stepCount && !out.includes(n)) out.push(n);
  }
  return out;
}

const level = (v: unknown): "High" | "Medium" | "Low" => {
  const s = norm(v).toLowerCase();
  return s.startsWith("h") ? "High" : s.startsWith("l") ? "Low" : "Medium";
};

export function normalizeStructure(raw: any, stepCount: number): { components: ArchComponent[]; connections: ArchConnection[] } {
  const rawComponents = Array.isArray(raw?.components) ? raw.components : [];
  const idMap = new Map<string, string>();
  const components: ArchComponent[] = [];
  rawComponents.slice(0, 30).forEach((c: any) => {
    const name = norm(c?.name);
    if (!name) return;
    const id = `C${components.length + 1}`;
    idMap.set(norm(c?.id) || name, id);
    idMap.set(name, id);
    const type = (COMPONENT_TYPES as readonly string[]).includes(norm(c?.type)) ? (norm(c?.type) as ComponentType) : "backend";
    const layer = (LAYERS as readonly string[]).includes(norm(c?.layer)) ? (norm(c?.layer) as Layer) : defaultLayer(type);
    components.push({
      id,
      name,
      type,
      layer,
      technology: norm(c?.technology),
      responsibilities: norm(c?.responsibilities),
      steps: validSteps(c?.steps, stepCount),
      external: Boolean(c?.external),
    });
  });
  const connections: ArchConnection[] = [];
  for (const k of Array.isArray(raw?.connections) ? raw.connections.slice(0, 60) : []) {
    const from = idMap.get(norm(k?.from));
    const to = idMap.get(norm(k?.to));
    if (from && to && from !== to && !connections.some((x) => x.from === from && x.to === to)) {
      connections.push({ from, to, label: norm(k?.label).slice(0, 40) });
    }
  }
  return { components, connections };
}

function defaultLayer(type: ComponentType): Layer {
  if (type === "ui" || type === "mobile") return "channel";
  if (type === "database") return "data";
  if (type === "integration") return "integration";
  if (type === "devops") return "platform";
  return "application";
}

export function normalizeNarrative(raw: any, stepCount: number, questionIds: string[]) {
  const strings = (v: unknown, max = 15) => (Array.isArray(v) ? v.map(norm).filter(Boolean).slice(0, max) : []);
  const sections = raw?.sections || {};
  return {
    title: norm(raw?.title),
    summary: norm(raw?.summary),
    decisions: (Array.isArray(raw?.decisions) ? raw.decisions : [])
      .map((d: any) => ({
        decision: norm(d?.decision),
        choice: norm(d?.choice),
        reason: norm(d?.reason),
        basedOn: strings(d?.basedOn, 6).map((x) => x.toUpperCase()).filter((x) => questionIds.includes(x)),
      }))
      .filter((d: ArchDecision) => d.decision && d.choice)
      .slice(0, 15) as ArchDecision[],
    risks: (Array.isArray(raw?.risks) ? raw.risks : [])
      .map((r: any) => ({
        risk: norm(r?.risk),
        impact: level(r?.impact),
        likelihood: level(r?.likelihood),
        mitigation: norm(r?.mitigation),
        steps: validSteps(r?.steps, stepCount).slice(0, 10),
      }))
      .filter((r: ArchRisk) => r.risk)
      .slice(0, 15) as ArchRisk[],
    sections: {
      integration: norm(sections.integration),
      data: norm(sections.data),
      security: norm(sections.security),
      nfr: norm(sections.nfr),
      deployment: norm(sections.deployment),
    },
    assumptions: strings(raw?.assumptions),
    openQuestions: strings(raw?.openQuestions),
  };
}

// ---------- Traceability and sizing ----------

export interface TraceRow {
  no: number;
  label: string;
  points: number;
  components: string[]; // component ids
}

export function traceability(design: Pick<ArchDesign, "components" | "steps">): { rows: TraceRow[]; unassigned: number[] } {
  const rows = design.steps.map((s) => ({
    no: s.no,
    label: s.label,
    points: s.points,
    components: design.components.filter((c) => !c.external && c.steps.includes(s.no)).map((c) => c.id),
  }));
  return { rows, unassigned: rows.filter((r) => !r.components.length).map((r) => r.no) };
}

// ---------- Estimated build hours (task list per component) ----------
// The AI proposes the tasks needed to build each component, with low / likely / high hours for
// one mid-level developer who knows the technology; the user can edit every figure. Testing,
// analysis and project management are not in these tasks (the estimation adds them).

export interface EffortTask {
  id: string; // T1..
  component: string; // component id (C1..)
  task: string;
  steps: number[]; // graph steps the task serves
  low: number;
  likely: number;
  high: number;
  edited?: boolean; // changed by the user after the AI proposed it
}

export interface ArchEffort {
  tasks: EffortTask[];
  generatedAt: string;
  editedAt?: string | null;
  missingComponents?: string[]; // components the AI could not estimate
}

const hours = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 2) / 2, 2000) : 0;
};

// Cleans AI or user tasks: known component, text, low ≤ likely ≤ high (missing low/high get a
// default spread), at most 15 tasks per component
export function normalizeEffortTasks(raw: unknown, design: Pick<ArchDesign, "components" | "steps">): EffortTask[] {
  const built = design.components.filter((c) => !c.external);
  const byKey = new Map<string, string>();
  for (const c of built) {
    byKey.set(c.id.toUpperCase(), c.id);
    byKey.set(c.name.toLowerCase(), c.id);
  }
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.tasks) ? (raw as any).tasks : [];
  const perComponent = new Map<string, number>();
  const out: EffortTask[] = [];
  // Keep a task's id across edits; new tasks get the next free number
  const used = new Set<string>();
  let next = 1 + Math.max(0, ...list.map((t: any) => Number(/^T(\d+)$/.exec(String(t?.id ?? ""))?.[1]) || 0));
  for (const t of list.slice(0, 400)) {
    const key = norm(t?.component);
    const component = byKey.get(key.toUpperCase()) || byKey.get(key.toLowerCase());
    const task = norm(t?.task).slice(0, 200);
    let likely = hours(t?.likely);
    if (!component || !task || !likely) continue;
    if ((perComponent.get(component) || 0) >= 15) continue;
    perComponent.set(component, (perComponent.get(component) || 0) + 1);
    let low = hours(t?.low) || Math.round(likely * 0.8 * 2) / 2;
    let high = hours(t?.high) || Math.round(likely * 1.4 * 2) / 2;
    if (low > likely) low = likely;
    if (high < likely) high = likely;
    likely = Math.max(low, Math.min(likely, high));
    const given = String(t?.id ?? "");
    const id = /^T\d+$/.test(given) && !used.has(given) ? given : `T${next++}`;
    used.add(id);
    out.push({
      id,
      component,
      task,
      steps: validSteps(t?.steps, design.steps.length),
      low,
      likely,
      high,
      ...(t?.edited ? { edited: true } : {}),
    });
  }
  return out;
}

export interface ComponentEffort {
  id: string;
  name: string;
  type: ComponentType;
  technology: string;
  steps: number[];
  tasks: number;
  low: number;
  likely: number;
  high: number;
}

export interface EffortSizing {
  components: ComponentEffort[]; // built components that have tasks
  withoutTasks: string[]; // names of built components with no task
  byType: Record<string, number>; // likely hours per component type (work area)
  low: number;
  likely: number;
  high: number;
  taskCount: number;
  edited: boolean;
}

const sum1 = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

export function effortSizing(design: Pick<ArchDesign, "components">, effort: ArchEffort | null | undefined): EffortSizing {
  const tasks = effort?.tasks || [];
  const built = design.components.filter((c) => !c.external);
  const components: ComponentEffort[] = [];
  const withoutTasks: string[] = [];
  for (const c of built) {
    const mine = tasks.filter((t) => t.component === c.id);
    if (!mine.length) {
      withoutTasks.push(c.name);
      continue;
    }
    components.push({
      id: c.id,
      name: c.name,
      type: c.type,
      technology: c.technology,
      steps: c.steps,
      tasks: mine.length,
      low: sum1(mine.map((t) => t.low)),
      likely: sum1(mine.map((t) => t.likely)),
      high: sum1(mine.map((t) => t.high)),
    });
  }
  const byType: Record<string, number> = {};
  for (const c of components) byType[c.type] = sum1([byType[c.type] || 0, c.likely]);
  return {
    components,
    withoutTasks,
    byType,
    low: sum1(components.map((c) => c.low)),
    likely: sum1(components.map((c) => c.likely)),
    high: sum1(components.map((c) => c.high)),
    taskCount: components.reduce((s, c) => s + c.tasks, 0),
    edited: tasks.some((t) => t.edited),
  };
}

// The technology a component is built with, as one familiarity question in the estimation
export const technologyKey = (c: Pick<ArchComponent, "technology" | "type">) =>
  (c.technology || `${c.type} (technology not named)`).replace(/\s+/g, " ").trim().slice(0, 80);

// ---------- Diagram ----------

const mmText = (s: string, max = 40) =>
  (s.length > max ? `${s.slice(0, max - 1)}…` : s).replace(/["<>{}[\]|#;`]/g, " ").replace(/\s+/g, " ").trim();

export function architectureMermaid(design: Pick<ArchDesign, "components" | "connections">): string {
  const lines = ["flowchart TB"];
  for (const layer of LAYERS) {
    const members = design.components.filter((c) => c.layer === layer);
    if (!members.length) continue;
    lines.push(`  subgraph L_${layer}["${LAYER_LABELS[layer]}"]`);
    for (const c of members) {
      const tech = c.technology ? `\\n${mmText(c.technology, 30)}` : "";
      const text = `${mmText(c.name)}${tech}`;
      // Shape follows what the component is: stores are cylinders, external systems rounded
      lines.push(c.type === "database" ? `    ${c.id}[("${text}")]` : c.external ? `    ${c.id}("${text}")` : `    ${c.id}["${text}"]`);
    }
    lines.push("  end");
  }
  // Many labelled lines make the picture unreadable; the document lists every connection anyway
  const labelled = design.connections.length <= 14;
  for (const k of design.connections) {
    lines.push(labelled && k.label ? `  ${k.from} -->|"${mmText(k.label, 25)}"| ${k.to}` : `  ${k.from} --> ${k.to}`);
  }
  const ext = design.components.filter((c) => c.external).map((c) => c.id);
  if (ext.length) {
    lines.push("  classDef external fill:#f1f5f9,stroke:#64748b,stroke-dasharray: 4 3");
    lines.push(`  class ${ext.join(",")} external`);
  }
  return lines.join("\n");
}
