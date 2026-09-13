import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.AURA_E2E_PORT ?? 3000);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `VITE_CONTRACTS_V2_ENABLED=true VITE_PHASE3_E2E_HARNESS=true VITE_PHASE4_E2E_HARNESS=true VITE_OE4_E2E_HARNESS=true npm run dev -- --host 127.0.0.1 --port ${e2ePort}`,
    url: `http://127.0.0.1:${e2ePort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
