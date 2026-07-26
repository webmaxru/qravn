import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  // axe-core injection + a full WCAG analyze is CPU-heavy, and the WebAssembly
  // analyser cold-starts on first load; under the parallel browser matrix these
  // add up, so give each test more headroom than Playwright's 30s default.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Make explicit online mode available in e2e. The URL is the app's OWN
    // origin so the expansion request is same-origin (no CORS), and the tests
    // intercept it with page.route: the resolver is never really contacted, and
    // — the point of the product — neither is any scanned host.
    env: { VITE_RESOLVER_URL: 'http://127.0.0.1:5173' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
