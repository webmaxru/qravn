import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { Result } from 'axe-core';

// The four conformance levels Norway holds public-sector-adjacent products to
// (forskrift om universell utforming av IKT tracks WCAG 2.1/2.2 AA).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Matches the deterministic clock the app reads so results are reproducible.
const fixedNowMs = 1_784_332_800_000;

// The compiled analyser is fetched as this wasm binary; gating it lets a test
// hold the UI in its "still loading" state (controls disabled).
const isAnalyserWasm = (url: URL): boolean => url.pathname.includes('qravn_safety_wasm_bg');

test.beforeEach(async ({ page }) => {
  await page.addInitScript((nowMs) => {
    window.__QRAVN_TEST_NOW_MS__ = nowMs;
    Date.now = () => nowMs;
  }, fixedNowMs);
});

/** Turns axe's structured output into something a human can act on. */
function report(context: string, violations: Result[]): string {
  if (violations.length === 0) return '';
  const blocks = violations.map((v) => {
    const nodes = v.nodes
      .map((n) => {
        const selector = Array.isArray(n.target) ? n.target.join(' , ') : String(n.target);
        const summary = (n.failureSummary ?? '')
          .split('\n')
          .map((line) => `        ${line}`)
          .join('\n');
        return `      • ${selector}\n${summary}`;
      })
      .join('\n');
    return `  [${(v.impact ?? 'n/a').toUpperCase()}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${nodes}`;
  });
  return `\naxe-core found ${violations.length} WCAG violation(s) in state "${context}":\n${blocks.join('\n\n')}\n`;
}

async function scan(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations, report(context, results.violations)).toEqual([]);
}

async function waitForEngineReady(page: Page): Promise<void> {
  // The WebAssembly analyser can be slow to compile on a cold dev server under
  // the parallel browser matrix, so allow more time than the default.
  await expect(page.getByRole('button', { name: /^Check$/ })).toBeEnabled({ timeout: 25_000 });
}

async function submit(page: Page, payload: string): Promise<void> {
  await waitForEngineReady(page);
  await page.getByLabel(/Link or QR text/i).fill(payload);
  await page.getByRole('button', { name: /^Check$/ }).click();
  await expect(page.getByTestId('result-region')).toBeVisible();
}

test.describe('axe-core static scans across every meaningful UI state', () => {
  test('idle initial state', async ({ page }) => {
    await page.goto('/');
    await waitForEngineReady(page);
    await scan(page, 'idle');
  });

  test('analyser-still-loading state (controls disabled)', async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(isAnalyserWasm, async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Check$/ })).toBeDisabled();
    await scan(page, 'analyser-loading');
    release();
  });

  const verdicts = [
    { name: 'known_malicious', payload: 'https://malicious.example/phishing-kit', heading: /Known malicious/i },
    { name: 'suspicious', payload: 'https://trusted.no@evil.example/login', heading: /Suspicious/i },
    { name: 'insufficient_evidence', payload: 'plain text', heading: /Insufficient evidence/i },
    { name: 'no_known_threat_found', payload: 'https://example.com', heading: /No known threat found/i },
  ] as const;

  for (const verdict of verdicts) {
    test(`verdict ${verdict.name} rendered`, async ({ page }) => {
      await page.goto('/');
      await submit(page, verdict.payload);
      // Scope to the verdict banner heading (h2); finding titles are h3 and can
      // otherwise collide (e.g. the "Known malicious match" finding).
      await expect(page.getByRole('heading', { name: verdict.heading, level: 2 })).toBeVisible();
      await scan(page, `verdict:${verdict.name}`);
    });
  }

  test('open_blocked state', async ({ page }) => {
    await page.goto('/');
    await submit(page, 'javascript:alert(1)');
    await expect(page.getByText(/Opening is blocked/i)).toBeVisible();
    await scan(page, 'open_blocked');
  });

  test('two-step "prepare opening" confirmation state', async ({ page }) => {
    await page.goto('/');
    await submit(page, 'https://trusted.no@evil.example/login');
    await page.getByRole('button', { name: /^Open link$/i }).click();
    await expect(page.getByRole('link', { name: /Open evil\.example in a new tab/i })).toBeVisible();
    await scan(page, 'prepare-opening-confirmed');
  });

  test('engine-error state', async ({ page }) => {
    // Force the assess() catch branch so the real engine-error region renders.
    // Making the injected clock throw reproduces the exact markup a genuine
    // WebAssembly failure produces, without needing a production build.
    await page.addInitScript(() => {
      Object.defineProperty(window, '__QRAVN_TEST_NOW_MS__', {
        configurable: true,
        get() {
          throw new Error('forced analyser failure for a11y coverage');
        },
      });
    });
    await page.goto('/');
    await waitForEngineReady(page);
    await page.getByLabel(/Link or QR text/i).fill('https://example.com');
    await page.getByRole('button', { name: /^Check$/ }).click();
    await expect(page.getByRole('heading', { name: /checker could not start/i })).toBeVisible();
    await scan(page, 'engine-error');
  });

  const locales = [
    { code: 'nb', button: 'NO' },
    { code: 'en', button: 'EN' },
  ] as const;

  for (const locale of locales) {
    test(`rendered result localized to ${locale.code} (also asserts <html lang>)`, async ({ page }) => {
      await page.goto('/');
      await submit(page, 'https://trusted.no@evil.example/login');
      await page.getByRole('button', { name: locale.button, exact: true }).click();
      // A mismatched document language makes every localized string announce in
      // the wrong voice; axe cannot detect the mismatch, so assert it directly.
      await expect(page.locator('html')).toHaveAttribute('lang', locale.code);
      await scan(page, `locale:${locale.code}`);
    });
  }
});

