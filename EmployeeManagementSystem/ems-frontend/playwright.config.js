// playwright.config.js
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,                   // Retry twice — handles Render cold-start 500s
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60 * 1000,           // 60s per test (Render free tier can be slow)
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 15000,       // 15s per action (click, fill, etc.)
    navigationTimeout: 30000,   // 30s for page navigation
  },
  projects: [
    // 1. One-time global setup: login & save cookies
    {
      name: 'setup',
      testMatch: '**/fixtures/auth.setup.js',
    },
    // 2. All real tests: reuse saved cookies → no login UI needed
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
    // 3. Auth tests run without saved cookies (they test the login page itself)
    {
      name: 'auth-tests',
      testMatch: '**/auth.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
