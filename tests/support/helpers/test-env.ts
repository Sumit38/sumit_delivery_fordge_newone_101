/**
 * Reads the test environment (loaded from .env.test by playwright.config.ts)
 * and tells specs what they can run. Specs call these in `test.skip(...)` at
 * describe level, so a missing setting skips with a clear reason instead of
 * failing.
 */

export const testEnv = {
  environment: process.env.TEST_ENV || 'local',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  userEmailPrefix: process.env.TEST_USER_EMAIL_PREFIX || 'deliveryforge-test',
  userEmailDomain: process.env.TEST_USER_EMAIL_DOMAIN || 'deliveryforge.test',
  userPassword: process.env.TEST_USER_PASSWORD || '',
  allowUserCreation: process.env.ALLOW_TEST_USER_CREATION === 'true',
  aiProvider: process.env.AI_PROVIDER || '',
};

/** True when tests can sign in a test user against the Supabase TEST project. */
export function canAuthenticate(): boolean {
  return Boolean(
    testEnv.supabaseUrl &&
      testEnv.supabaseAnonKey &&
      testEnv.supabaseServiceKey &&
      testEnv.userPassword &&
      testEnv.allowUserCreation,
  );
}

export const AUTH_SKIP_REASON =
  'Needs a Supabase TEST project in .env.test (URL, anon key, service key, TEST_USER_PASSWORD, ALLOW_TEST_USER_CREATION=true)';

/** True when AI-backed routes are served by the fake provider (TC-2). */
export function hasFakeAi(): boolean {
  return testEnv.aiProvider === 'fake';
}

export const FAKE_AI_SKIP_REASON = 'Needs the fake AI provider (TC-2) and AI_PROVIDER=fake';

/** Email for a test user identifier, e.g. "worker-0" → deliveryforge-test+worker-0@deliveryforge.test */
export function testUserEmail(userIdentifier: string): string {
  return `${testEnv.userEmailPrefix}+${userIdentifier}@${testEnv.userEmailDomain}`;
}

/** Supabase project ref, used in the browser session key `sb-<ref>-auth-token`. */
export function supabaseProjectRef(): string {
  return new URL(testEnv.supabaseUrl).hostname.split('.')[0];
}
