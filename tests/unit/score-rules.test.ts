import { describe, expect, it } from 'vitest';
import { abnormalReasons, expectedBand, expectedPath, expectedScore } from '../support/helpers/score-rules';

/**
 * Tests for the test oracle itself. The API and E2E tests trust these rules,
 * so the rules must match the PRD exactly (FR-13, FR-16, FR-17, SS-2).
 */

describe('expectedPath (FR-13)', () => {
  it.each([
    [0, 'assumption'],
    [1, 'hybrid'],
    [7, 'hybrid'],
    [8, 'guided'],
    [15, 'guided'],
  ] as const)('%i valid answers → %s', (valid, path) => {
    expect(expectedPath(valid)).toBe(path);
  });
});

describe('expectedScore (FR-16)', () => {
  // The PDF and PRD say 45, but 25 − 25 + 2×22 = 44 (the PDF's own working shows "0 + 44").
  // Both are "Complex" on the Guided path; the formula is the source of truth.
  it('matches the scheduler worked example: E=25, N=25, P=22 → 44', () => {
    expect(expectedScore(25, 25, 22)).toBe(44);
  });
});

describe('expectedBand (FR-17)', () => {
  it.each([
    [9, 'Low'],
    [10, 'Medium'],
    [20, 'Medium'],
    [21, 'Complex'],
  ] as const)('Guided path: %i → %s', (score, band) => {
    expect(expectedBand('guided', score)).toBe(band);
  });

  it.each([
    [5, 'Low'],
    [6, 'Medium'],
    [15, 'Medium'],
    [16, 'High'],
    [30, 'High'],
    [31, 'Very High'],
  ] as const)('Hybrid and Assumption paths: %i → %s', (score, band) => {
    expect(expectedBand('hybrid', score)).toBe(band);
    expect(expectedBand('assumption', score)).toBe(band);
  });
});

describe('abnormalReasons (SS-2)', () => {
  it('accepts the worked example as sane', () => {
    expect(abnormalReasons({ nodes: 25, edges: 25, paths: 22, score: 44, path: 'guided', band: 'Complex' })).toEqual([]);
  });

  it('flags a Guided result that used the backup estimate', () => {
    const reasons = abnormalReasons({ nodes: 4, edges: 4, paths: 1, score: 2, path: 'guided', band: 'Low', usedBackup: true });

    expect(reasons).toContain('Guided path fell back to the backup estimate');
  });

  it('flags a score that breaks the formula', () => {
    const reasons = abnormalReasons({ nodes: 10, edges: 12, paths: 3, score: 9, path: 'hybrid', band: 'Medium' });

    expect(reasons).toContain('M=9 but E−N+2P=8');
  });

  it('flags a band that ignores the path rules', () => {
    const reasons = abnormalReasons({ nodes: 10, edges: 10, paths: 4, score: 8, path: 'guided', band: 'Medium' });

    expect(reasons).toContain('band "Medium" should be "Low" on the guided path');
  });
});
