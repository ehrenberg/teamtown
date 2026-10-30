import { defineConfig, devices } from '@playwright/test';

/**
 * Prerequisites: `pnpm stack:up` (Keycloak, PostgreSQL) and `pnpm dev` (server + web client),
 * or set E2E_BASE_URL to another environment.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  outputDir: './test-results',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:5173',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // WebGL in headless Chromium via SwiftShader.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 860 } } }],
});
