import { defineConfig, devices } from '@playwright/test';

/** Acceptance tests (PA-01 to PA-06 of the project report) run against the dev server in mock mode. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    env: { VITE_USE_MOCKS: 'true' },
  },
});
