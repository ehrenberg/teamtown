import { defineConfig, devices } from '@playwright/test';

/**
 * Prerequisites: `pnpm stack:up` (Keycloak, PostgreSQL) and `pnpm dev` (server + web client),
 * or set E2E_BASE_URL to another environment.
 */
export default defineConfig({
  testDir: './specs',
  // Two browsers render the office in software (SwiftShader) and connect audio; that takes its time.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // All specs share the demo users of docker/keycloak, so they must not run at the same time.
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  outputDir: './test-results',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:5173',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // WebGL in headless Chromium via SwiftShader; a fake microphone (a steady tone) without permission prompts.
    launchOptions: {
      args: [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 860 } } }],
});
