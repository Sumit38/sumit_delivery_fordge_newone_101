import { test as base } from '@playwright/test';
import { type AuthFixtures, createAuthFixtures, setAuthProvider } from '@seontechnologies/playwright-utils/auth-session';
import supabaseAuthProvider from './auth/supabase-auth-provider';
import { canAuthenticate, testEnv } from './helpers/test-env';

// Register the provider early so it's set in every worker, not only in global setup.
setAuthProvider(supabaseAuthProvider);

/**
 * Gives tests `authToken` (for API calls) and an already-signed-in `page`/`context`.
 * Auth is switched off automatically when no Supabase TEST project is
 * configured, so unauthenticated specs still run.
 */
export const test = base.extend<AuthFixtures>({
  ...createAuthFixtures(),
  authOptions: [{ environment: testEnv.environment }, { option: true }],
  authSessionEnabled: [canAuthenticate(), { option: true }],
});
