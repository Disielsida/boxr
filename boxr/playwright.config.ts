import { defineConfig, devices } from '@playwright/test';

const FRONT_PORT = Number(process.env.E2E_FRONT_PORT ?? 5173);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3000);
const FRONT_URL = `http://localhost:${FRONT_PORT}`;
const API_URL = `http://localhost:${API_PORT}/api/v1`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: FRONT_URL,
    trace: 'retain-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    extraHTTPHeaders: {},
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port ' + FRONT_PORT,
      url: FRONT_URL,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 60_000,
    },
    {
      command: 'npm run start:prod',
      cwd: '../boxr-api',
      url: `${API_URL}/tournaments/public`,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 60_000,
    },
  ],
  metadata: { apiUrl: API_URL, frontUrl: FRONT_URL },
});
