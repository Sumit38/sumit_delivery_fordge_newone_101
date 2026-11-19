import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { Anthropic } from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase-server";
import { findingsOf, latestRound } from "@/lib/qa-status";
import { buildUseCaseStructure } from "@/lib/use-case-flows";
import { writeGraphUseCase } from "@/lib/use-case-graph";

export const maxDuration = 120; // Vercel Hobby with Fluid compute allows up to 300 s

// maxDuration is 120 s. The use case is written in three parts at the same
// time (flows / value and quality / field rules); one call writing everything took too long
// for big requirements.
const PART_TIMEOUT_MS = 112_000;

function parseJsonText(raw: string): any {
  let jsonText = raw;
  // Remove markdown code blocks if present
  const jsonBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) jsonText = jsonBlockMatch[1];

  try {
    return JSON.parse(jsonText);
  } catch {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid use case data in response");
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Try repairing common JSON issues
      const repaired = jsonMatch[0]
        .replace(/,\s*}/g, "}") // Remove trailing commas before }
        .replace(/,\s*]/g, "]") // Remove trailing commas before ]
        .replace(/\n/g, "\\n"); // Escape newlines in strings
      return JSON.parse(repaired);
    }
  }
}

const COMMON_RULES = `- Be specific and detailed for the requirement provided
- Actors should be real roles (not generic)
- Keep each text value short (one sentence) so the whole JSON stays compact
- All fields should be non-empty and specific to the requirement
- Respond ONLY with valid JSON`;

function flowsPrompt(requirementText: string): string {
  return `You are a business analyst expert. Analyze the following requirement and write the flow part of a structured use case document in JSON format.

REQUIREMENT:
${requirementText}

Respond ONLY with valid JSON in this structure:
{
  "useCaseTitle": "A clear title for this use case",
  "description": "A 2-3 sentence executive summary of what this use case accomplishes",
  "actors": [
    { "name": "Actor Name", "role": "What this actor does in the use case" }
  ],
  "preconditions": ["Precondition 1", "Precondition 2"],
  "mainFlow": [
    { "step": 1, "actor": "Actor name", "action": "What the actor does" }
  ],
  "alternativeFlows": [
    {
      "name": "Alternative Flow Name",
      "trigger": "When this happens",
      "steps": [{ "step": 1, "actor": "Actor", "action": "Action" }]
    }
  ],
  "exceptionFlows": [
    { "name": "Exception Name", "trigger": "If this error occurs", "resolution": "Then do this" }
  ],
  "postconditions": ["System state after use case completes", "Data persisted"]
}

Rules:
${COMMON_RULES}
- Main flow should have 5-8 clear steps
- Include at least 2 alternative flows
- Include at least 1 exception flow`;
}

function valuePrompt(requirementText: string): string {
  return `You are a business analyst expert. Analyze the following requirement and write the business value, KPI and non-functional part of a use case document in JSON format.

REQUIREMENT:
${requirementText}

Respond ONLY with valid JSON in this structure:
{
  "businessValue": "Why this use case is important",
  "kpis": [
    { "metric": "KPI Name", "target": "Target value", "currentState": "Current baseline" }
  ],
  "nonFunctionalRequirements": [
    {
      "category": "Performance | Security | Availability | Scalability | Usability | Compliance | Data Retention & Audit",
      "requirement": "What the system must do, in one sentence",
      "measure": "Measurable target, e.g. 'Page responds in under 2 seconds for 95% of requests'",
      "priority": "Must | Should | Could",
      "source": "Stated | Assumed"
    }
  ]
}

Rules:
${COMMON_RULES}
- KPIs should be measurable and relevant
- nonFunctionalRequirements: 5-8 items covering at least Performance, Security and Availability. Every "measure" must be testable (a number, time, percentage or standard). Use "Stated" only when the requirement says it; otherwise use a sensible industry default and mark it "Assumed"`;
}

function fieldsPrompt(requirementText: string): string {
  return `You are a business analyst expert. Analyze the following requirement and list the input field validations for its use case document in JSON format.

REQUIREMENT:
${requirementText}

Respond ONLY with valid JSON in this structure:
{
  "fieldValidations": [
    {
      "screen": "Screen or form where the field appears",
      "field": "Field name",
      "type": "Text | Number | Email | Date | Dropdown | Checkbox | File | Password | Phone",
      "mandatory": true,
      "rules": "Validation rules: length, format, range, allowed values, uniqueness",
      "errorMessage": "Exact message shown to the user when the rule fails",
      "source": "Stated | Assumed"
    }
  ]
}

Rules:
${COMMON_RULES}
- List every input field the actors enter in the main and alternative flows (up to 15). If the requirement names no fields, infer the fields the flow clearly needs and mark them "Assumed". Error messages must be clear and polite, and tell the user how to fix the input`;
}

async function askJson(prompt: string, maxTokens: number, timeout: number) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });
  const response = await client.messages.create(
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    },
    { timeout, maxRetries: 0 }
  );
  return parseJsonText(response.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
}

