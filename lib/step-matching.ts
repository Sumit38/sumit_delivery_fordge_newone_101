// Server-only: finds steps that mean the same thing in two documents but are worded
// differently ("on hold, request info" / "hold, request outstanding info"), so the
// combined graph counts them once and the region comparison lines up.
// The AI only suggests pairs; code checks every pair (one-to-one, real labels,
// never two steps of the same document). If the call fails, exact names are used.
import Anthropic from "@anthropic-ai/sdk";
import { stepKey } from "./merge-analyses";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });
const MATCH_TIMEOUT_MS = 45_000;

export interface StepMatch {
  doc: number; // the later document
  step: string; // its wording
  matchedDoc: number; // the earlier document it was matched to
  matchedStep: string;
}

const isTerminal = (s: string) => /^(start|end)$/i.test(String(s).trim());

export interface MatchInputDocument {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "into", "this", "that", "step", "case"]);

// Word stems of a step name ("Provide approval, notify" -> prov, appr, noti)
function stems(label: string): Set<string> {
  return new Set(
    String(label)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
      .map((w) => w.slice(0, 4))
  );
}

// Code checks on an AI-suggested pair: a decision only matches a decision, an action
// only an action, and the two names must share at least one word.
export function plausibleMatch(a: string, aIsDecision: boolean, b: string, bIsDecision: boolean): boolean {
  if (aIsDecision !== bIsDecision) return false;
  const sa = stems(a);
  return [...stems(b)].some((w) => sa.has(w));
}

function decisionKeys(doc: MatchInputDocument): Set<string> {
  const out = new Map<string, number>();
  (doc.edges || []).forEach((e) => out.set(stepKey(e.from), (out.get(stepKey(e.from)) || 0) + 1));
  return new Set([...out.entries()].filter(([, c]) => c > 1).map(([k]) => k));
}

// Returns the aliases for mergeAnalyses and the matched pairs to show the user.
export async function matchSteps(input: MatchInputDocument[]): Promise<{ aliases: Record<string, string>; matches: StepMatch[]; failed: boolean }> {
  const docNodes = input.map((d) => d.nodes || []);
  const decisions = input.map(decisionKeys);
  const aliases: Record<string, string> = {};
  const matches: StepMatch[] = [];
  let failed = false;

  // key -> { doc, label, decision } for every step already in the combined graph
  const known = new Map<string, { doc: number; label: string; decision: boolean }>();
  const unique = (labels: string[]) => {
    const seen = new Map<string, string>();
    labels.forEach((l) => {
      const label = String(l).replace(/\s+/g, " ").trim();
      if (label && !isTerminal(label) && !seen.has(stepKey(label))) seen.set(stepKey(label), label);
    });
    return seen;
  };
  unique(docNodes[0] || []).forEach((label, key) => known.set(key, { doc: 0, label, decision: decisions[0].has(key) }));

  for (let d = 1; d < docNodes.length; d++) {
    const own = unique(docNodes[d] || []);
    // Exact names already match; only the rest need the AI
    const ownUnmatched = [...own.entries()].filter(([key]) => !known.has(key));
    const targets = [...known.entries()].filter(([key]) => !own.has(key));

    if (ownUnmatched.length && targets.length) {
      const pairs = await askForPairs(
        targets.map(([, t]) => t.label),
        ownUnmatched.map(([, label]) => label)
      );
      if (pairs === null) failed = true;
      const usedTargets = new Set<number>();
      const usedOwn = new Set<number>();
      for (const [b, a] of pairs || []) {
        if (!ownUnmatched[b] || !targets[a] || usedOwn.has(b) || usedTargets.has(a)) continue;
        const [ownKey, ownLabel] = ownUnmatched[b];
        const [targetKey, target] = targets[a];
        if (!plausibleMatch(target.label, target.decision, ownLabel, decisions[d].has(ownKey))) continue;
        usedOwn.add(b);
        usedTargets.add(a);
        aliases[ownKey] = targetKey;
        matches.push({ doc: d, step: ownLabel, matchedDoc: target.doc, matchedStep: target.label });
      }
    }

    own.forEach((label, key) => {
      if (!known.has(key) && !aliases[key]) known.set(key, { doc: d, label, decision: decisions[d].has(key) });
    });
  }

  return { aliases, matches, failed };
}

// Asks for [indexInB, indexInA] pairs. Returns null when the call fails.
async function askForPairs(listA: string[], listB: string[]): Promise<Array<[number, number]> | null> {
  const numbered = (list: string[]) => list.map((s, i) => `${i}. ${s}`).join("\n");
  try {
    const response = await anthropic.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `Two process flows describe the same business process in different regions. Match the steps of list B to steps of list A that are the SAME activity or decision, only worded differently.

LIST A:
${numbered(listA)}

LIST B:
${numbered(listB)}

Rules:
- Match only when they are clearly the same activity or the same decision, done for the same purpose. Being at a similar place in the flow is not enough; similar but different work is not a match.
- A decision only matches a decision; an action only matches an action.
- Each step is used at most once. Leave a step unmatched when in doubt.

Reply with JSON only: [[B number, A number], ...] or [] if none match.`,
          },
        ],
      },
      { timeout: MATCH_TIMEOUT_MS, maxRetries: 0 }
    );
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) return [];
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed)
      ? parsed.filter((p): p is [number, number] => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]))
      : [];
  } catch (err) {
    console.warn("⚠️ Step matching failed; using exact step names only:", err instanceof Error ? err.message : err);
    return null;
  }
}
