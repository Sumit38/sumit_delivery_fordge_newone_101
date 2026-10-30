import { defineConfig } from 'vitest/config';

// Unit tests (pure logic in lib/) and component tests (React components).
// API and E2E tests run on Playwright; see playwright.config.ts.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    environment: 'node',
    // Component tests opt into jsdom with a `// @vitest-environment jsdom` header.
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
    },
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'test-results/vitest-junit.xml' },
  },
});
