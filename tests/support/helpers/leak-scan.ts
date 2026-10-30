/**
 * Confidentiality leak scan (PRD FR-22, NFR-13). Finds internal-only
 * information in text taken from a customer-facing output (Use Case,
 * customer estimate, user stories, pitch deck, customer timeline).
 *
 * Seed the analysis with distinctive values (for example M = 37) and pass
 * them as `knownValues`, so a leaked number is unmistakable.
 */

export type LeakFinding = { rule: string; match: string };

const FORBIDDEN_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  { rule: 'complexity score wording', pattern: /\b(cyclomatic|complexity score|complexity level)\b/i },
  { rule: 'formula', pattern: /M\s*=\s*E\s*[-−]\s*N\s*\+\s*2\s*P/i },
  { rule: 'formula variable', pattern: /\b[MENP]\s*=\s*\d+/ },
  { rule: 'band wording', pattern: /\b(low|medium|high|very high|complex)\s+complexity\b/i },
  { rule: 'confidence', pattern: /\bconfidence\b/i },
  { rule: 'analysis path', pattern: /\b(assumption|hybrid|guided)\s+path\b/i },
  { rule: 'inferred label', pattern: /\binferred\b/i },
  { rule: 'backup estimate', pattern: /\b(backup|fallback)\s+(estimate|analysis|calculation)\b/i },
];

export function scanForLeaks(text: string, knownValues: { score?: number; nodes?: number; edges?: number; paths?: number } = {}): LeakFinding[] {
  const findings: LeakFinding[] = [];

  for (const { rule, pattern } of FORBIDDEN_PATTERNS) {
    const match = text.match(pattern);
    if (match) findings.push({ rule, match: match[0] });
  }

  for (const [name, value] of Object.entries(knownValues)) {
    if (value === undefined) continue;
    const match = text.match(new RegExp(`(?<![\\d.])${value}(?![\\d.])`));
    if (match) findings.push({ rule: `seeded ${name} value`, match: match[0] });
  }

  return findings;
}
