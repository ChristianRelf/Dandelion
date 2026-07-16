import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests drive the *built* Electron application through Playwright's
 * Electron runner (`_electron.launch`). Run `npm run build` before `npm run
 * test:e2e`, or use the provided npm script which chains them.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
