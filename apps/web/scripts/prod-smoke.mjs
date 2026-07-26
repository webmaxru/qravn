import { chromium, webkit } from '@playwright/test';

const BASE = process.env.PROD_URL ?? 'https://brave-bay-0ecf82e03.7.azurestaticapps.net';
const results = [];
let failed = 0;

function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
  if (!ok) failed++;
}

for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const consoleErrors = [];
  const offOrigin = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('request', (r) => {
    const h = new URL(r.url()).host;
    if (!BASE.includes(h) && !['localhost'].includes(h)) offOrigin.push(r.url());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  const body = await page.locator('body').innerText();
  check(`${engineName}: no mock/development engine banner`,
    !/mock|development engine|dev engine/i.test(body),
    body.slice(0, 120).replace(/\s+/g, ' '));

  await page.getByLabel(/Paste a suspicious link/i).fill('https://trusted.no@evil.example/login');
  await page.getByRole('button', { name: /^Check$/ }).click();

  await page.waitForTimeout(2500);
  const after = await page.locator('body').innerText();

  check(`${engineName}: real engine produced the credential finding`,
    after.includes('url.credentials_in_authority'));
  check(`${engineName}: destination host evil.example is surfaced`,
    /evil\.example/.test(after));
  check(`${engineName}: no unguarded open link rendered`,
    (await page.getByRole('link', { name: /Open evil\.example/i }).count()) === 0);
  check(`${engineName}: never contacted the scanned destination`,
    !offOrigin.some((u) => u.includes('evil.example')),
    offOrigin.filter((u) => u.includes('evil.example')).join(','));
  check(`${engineName}: no console errors`,
    consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join(' | '));

  await browser.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? '\nALL PRODUCTION CHECKS PASSED' : `\n${failed} PRODUCTION CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
