import { test, expect, log } from '../support/merged-fixtures';

/**
 * X-API-022 (P0, risk R-18): every endpoint except sign-up rejects requests
 * that have no valid session (PRD FR-42, NFR-9).
 *
 * Parameterised over the route list, so adding a route here keeps the guard
 * honest. Needs only the dev server, with no Supabase test user.
 */

const PROTECTED_ROUTES: Array<{ method: 'GET' | 'POST' | 'DELETE'; path: string }> = [
  { method: 'GET', path: '/api/analyses' },
  { method: 'DELETE', path: '/api/analyses/00000000-0000-0000-0000-000000000000' },
  { method: 'POST', path: '/api/analyze' },
  { method: 'POST', path: '/api/classify-requirement' },
  { method: 'POST', path: '/api/download-pitch-deck' },
  { method: 'POST', path: '/api/export-excel' },
  { method: 'POST', path: '/api/extract-docx' },
  { method: 'POST', path: '/api/extract-pdf' },
  { method: 'POST', path: '/api/extract-scenarios' },
  { method: 'POST', path: '/api/extract-website' },
  { method: 'POST', path: '/api/generate-delivery-plan' },
  { method: 'POST', path: '/api/generate-estimation' },
  { method: 'POST', path: '/api/generate-pitch-deck' },
  { method: 'POST', path: '/api/generate-use-case-qa' },
  { method: 'POST', path: '/api/generate-user-stories' },
  { method: 'GET', path: '/api/get-analysis-details' },
  { method: 'GET', path: '/api/get-project-timelines' },
  { method: 'GET', path: '/api/get-user-stories' },
  { method: 'GET', path: '/api/profile' },
  { method: 'POST', path: '/api/refine-requirement' },
  { method: 'POST', path: '/api/save-project-timeline' },
  { method: 'POST', path: '/api/save-user-stories' },
  { method: 'GET', path: '/api/user-preferences' },
];

test.describe('Auth guard on protected API routes', () => {
  // No signed-in user for this suite: we are testing what happens without one.
  test.use({ authSessionEnabled: false });

  for (const route of PROTECTED_ROUTES) {
    test(`[P0] ${route.method} ${route.path} without a token returns 401 @P0 @API @Security`, async ({ apiRequest }) => {
      await log.step(`Call ${route.method} ${route.path} with no Authorization header`);

      const { status } = await apiRequest({
        method: route.method,
        path: route.path,
        body: route.method === 'GET' ? undefined : {},
        retryConfig: { maxRetries: 0 },
      });

      expect(status).toBe(401);
    });

    test(`[P0] ${route.method} ${route.path} with a forged token returns 401 @P0 @API @Security`, async ({ apiRequest }) => {
      await log.step(`Call ${route.method} ${route.path} with an invalid Bearer token`);

      const { status } = await apiRequest({
        method: route.method,
        path: route.path,
        body: route.method === 'GET' ? undefined : {},
        headers: { Authorization: 'Bearer not-a-real-token' },
        retryConfig: { maxRetries: 0 },
      });

      expect(status).toBe(401);
    });
  }
});
