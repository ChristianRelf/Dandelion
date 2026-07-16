import { join } from 'node:path';
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const env = { ...process.env } as Record<string, string>;
  // This sandbox exports ELECTRON_RUN_AS_NODE=1, which turns Electron into a
  // plain Node runtime — remove it so the GUI launches.
  delete env.ELECTRON_RUN_AS_NODE;

  app = await electron.launch({ args: [join(__dirname, '..', '..')], env });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await app?.close();
});

test('boots into the browser chrome', async () => {
  await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'New Tab' })).toBeVisible();
});

test('creates additional tabs', async () => {
  const before = await page.getByRole('tab').count();
  await page.getByRole('button', { name: 'New Tab' }).click();
  await expect(page.getByRole('tab')).toHaveCount(before + 1);
});

test('opens the omnibox and navigates to a site', async () => {
  // A fresh tab shows the internal new-tab page, so the address bar reads the
  // placeholder. Clicking it opens the omnibox (menu accelerators can't be
  // injected via CDP, so we drive the UI directly).
  await page.getByRole('button', { name: 'New Tab' }).click();
  await page.getByRole('button', { name: 'Search or enter address' }).first().click();

  const input = page.getByPlaceholder('Search or enter address');
  await expect(input).toBeVisible();
  await input.fill('example.com');
  await input.press('Enter');

  await expect(page.getByRole('tab').filter({ hasText: 'Example Domain' })).toBeVisible({
    timeout: 20_000,
  });
});
