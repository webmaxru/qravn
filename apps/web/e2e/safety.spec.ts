import { expect, test } from '@playwright/test';

const fixedNowMs = 1_784_332_800_000;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((nowMs) => {
    window.__QRRRGH_TEST_NOW_MS__ = nowMs;
    Date.now = () => nowMs;
  }, fixedNowMs);
});

async function submitPayload(page: import('@playwright/test').Page, payload: string) {
  await page.getByLabel(/Paste a suspicious link/i).fill(payload);
  await page.getByRole('button', { name: /^Check$/ }).click();
}

test('credential-in-authority finding appears without an unguarded open link', async ({ page }) => {
  await page.goto('/');
  await submitPayload(page, 'https://trusted.no@evil.example/login');

  await expect(page.getByText('url.credentials_in_authority')).toBeVisible();
  await expect(page.getByText(/text before @ is not the destination/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open evil\.example/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /prepare opening evil\.example/i })).toBeVisible();
});

test('open_blocked renders no anchor to the payload', async ({ page }) => {
  await page.goto('/');
  await submitPayload(page, 'javascript:alert(1)');

  await expect(page.getByText(/Opening is blocked/i)).toBeVisible();
  await expect(page.locator('a[href="javascript:alert(1)"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /open/i })).toHaveCount(0);
});

test('opening requires assessment plus a second explicit confirmation', async ({ page }) => {
  await page.goto('/');
  await submitPayload(page, 'https://example.com/login');

  await expect(page.getByRole('link', { name: /Open example\.com/i })).toHaveCount(0);
  await page.getByRole('button', { name: /prepare opening example\.com/i }).click();
  await expect(page.getByRole('link', { name: /Open example\.com/i })).toBeVisible();
});

test('switching language changes rendered text', async ({ page }) => {
  await page.goto('/');
  await submitPayload(page, 'plain text');
  const english = await page.locator('.finding h3').first().textContent();

  await page.getByRole('radio', { name: /NB/i }).check();
  await expect.poll(async () => page.locator('.finding h3').first().textContent()).not.toBe(english);
});

test('keyboard-only submit moves focus to the announced result region', async ({ page }) => {
  await page.goto('/');
  // The pointer-driven tests get this wait for free, because Playwright's click
  // waits for the button to become enabled. Typing does not, so this test raced
  // the WebAssembly load and failed intermittently on a cold runner.
  await expect(page.getByRole('button', { name: /^Check$/ })).toBeEnabled();
  await page.getByLabel(/Paste a suspicious link/i).focus();
  await page.keyboard.type('https://example.com');
  await page.keyboard.press('Enter');

  const result = page.getByTestId('result-region');
  await expect(result).toBeVisible();
  await expect(result).toBeFocused();
  await expect(page.getByRole('heading', { name: /No known threat found/i })).toBeVisible();
});

test('checking a hostile destination never contacts that destination', async ({ page }) => {
  const forbiddenRequests: string[] = [];
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'evil.example') {
      forbiddenRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });

  await page.goto('/');
  await submitPayload(page, 'https://trusted.no@evil.example/login');
  await expect(page.getByText('evil.example').first()).toBeVisible();
  expect(forbiddenRequests).toEqual([]);
});
