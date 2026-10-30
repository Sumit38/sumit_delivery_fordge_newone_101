import { describe, expect, it } from 'vitest';
import { scanForLeaks } from '../support/helpers/leak-scan';

/**
 * Tests for the confidentiality leak scan (FR-22, NFR-13). It must catch
 * every kind of leak without flagging ordinary customer-facing prose.
 */

describe('scanForLeaks', () => {
  it('passes clean customer-facing text', () => {
    const useCase = 'Actor: Store manager. Main flow: open the scheduler, search for a product, add it to a bin. This is a complex workflow.';

    expect(scanForLeaks(useCase, { score: 37 })).toEqual([]);
  });

  it.each([
    ['Cyclomatic complexity of this change is notable', 'complexity score wording'],
    ['Calculated with M = E − N + 2P', 'formula'],
    ['Paths: P = 22', 'formula variable'],
    ['This is a Very High complexity change', 'band wording'],
    ['Confidence: 72%', 'confidence'],
    ['Analysed on the hybrid path', 'analysis path'],
    ['Q4 (inferred): yes', 'inferred label'],
    ['Result from the backup estimate', 'backup estimate'],
  ])('flags "%s" as %s', (text, rule) => {
    expect(scanForLeaks(text).map((finding) => finding.rule)).toContain(rule);
  });

  it('flags a seeded score value but not a longer number that contains it', () => {
    expect(scanForLeaks('Estimated effort: 37 days', { score: 37 })).toEqual([{ rule: 'seeded score value', match: '37' }]);
    expect(scanForLeaks('Budget: 1370 hours', { score: 37 })).toEqual([]);
  });
});
