import { mergeTests } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as fileUtilsFixture } from '@seontechnologies/playwright-utils/file-utils/fixtures';
import { test as interceptFixture } from '@seontechnologies/playwright-utils/intercept-network-call/fixtures';
import { test as networkErrorFixture } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';
import { test as recurseFixture } from '@seontechnologies/playwright-utils/recurse/fixtures';
import { test as authFixture } from './auth-fixture';

/**
 * The single entry point for Playwright specs. Always import `test` from here,
 * never from '@playwright/test'.
 *
 * - apiRequest: typed HTTP calls (API tests, setup and teardown)
 * - recurse: polling for eventually consistent results
 * - interceptNetworkCall: observe or stub app API calls in browser tests
 * - networkErrorMonitor: fails browser tests on unexpected 4xx/5xx
 * - handleDownload / readCSV / readPDF: download capture for the leak scans
 * - authToken / signed-in page: Supabase test users (see auth-fixture.ts)
 */
export const test = mergeTests(
  apiRequestFixture,
  recurseFixture,
  interceptFixture,
  networkErrorFixture,
  fileUtilsFixture,
  authFixture,
);

export { expect } from '@playwright/test';
export { log };
