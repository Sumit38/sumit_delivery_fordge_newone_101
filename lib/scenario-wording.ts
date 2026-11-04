// Server-only: asks the AI to write the wording for path-based test scenarios.
// The scenarios themselves (IDs, routes, decision outcomes, count) are fixed by code.
import Anthropic from "@anthropic-ai/sdk";
import type { PathScenario } from "./path-scenarios";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Paths per wording request; batches run in parallel so large analyses stay within the time limit
export const PATHS_PER_BATCH = 3;
const WORDING_TIMEOUT_MS = 40_000;

export type ScenarioWording = {
  id?: unknown;
  name?: unknown;
  actors?: unknown;
  preconditions?: unknown;
  steps?: unknown;
  expectedResult?: unknown;
};

// Words all scenarios in parallel batches. A failed batch returns nothing, and those
// scenarios keep the wording generated from their path.
export async function writeScenarioWording(requirementText: string, scenarios: PathScenario[]): Promise<ScenarioWording[]> {
  const batches: PathScenario[][] = [];
  for (let i = 0; i < scenarios.length; i += PATHS_PER_BATCH * 2) {
    batches.push(scenarios.slice(i, i + PATHS_PER_BATCH * 2));
  }
  const results = await Promise.all(batches.map((batch) => wordBatch(requirementText, batch)));
  return results.flat();
}

async function wordBatch(requirementText: string, batch: PathScenario[]): Promise<ScenarioWording[]> {
  const list = batch
    .map(
      (s) =>
        `${s.id} (${s.kind}) | route: ${s.route.join(" -> ")} | decision outcomes: ${
          s.decisionOutcomes.join("; ") || "none"
        }`
    )
    .join("\n");

  try {
    const response = await anthropic.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 6000,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `Write test scenario wording for the scenarios below. Each scenario follows one fixed route through the requirement's flow.

REQUIREMENT:
${requirementText}

SCENARIOS (keep exactly these IDs; do not add, drop or merge any):
${list}

Rules:
- Positive (+): valid data that makes every decision take the listed outcome; the route completes as intended.
- Negative (-): tests the SAME decision points with invalid, missing or boundary data (for example an approval with a missing approver, metadata just outside the rule). The system must NOT wrongly produce this route's outcome; it must show the correct error or take the correct other branch. Do not describe a different route's happy flow.
- Steps follow the route in order, use concrete details from the requirement (roles, data, systems), at most 8 steps of at most 20 words each.
- Expected result: one or two sentences, specific and measurable.

Reply with JSON only, no other text:
[{"id":"P1+","name":"short title","actors":["role"],"preconditions":["..."],"steps":["..."],"expectedResult":"..."}]`,
          },
        ],
      },
      { timeout: WORDING_TIMEOUT_MS, maxRetries: 0 }
    );
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) return [];
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(
      "⚠️ Scenario wording batch failed; keeping the wording generated from the path:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
