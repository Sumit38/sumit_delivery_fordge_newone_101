import { test, expect, log } from '../support/merged-fixtures';
import { AUTH_SKIP_REASON, canAuthenticate } from '../support/helpers/test-env';

/**
 * Sample authenticated API test: F10-API-046 / F11-API-021.
 * A signed-in user's history lists only their own analyses (PRD FR-38, FR-43).
 *
 * Shows the reference pattern: `authToken` from the auth fixture, `apiRequest`
 * for the call, `log.step` for milestones. No response schema exists for this
 * endpoint yet, so the assertions cover only the fields under test.
 */

type AnalysisSummary = {
  id: string;
  title: string;
  complexityScore: number;
  nodesCount: number;
  edgesCount: number;
};

test.describe('GET /api/analyses', () => {
  // Runs only when .env.test points at a Supabase TEST project; skipped otherwise.
  test.skip(!canAuthenticate(), AUTH_SKIP_REASON);

  test('[P1] returns a list for the signed-in user @P1 @API', async ({ apiRequest, authToken }) => {
    await log.step('Fetch analysis history as the worker test user');

    const { status, body } = await apiRequest<AnalysisSummary[]>({
      method: 'GET',
      path: '/api/analyses',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    for (const analysis of body) {
      expect(typeof analysis.id).toBe('string');
      expect(Number.isInteger(analysis.complexityScore)).toBe(true);
    }
  });
});
