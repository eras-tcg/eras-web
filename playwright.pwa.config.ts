import { defineConfig } from '@playwright/test';

/**
 * The installable app offline (e2e/pwa): against the production build, served by the spec itself
 * (e2e/pwa/pwa-server.ts) so it can stop it and the browser can go offline. `npm run e2e:pwa` builds first.
 */
export default defineConfig({
  testDir: './e2e/pwa',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    // System Chrome, so no browser download is needed; set E2E_CHANNEL= to use Playwright's own build
    channel: process.env['E2E_CHANNEL'] ?? 'chrome',
    trace: 'retain-on-failure',
    locale: 'es-CL',
  },
});
