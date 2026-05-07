// e2e/fixtures/auth.setup.js
// Run once before the entire test suite. Saves auth cookies so subsequent
// tests can skip the login page entirely — dramatically faster execution.
import { test as setup, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

// ESM-safe equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export const ADMIN_FILE = path.join(__dirname, '../.auth/admin.json');

const BACKEND_URL = process.env.VITE_API_BASE_URL || '/api';

setup('authenticate as admin', async ({ page, request }) => {
  // Step 1: ensure the FastAPI backend is reachable.
  console.log('Checking Python backend health...');
  for (let i = 0; i < 10; i++) {
    try {
      const res = await request.get(`${BACKEND_URL}/health`, { timeout: 10000 });
      if (res.ok()) { console.log('Backend is up'); break; }
    } catch {}
    console.log(`  Attempt ${i + 1}/10 - backend not ready yet, waiting 5s...`);
    await page.waitForTimeout(5000);
  }

  // ── Step 2: Log in and save cookies ─────────────────────────────────────────
  await page.goto('/login');
  await page.fill('input[type="text"]',     'TT0001');
  await page.fill('input[type="password"]', 'Mouni@1702');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  // Persist cookie / localStorage so every test file can reuse them
  await page.context().storageState({ path: ADMIN_FILE });
});
