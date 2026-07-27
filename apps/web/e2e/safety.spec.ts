import { expect, test } from '@playwright/test';

const fixedNowMs = 1_784_332_800_000;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((nowMs) => {
    window.__QRRRGH_TEST_NOW_MS__ = nowMs;
    Date.now = () => nowMs;
  }, fixedNowMs);
});

async function submitPayload(page: import('@playwright/test').Page, payload: string) {
  // Wait for the analyser BEFORE typing, not just before clicking. Playwright's
  // click() waits for the button to become enabled, so the click was always
  // safe — but the fill() ahead of it was not: while the app is still starting,
  // the dev server can still reload the page, which clears the textarea. The
  // click then submitted an empty payload and the assertion failed against a
  // perfectly correct "Empty content" result, in whichever test happened to run
  // first. a11y.spec.ts already gates on the same signal for this reason.
  await expect(page.getByRole('button', { name: /^Check$/ })).toBeEnabled({ timeout: 25_000 });
  const field = page.getByLabel(/Paste a suspicious link/i);
  await field.fill(payload);
  await expect(field).toHaveValue(payload);
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

test('online expansion is opt-in and still never contacts the scanned host', async ({ page }) => {
  // Online mode is the one place the product invariant is most likely to be
  // broken by a later change, so assert it directly: expanding a hostile
  // shortened link must reach OUR resolver only, never the scanned shortener and
  // never the destination it eventually points at.
  const forbiddenRequests: string[] = [];
  let resolverCalls = 0;

  // The stubbed resolver's answer: bit.ly/abc really lands on evil.example.
  const resolution = {
    chain: [
      { url: 'https://bit.ly/abc', status: 301, via: 'http_status' },
      { url: 'https://evil.example/login', status: 200 },
    ],
    finalUrl: 'https://evil.example/login',
    outcome: 'resolved',
    resolver: 'e2e-stub',
  };

  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    // Neither the scanned shortener nor the final destination may be contacted by
    // the device — not offline, and not during online expansion.
    if (url.hostname === 'bit.ly' || url.hostname === 'evil.example') {
      forbiddenRequests.push(route.request().url());
      return route.abort();
    }
    // Our OWN resolver origin: fulfil it here so the real service is never hit.
    if (url.pathname === '/v1/resolve') {
      resolverCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(resolution),
      });
    }
    return route.continue();
  });

  await page.goto('/');
  await submitPayload(page, 'https://bit.ly/abc');

  // The offline check flags the shortener and offers the opt-in — but nothing has
  // been sent to any server yet. Explicit consent is required.
  const expandButton = page.getByRole('button', { name: /Expand this link safely/i });
  await expect(expandButton).toBeVisible();
  expect(resolverCalls).toBe(0);

  // Only after the user actively opts in is our resolver contacted.
  await expandButton.click();

  await expect(page.getByRole('heading', { name: /Where this link leads/i })).toBeVisible();
  await expect(page.locator('.redirect-final-host__value')).toHaveText(/evil\.example/);
  expect(resolverCalls).toBeGreaterThanOrEqual(1);

  // The payoff: expanding a hostile link told the attacker nothing, because the
  // device never touched the scanned host or its destination.
  expect(forbiddenRequests).toEqual([]);
});
