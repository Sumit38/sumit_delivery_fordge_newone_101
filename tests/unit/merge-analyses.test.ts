import { describe, expect, it } from 'vitest';
import { mergeAnalyses, stepKey } from '@/lib/merge-analyses';
import { buildFlowMermaid } from '@/lib/flow-diagram';

// Document A: login with a valid/invalid branch (N=5, E=5, P=2, M=4)
const A = {
  title: 'Login',
  nodes: ['Start', 'Enter credentials', 'Valid?', 'Show dashboard', 'End'],
  edges: [
    { from: 'Start', to: 'Enter credentials' },
    { from: 'Enter credentials', to: 'Valid?' },
    { from: 'Valid?', to: 'Show dashboard', condition: 'valid' },
    { from: 'Valid?', to: 'End', condition: 'invalid' },
    { from: 'Show dashboard', to: 'End' },
  ],
  paths: [
    ['Start', 'Enter credentials', 'Valid?', 'Show dashboard', 'End'],
    ['Start', 'Enter credentials', 'Valid?', 'End'],
  ],
};

// Document B: payment, shares "Enter Credentials " with A (different case/spacing)
const B = {
  title: 'Payment',
  nodes: ['Start', 'Enter Credentials ', 'Pay', 'Paid?', 'End'],
  edges: [
    { from: 'Start', to: 'Enter Credentials ' },
    { from: 'Enter Credentials ', to: 'Pay' },
    { from: 'Pay', to: 'Paid?' },
    { from: 'Paid?', to: 'End', condition: 'yes' },
    { from: 'Paid?', to: 'Pay', condition: 'retry' },
  ],
  paths: [['Start', 'Enter Credentials ', 'Pay', 'Paid?', 'End']],
};

describe('mergeAnalyses', () => {
  it('joins graphs on Start/End and same-named steps, then applies M = E - N + 2P', () => {
    const r = mergeAnalyses([A, B]);
    // Start, Enter credentials, Valid?, Show dashboard, Pay, Paid?, End
    expect(r.n).toBe(7);
    // A's 5 edges + B's 4 new ones (Start -> Enter credentials is shared)
    expect(r.e).toBe(9);
    expect(r.p).toBe(3);
    expect(r.m).toBe(9 - 7 + 2 * 3);
    expect(r.testScenarios).toBe(6);
    expect(r.calculation).toBe('M = E - N + 2P = 9 - 7 + 2(3) = 8');
    expect(r.sharedSteps).toEqual(['Enter credentials']);
    expect(r.nodes[0]).toBe('Start');
    expect(r.nodes[r.nodes.length - 1]).toBe('End');
  });

  it('keeps each document\'s own score for the comparison table', () => {
    const r = mergeAnalyses([
      { ...A, nodesCount: 5, edgesCount: 5, pathsCount: 2, complexityScore: 4 },
      { ...B, nodesCount: 5, edgesCount: 5, pathsCount: 1, complexityScore: 2 },
    ]);
    expect(r.documents.map((d) => [d.title, d.m])).toEqual([['Login', 4], ['Payment', 2]]);
  });

  it('counts the same document twice only once', () => {
    const r = mergeAnalyses([A, { ...A, title: 'Login copy' }]);
    expect([r.n, r.e, r.p]).toEqual([5, 5, 2]);
    expect(r.m).toBe(4);
  });

  it('adds edges that a path uses but no document listed', () => {
    const r = mergeAnalyses([A, { title: 'C', nodes: ['Start', 'Audit', 'End'], edges: [{ from: 'Start', to: 'Audit' }], paths: [['Start', 'Audit', 'End']] }]);
    expect(r.edges).toContainEqual({ from: 'Audit', to: 'End', condition: 'implied by path' });
  });

  it('produces a Mermaid graph with every merged edge exactly once', () => {
    const r = mergeAnalyses([A, B]);
    const code = buildFlowMermaid(r.nodes, r.edges);
    expect(code.match(/-->/g)).toHaveLength(r.e);
  });

  it('needs at least two documents', () => {
    expect(() => mergeAnalyses([A])).toThrow();
  });

  it('matches step names ignoring case, spacing and trailing punctuation', () => {
    expect(stepKey(' Validate  Order. ')).toBe(stepKey('validate order'));
    expect(stepKey('START')).toBe('start');
  });
});
