import { test, expect, log } from '../support/merged-fixtures';
import { AUTH_SKIP_REASON, canAuthenticate } from '../support/helpers/test-env';

/**
 * Sample signed-in UI test (UJ-1 entry point). Shows the reference pattern:
 * the page arrives already signed in through the auth fixture, the app's API
 * call is intercepted BEFORE navigation and awaited after it, and assertions
 * use roles.
 *
 * Recommended data-testid attributes for later specs are listed in
 * _bmad-output/test-artifacts/test-design/complexity-analyzer-handoff.md.
 */

test.describe('Dashboard (signed in)', () => {
  // Runs only when .env.test points at a Supabase TEST project; skipped otherwise.
  test.skip(!canAuthenticate(), AUTH_SKIP_REASON);

  test('[P1] loads the analysis history for the signed-in user @P1 @E2E', async ({ page, interceptNetworkCall }) => {
    // Given a signed-in user (auth fixture)
    const historyCall = interceptNetworkCall({ method: 'GET', url: '**/api/analyses' });

    // When they open the dashboard
    await log.step('Open the dashboard');
    await page.goto('/dashboard');

    // Then the history request succeeds and the dashboard renders
    const { status } = await historyCall;
    expect(status).toBe(200);
    await expect(page.getByRole('heading', { name: 'DeliveryForge' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
