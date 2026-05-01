// e2e/employees.spec.js — uses saved auth cookies
import { test, expect } from '@playwright/test';

test.describe('Employees – List & Search', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/employees');
  });

  test('should load the employees page with active tab', async ({ page }) => {
    await expect(page.locator('button:has-text("Add Employee")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible({ timeout: 8000 });
  });

  test('should search employees by name and filter results', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('TT0001');
    await page.waitForTimeout(600); // debounce
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('should switch to Inactive employees tab', async ({ page }) => {
    const inactiveBtn = page.locator('button:has-text("Inactive")');
    if (await inactiveBtn.isVisible()) {
      await inactiveBtn.click();
      const table = page.locator('table');
      const empty = page.locator('text=No inactive employees');
      await expect(table.or(empty)).toBeVisible({ timeout: 6000 });
    }
  });

  test('should open employee side-sheet by clicking a row', async ({ page }) => {
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    // Side-sheet should open – look for generic profile detail heading
    await expect(page.locator('[class*="sheet"],[class*="drawer"],[class*="panel"]').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Employees – Add Employee modal', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/employees');
    await page.click('button:has-text("Add Employee")');
    await expect(page.locator('text=Add New Employee')).toBeVisible();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.click('button:has-text("Create Employee")');
    // react-hook-form / custom validation should trigger
    await expect(page.locator('[class*="form-error"],[class*="input-error"]').first()).toBeVisible();
  });

  test('should accept valid inputs without showing field errors', async ({ page }) => {
    await page.fill('input[name="empId"]',        'TT_TEST');
    await page.fill('input[name="name"]',          'Test Employee');
    await page.fill('input[name="companyEmail"]',  'test@tektalis.com');
    await page.fill('input[name="personalEmail"]', 'personal@gmail.com');
    await page.fill('input[name="phoneNumber"]',   '9999999999');

    // No field errors should be visible for the filled fields
    await expect(page.locator('[class*="input-error"]').first()).not.toBeVisible();
  });

  test('should close the modal on cancel', async ({ page }) => {
    const closeBtn = page.locator('button[aria-label="Close"],button:has-text("Cancel")').first();
    await closeBtn.click();
    await expect(page.locator('text=Add New Employee')).not.toBeVisible();
  });
});
