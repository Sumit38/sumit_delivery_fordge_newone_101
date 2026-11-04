import { describe, expect, it, vi } from 'vitest';

// The retention module imports the Supabase server client; the pure helpers don't use it
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: {} }));

import { beyondLatest, requirementsToPrune } from '@/lib/history-retention';
import { buildPathTree, buildPathTreeMermaid, isPathTreeTooLarge, pathTreePageUrl } from '@/lib/flow-diagram';

const NOW = new Date('2026-11-04T12:00:00Z').getTime();
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const req = (id: string, mins: number, analysed = true) => ({
  id,
  created_at: minutesAgo(mins),
  complexity_results: analysed ? [{ id: `r-${id}` }] : [],
});

describe('history retention: keep the latest 5', () => {
  it('keeps the 5 newest analyses and removes the older ones', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((i) => req(`a${i}`, i * 60));
    expect(requirementsToPrune(rows, 5, NOW)).toEqual(['a6', 'a7']);
  });

  it('leaves a requirement whose analysis may still be running', () => {
    const rows = [req('new', 1, false), ...[1, 2, 3, 4, 5, 6].map((i) => req(`a${i}`, i * 60))];
    expect(requirementsToPrune(rows, 5, NOW)).toEqual(['a6']);
  });

  it('removes old requirements that never got an analysis', () => {
    const rows = [req('a1', 10), req('stale', 600, false)];
    expect(requirementsToPrune(rows, 5, NOW)).toEqual(['stale']);
  });

  it('removes nothing when there are 5 or fewer', () => {
    const rows = [1, 2, 3].map((i) => req(`a${i}`, i));
    expect(requirementsToPrune(rows, 5, NOW)).toEqual([]);
  });

  it('keeps the first 5 rows of a newest-first list for other tabs', () => {
    const rows = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map((id) => ({ id }));
    expect(beyondLatest(rows, 5)).toEqual(['e6']);
  });
});

describe('path tree full-page view', () => {
  // 4 binary decisions in a row = 16 paths and a tree of 31 steps
  const levels = 4;
  const paths: string[][] = [];
  for (let mask = 0; mask < 2 ** levels; mask++) {
    const path = ['Start'];
    for (let l = 0; l < levels; l++) path.push(`L${l}-${(mask >> l) & 1 ? 'yes' : 'no'}-${mask & ((1 << l) - 1)}`);
    path.push('End');
    paths.push(path);
  }

  it('draws top to bottom without the report size limit', () => {
    const code = buildPathTreeMermaid(paths, { direction: 'TD', maxNodes: 3000 })!;
    expect(code.startsWith('flowchart TD')).toBe(true);
    expect(buildPathTreeMermaid(paths)!.startsWith('flowchart LR')).toBe(true);
  });

  it('reports when the tree is too large for the report and still builds it for the page', () => {
    const big: string[][] = [];
    for (let i = 0; i < 80; i++) big.push(['Start', `A${i}`, `B${i}`, 'End']);
    expect(isPathTreeTooLarge(big)).toBe(true);
    expect(buildPathTreeMermaid(big)).toBeNull();
    expect(buildPathTreeMermaid(big, { direction: 'TD', maxNodes: 3000 })).not.toBeNull();
    expect(buildPathTree(big)!.size).toBe(1 + 80 * 3);
  });

  it('links to the full-page view with the analysis id', () => {
    expect(pathTreePageUrl('abc 1', 'https://app.example')).toBe('https://app.example/path-tree?id=abc%201');
    expect(pathTreePageUrl('', 'https://app.example')).toBeNull();
  });
});