// Use case built from the stored analysis graph: one extension per decision outcome,
// traceability to every path and its 2 test scenarios. Returns null when the analysis
// has no stored graph (older analyses), so the text-only use case is used instead.
async function graphUseCase(analysisId: string, userId: string, fallbackText: string, fallbackTitle: string) {
  const { data: requirement } = await supabaseServer
    .from("requirements")
    .select("id, title, document_text, complexity_results (analysis_data)")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  const analysis = requirement?.complexity_results?.[0]?.analysis_data;
  if (!analysis) return null;

  const structure = buildUseCaseStructure(analysis.paths, analysis.edges);
  if (!structure) return null;

  const requirementText = latestRound(String(requirement?.document_text || fallbackText));
  const title = String(requirement?.title || fallbackTitle || "Use case");
  console.log(
    `📄 Use case from graph: ${structure.mainRoute.length} main steps, ${structure.extensions.length} extensions, ${structure.coverage.paths} paths`
  );

  const budget = 105_000;
  const [graph, value, fields] = await Promise.allSettled([
    writeGraphUseCase({ requirement: requirementText, title, structure, budgetMs: budget }),
    askJson(valuePrompt(requirementText.slice(0, 30_000)), 3000, budget),
    askJson(fieldsPrompt(requirementText.slice(0, 30_000)), 3000, budget),
  ]);
  if (graph.status === "rejected") throw graph.reason;
  const { frame, extensions } = graph.value;
  const v = value.status === "fulfilled" ? value.value || {} : {};
  const fv = fields.status === "fulfilled" ? fields.value || {} : {};
  const list = (x: unknown) => (Array.isArray(x) ? x : []);
  const { conflicts, gaps } = findingsOf(analysis);
  const numbered = (steps: Array<{ actor: string; action: string }>) => steps.map((st, i) => ({ step: i + 1, ...st }));

  return {
    format: "graph",
    useCaseTitle: frame.useCaseTitle,
    description: frame.description,
    trigger: frame.trigger,
    primaryActor: frame.primaryActor,
    secondaryActors: frame.secondaryActors,
    stakeholders: frame.stakeholders,
    preconditions: frame.preconditions,
    mainSuccessScenario: frame.mainSteps,
    mainAcceptanceCriteria: frame.mainAcceptanceCriteria,
    mainPathId: structure.mainPathId,
    extensions,
    successPostconditions: frame.successPostconditions,
    failurePostconditions: frame.failurePostconditions,
    businessRules: frame.businessRules,
    assumptions: frame.assumptions,
    openQuestions: [...conflicts.map((c) => `Answer conflict: ${c}`), ...gaps.map((g) => `Requirement gap: ${g}`)].slice(0, 20),
    traceability: structure.traceability,
    coverage: structure.coverage,
    wording: {
      frame: frame.wording,
      flowsByAI: extensions.filter((x) => x.wording === "AI").length,
      flows: extensions.length,
    },
    // Same fields as the text-only use case, so older readers keep working
    actors: [frame.primaryActor, ...frame.secondaryActors],
    mainFlow: frame.mainSteps.map((st) => ({ step: st.step, actor: st.actor, action: st.action })),
    alternativeFlows: extensions
      .filter((x) => x.kind === "Alternative")
      .map((x) => ({ name: `${x.label}. ${x.name}`, trigger: x.trigger, steps: numbered(x.steps) })),
    exceptionFlows: extensions
      .filter((x) => x.kind === "Exception")
      .map((x) => ({ name: `${x.label}. ${x.name}`, trigger: x.trigger, resolution: x.steps.map((st) => st.action).join(" ") })),
    postconditions: frame.successPostconditions,
    businessValue: v.businessValue || "",
    kpis: list(v.kpis),
    nonFunctionalRequirements: list(v.nonFunctionalRequirements),
    fieldValidations: list(fv.fieldValidations),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const limited = checkRateLimit(auth.userId);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { requirementText } = body;
    const analysisId = typeof body?.analysisId === "string" ? body.analysisId : "";

    if (!requirementText) {
      return NextResponse.json(
        { error: "Requirement text is required" },
        { status: 400 }
      );
    }

    // With a stored analysis graph: comprehensive use case covering every decision and path
    if (analysisId) {
      try {
        const graphResult = await graphUseCase(analysisId, auth.userId, String(requirementText), String(body?.requirementTitle || ""));
        if (graphResult) return NextResponse.json({ success: true, data: graphResult });
      } catch (err) {
        console.error("Graph use case failed, using the text use case:", err instanceof Error ? err.message : err);
      }
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });

    const ask = async (prompt: string, maxTokens: number) => {
      const response = await client.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: maxTokens,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        },
        { timeout: PART_TIMEOUT_MS, maxRetries: 0 }
      );
      const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      return parseJsonText(text);
    };

    const [flows, value, fields] = await Promise.allSettled([
      ask(flowsPrompt(requirementText), 4000),
      ask(valuePrompt(requirementText), 3000),
      ask(fieldsPrompt(requirementText), 3000),
    ]);

    // The flows are the heart of the document: without them there is nothing useful to show
    if (flows.status === "rejected") {
      console.error("Use case flows failed:", flows.reason);
      return NextResponse.json(
        { error: "Could not write the use case in time. Please try again." },
        { status: 500 }
      );
    }
    if (value.status === "rejected") console.error("Use case value/NFR part failed:", value.reason);
    if (fields.status === "rejected") console.error("Use case field validations failed:", fields.reason);

    const f = flows.value || {};
    const v = value.status === "fulfilled" ? value.value || {} : {};
    const fv = fields.status === "fulfilled" ? fields.value || {} : {};
    const list = (x: unknown) => (Array.isArray(x) ? x : []);

    const useCaseData = {
      useCaseTitle: f.useCaseTitle,
      description: f.description || "",
      actors: list(f.actors),
      preconditions: list(f.preconditions),
      mainFlow: list(f.mainFlow),
      alternativeFlows: list(f.alternativeFlows).map((flow: any) => ({ ...flow, steps: list(flow?.steps) })),
      exceptionFlows: list(f.exceptionFlows),
      postconditions: list(f.postconditions),
      businessValue: v.businessValue || "",
      kpis: list(v.kpis),
      nonFunctionalRequirements: list(v.nonFunctionalRequirements),
      fieldValidations: list(fv.fieldValidations),
    };

    return NextResponse.json({
      success: true,
      data: useCaseData,
    });
  } catch (error) {
    console.error("Error generating use case QA:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
