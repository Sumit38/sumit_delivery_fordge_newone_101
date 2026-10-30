/**
 * The PRD's scoring rules, written independently of the app code so tests
 * can check the app against them (test oracle). Source: PRD FR-13, FR-16,
 * FR-17 and SS-2.
 */

export type AnalysisPath = 'assumption' | 'hybrid' | 'guided';
export type Band = 'Low' | 'Medium' | 'High' | 'Complex' | 'Very High';

/** FR-13: path from the number of VALID answers. */
export function expectedPath(validCount: number): AnalysisPath {
  if (validCount <= 0) return 'assumption';
  if (validCount < 8) return 'hybrid';
  return 'guided';
}

/** FR-16: M = E − N + 2P. */
export function expectedScore(edges: number, nodes: number, paths: number): number {
  return edges - nodes + 2 * paths;
}

/** FR-17: band depends on the path. */
export function expectedBand(path: AnalysisPath, score: number): Band {
  if (path === 'guided') {
    if (score < 10) return 'Low';
    if (score <= 20) return 'Medium';
    return 'Complex';
  }
  if (score <= 5) return 'Low';
  if (score <= 15) return 'Medium';
  if (score <= 30) return 'High';
  return 'Very High';
}

/** SS-2: reasons a result counts as abnormal. Empty array means sane. */
export function abnormalReasons(result: {
  nodes: number;
  edges: number;
  paths: number;
  score: number;
  path: AnalysisPath;
  band: string;
  usedBackup?: boolean;
}): string[] {
  const reasons: string[] = [];
  const counts = { nodes: result.nodes, edges: result.edges, paths: result.paths };
  for (const [name, value] of Object.entries(counts)) {
    if (!Number.isInteger(value)) reasons.push(`${name} is not a whole number (${value})`);
  }
  if (result.score < 1) reasons.push(`M is below 1 (${result.score})`);
  if (result.paths < 1) reasons.push(`P is below 1 (${result.paths})`);
  const computed = expectedScore(result.edges, result.nodes, result.paths);
  if (computed !== result.score) reasons.push(`M=${result.score} but E−N+2P=${computed}`);
  const band = expectedBand(result.path, result.score);
  if (band !== result.band) reasons.push(`band "${result.band}" should be "${band}" on the ${result.path} path`);
  if (result.path === 'guided' && result.usedBackup) reasons.push('Guided path fell back to the backup estimate');
  return reasons;
}
