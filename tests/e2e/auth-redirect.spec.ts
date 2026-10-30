import { test, expect } from '../support/merged-fixtures';

/**
 * Sample UI test that needs no test user: a signed-out visitor who opens the
 * dashboard is sent to the login page (PRD FR-42).
 */

test.describe('Signed-out visitor', () => {
  test.use({ authSessionEnabled: false });

  test('[P1] opening the dashboard redirects to login @P1 @E2E', async ({ page }) => {
    // Given no session
    // When the visitor opens the dashboard
    await page.goto('/dashboard');

    // Then they land on the login page
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: /log ?in|sign ?in/i })).toBeVisible();
  });
});
