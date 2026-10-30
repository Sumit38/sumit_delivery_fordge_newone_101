import { describe, expect, it } from 'vitest';
import { parseCompactGraph, createTimeoutFallback } from '@/lib/complexity-analyzer';

/**
 * Claude answers the complexity prompt in a compact ID format so the reply stays
 * short enough for Vercel's 60s limit. These tests cover how that answer is read.
 */

const ANSWER = `REASONING:
Two checks create branches.

NODES:
START | Start
N1 | Detect file
N2 | Duplicate?
N3 | Store file
N4 | Reject duplicate
END | End

EDGES:
START > N1 | file arrives
N1 > N2 | detected
N2 > N3 | new file
N2 > N4 | duplicate
N3 > END | stored
N4 > END | rejected

PATHS:
P1: START, N1, N2, N3, END
P2: START, N1, N2, N4, END

CALCULATION:
N = 6
E = 6
P = 2
M = E - N + 2P = 6 - 6 + 4 = 4`;

describe('parseCompactGraph', () => {
  it('turns IDs back into labels for nodes, edges and paths', () => {
    const g = parseCompactGraph(ANSWER)!;
    expect(g.nodes).toEqual(['Start', 'Detect file', 'Duplicate?', 'Store file', 'Reject duplicate', 'End']);
    expect(g.edges).toContainEqual({ from: 'Duplicate?', to: 'Reject duplicate', condition: 'duplicate' });
    expect(g.paths).toEqual([
      ['Start', 'Detect file', 'Duplicate?', 'Store file', 'End'],
      ['Start', 'Detect file', 'Duplicate?', 'Reject duplicate', 'End'],
    ]);
    expect(g.stated).toEqual({ n: 6, e: 6, p: 2, m: 4 });
  });

  it('copes with markdown bullets/bold and repeated section headers', () => {
    const messy = ANSWER.replace('NODES:\nSTART', '**NODES:**\n- START')
      .replace('CALCULATION:', 'NODES:\nN = 4\n\nCALCULATION:');
    const g = parseCompactGraph(messy)!;
    expect(g.nodes).toHaveLength(6); // the repeated "NODES:" header must not wipe the list
    expect(g.stated.n).toBe(4);
  });

  it('drops duplicate paths and paths that do not run Start to End', () => {
    const g = parseCompactGraph(ANSWER.replace('P2: START, N1, N2, N4, END', 'P2: START, N1, N2, N4, END\nP3: START, N1, N2, N3, END\nP4: N1, N2, N3, END'))!;
    expect(g.paths).toHaveLength(2);
  });

  it('adds an edge that a path uses but the edge list left out', () => {
    const g = parseCompactGraph(ANSWER.replace('N3 > END | stored\n', ''))!;
    expect(g.edges).toContainEqual({ from: 'Store file', to: 'End', condition: 'implied by path' });
    expect(g.edges).toHaveLength(6);
  });

  it('returns null for an answer that is not in the compact format', () => {
    expect(parseCompactGraph('NODES:\n- Start\n- End\nEDGES:\n- Start -> End')).toBeNull();
  });
});

describe('createTimeoutFallback', () => {
  it('builds a graph from the requirement text instead of a generic template', () => {
    const text =
      'The customer uploads a file. If the file is a duplicate the system rejects it. ' +
      'If validation fails the system notifies the operations team, otherwise it stores the file and hands it off.\n' +
      'Q: How?\nA: Selected: SFTP\n'.repeat(9);
    const r = createTimeoutFallback(text);
    expect(r.nodes).not.toEqual(['Start', 'Input', 'Process', 'Output', 'End']);
    expect(r.complexityScore).toBe(r.edgesCount - r.nodesCount + 2 * r.alternativePaths);
    expect(r.confidenceScore).toBeLessThanOrEqual(60);
    expect(r.confidenceReason).toContain('9/15');
    expect(r.analysis).toContain('did not finish in time');
  });
});