test.describe('keyboard and focus behaviour axe cannot see', () => {
  test('every idle control is reachable by keyboard with no trap', async ({ page }) => {
    await page.goto('/');
    await waitForEngineReady(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      seen.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return 'BODY';
          const label = (el as HTMLInputElement).labels?.[0]?.textContent ?? '';
          const name = (el.getAttribute('aria-label') || el.textContent || label || el.id || el.getAttribute('type') || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 40);
          return `${el.tagName.toLowerCase()}:${name}`;
        }),
      );
    }

    const joined = seen.join('|').toLowerCase();
    expect(joined, `tab order was: ${seen.join(' -> ')}`).toContain('textarea');
    expect(joined).toMatch(/check/);
    expect(joined).toMatch(/scan with camera/);
    expect(joined).toMatch(/choose a photo/);
    expect(joined).toMatch(/\ben\b|english|language/);
    // Focus advanced through several distinct controls rather than sticking.
    expect(new Set(seen).size).toBeGreaterThan(3);
  });

  test('keyboard focus paints a visible indicator on interactive controls', async ({ page }) => {
    await page.goto('/');
    await waitForEngineReady(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    let checkedControls = 0;
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const isVisible = (node: Element): boolean => {
          const s = getComputedStyle(node);
          return s.opacity !== '0' && s.visibility !== 'hidden' && s.display !== 'none';
        };
        // A visually-hidden control (the file input) delegates its focus ring to
        // the label wrapper a sighted keyboard user actually sees.
        const target = isVisible(el) ? el : (el.closest('label') as HTMLElement | null) ?? el;
        const s = getComputedStyle(target);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow !== 'none' && s.boxShadow !== '';
        return {
          tag: el.tagName.toLowerCase(),
          interactive: ['button', 'textarea', 'input', 'a', 'select'].includes(el.tagName.toLowerCase()),
          hasIndicator: outline || shadow,
        };
      });
      if (info?.interactive) {
        expect(info.hasIndicator, `no visible focus indicator on <${info.tag}> at tab stop ${i}`).toBe(true);
        checkedControls += 1;
      }
    }
    expect(checkedControls, 'expected to reach several interactive controls').toBeGreaterThanOrEqual(4);
  });

  test('focus moves to the announced result region after a check', async ({ page }) => {
    await page.goto('/');
    await submit(page, 'https://example.com');
    const region = page.getByTestId('result-region');
    await expect(region).toBeFocused();
    await expect(region).toHaveAttribute('aria-live', /polite|assertive/);
    await expect(region).toHaveAttribute('tabindex', '-1');
  });

  test('disabled-while-loading blocks BOTH pointer and keyboard submission (parity)', async ({ page }) => {
    // This is the exact class of defect that reached production once: the button
    // was disabled during load but the Enter handler ignored the flag, so the
    // keyboard path could start a check that produced nothing at all.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(isAnalyserWasm, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/');

    const check = page.getByRole('button', { name: /^Check$/ });
    const field = page.getByLabel(/Link or QR text/i);
    await expect(check).toBeDisabled(); // pointer path is blocked

    await field.fill('https://example.com');
    await field.press('Enter'); // keyboard path must be blocked too
    await expect(page.getByTestId('result-region')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /checker could not start/i })).toHaveCount(0);

    release();
    await expect(check).toBeEnabled();
    await field.press('Enter');
    await expect(page.getByTestId('result-region')).toBeVisible();
  });

  test('every result action is operable by keyboard (pointer/keyboard parity)', async ({ page }) => {
    await page.goto('/');
    await submit(page, 'https://trusted.no@evil.example/login');

    const prepare = page.getByRole('button', { name: /^Open link$/i });
    await prepare.focus();
    await expect(prepare).toBeFocused();
    await page.keyboard.press('Enter');

    const openLink = page.getByRole('link', { name: /Open evil\.example in a new tab/i });
    await expect(openLink).toBeVisible();
    await openLink.focus();
    await expect(openLink).toBeFocused();

    await expect(page.getByRole('button', { name: /^Copy link$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Share link$/ })).toBeVisible();
  });

  test('animations are suppressed under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForEngineReady(page);
    const check = page.getByRole('button', { name: /^Check$/ });

    const reduced = await check.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(reduced === '0s' || reduced === '').toBe(true);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const motion = await check.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(motion)).toBeGreaterThan(0);
  });
});
