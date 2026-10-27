import { defineConfig } from '@playwright/test';

/**
 * End-to-end checks of the critical flows (plan, phase 7).
 *
 * - Local (default): starts `ng serve`, which proxies /api to the staging backend.
 * - Remote: `E2E_BASE_URL=https://next.erastcg.com npm run e2e` runs the same specs against a deployment.
 *
 * Reads hit the real backend; anything that needs a session or writes is mocked in the browser
 * (see e2e/fixtures.ts), so no real account is used.
 */
const remote = process.env['E2E_BASE_URL'];
const port = 4300;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: remote ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: remote ?? `http://localhost:${port}`,
    // System Chrome, so no browser download is needed; set E2E_CHANNEL= to use Playwright's own build
    channel: process.env['E2E_CHANNEL'] ?? 'chrome',
    trace: 'retain-on-failure',
    locale: 'es-CL',
  },
  webServer: remote
    ? undefined
    : {
        command: `npx ng serve --port ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
