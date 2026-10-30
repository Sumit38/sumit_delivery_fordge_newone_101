import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// Test settings come from .env.test, never .env.local, so tests can't
// accidentally run against the real Supabase project.
loadEnv({ path: path.resolve(__dirname, '.env.test') });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const isCI = !!process.env.CI;

// Values the Next.js dev server needs. Passed explicitly so they override
// anything in .env.local (shell env wins over Next's .env files).
const serverEnv: Record<string, string> = Object.fromEntries(
  ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'AI_PROVIDER']
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key] as string]),
);

export default defineConfig({
  testDir: './tests',
  testMatch: ['api/**/*.spec.ts', 'e2e/**/*.spec.ts'],
  globalSetup: './tests/support/global-setup.ts',
  outputDir: './test-results',

  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : undefined,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure-and-retries',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      // API tests make no UI calls, but playwright-utils' apiRequest fixture
      // still opens a page (for UI-mode display), so this project needs a
      // browser too.
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      use: { channel: process.env.PW_CHANNEL || undefined },
    },
    {
      name: 'e2e',
      testMatch: 'e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // PW_CHANNEL=msedge uses the installed Edge when the bundled
        // Chromium can't be downloaded (for example behind TLS inspection).
        channel: process.env.PW_CHANNEL || undefined,
      },
    },
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        env: serverEnv,
      },
});
