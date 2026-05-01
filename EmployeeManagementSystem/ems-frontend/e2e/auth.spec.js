// e2e/auth.spec.js — Authentication tests (run WITHOUT saved cookies)
import { test, expect } from '@playwright/test';

const VALID_USER = 'TT0001';
const VALID_PASS = 'Mouni@1702';

test.describe('Authentication – Login Page', () => {

  test('should display the login page correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/EMS/i);
    await expect(page.locator('h2')).toContainText('Sign in');
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors when submitting empty form', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    // react-hook-form shows inline errors
    await expect(page.locator('text=Required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('should show error for credentials with too few chars', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'TT');     // < 3 chars
    await page.fill('input[type="password"]', '123'); // < 4 chars
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Min 3 chars')).toBeVisible();
    await expect(page.locator('text=Too short')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'TT9999');
    await page.fill('input[type="password"]', 'WrongPass@1');
    await page.click('button[type="submit"]');
    // API returns 401; the app should display an error banner
    const errorBanner = page.locator('.api-error-banner');
    await expect(errorBanner).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]',     VALID_USER);
    await page.fill('input[type="password"]', VALID_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should redirect already-authenticated users away from login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="text"]',     VALID_USER);
    await page.fill('input[type="password"]', VALID_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Navigating back to /login should redirect to dashboard
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should logout and be unable to access protected routes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]',     VALID_USER);
    await page.fill('input[type="password"]', VALID_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Open user menu and click logout
    await page.locator('[class*="avatar"],[class*="user-menu"]').first().click();
    await page.locator('text=/log.?out/i').first().click();
    await expect(page).toHaveURL(/\/login/);

    // Navigating to a protected route must redirect to login
    await page.goto('/attendance');
    await expect(page).toHaveURL(/\/login/);
  });
});
