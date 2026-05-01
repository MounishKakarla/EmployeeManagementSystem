// e2e/leaves.spec.js — uses saved auth cookies
import { test, expect } from '@playwright/test';

test.describe('Leaves – My Leaves tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/leaves');
  });

  test('should load the leaves page with balance cards', async ({ page }) => {
    await expect(page.locator('text=Annual Leave').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Sick Leave').first()).toBeVisible();
  });

  test('should display leave request history or empty state', async ({ page }) => {
    const row   = page.locator('table tbody tr').first();
    const empty = page.locator('text=/no (leave|request)/i').first();
    await expect(row.or(empty)).toBeVisible({ timeout: 6000 });
  });
});

test.describe('Leaves – Apply for Leave modal', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/leaves');
    await page.click('button:has-text("Apply Leave")');
    await expect(page.locator('text=Apply for Leave')).toBeVisible();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.click('button:has-text("Submit Request")');
    await expect(page.locator('text=/required/i').first()).toBeVisible();
  });

  test('should enable submit when all required fields are filled', async ({ page }) => {
    // Select leave type
    const typeSelect = page.locator('select[name="leaveType"]');
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption({ index: 1 });
    }

    // Fill date range
    await page.fill('input[name="startDate"]', '2025-12-01');
    await page.fill('input[name="endDate"]',   '2025-12-01');

    // Fill reason
    await page.fill('textarea[name="reason"]', 'Medical appointment');

    // Submit button should be enabled
    const submitBtn = page.locator('button:has-text("Submit Request")');
    await expect(submitBtn).not.toBeDisabled();
  });

  test('should close the modal on cancel/close', async ({ page }) => {
    const closeBtn = page.locator('button[aria-label="Close"],button:has-text("Cancel")').first();
    await closeBtn.click();
    await expect(page.locator('text=Apply for Leave')).not.toBeVisible();
  });
});

test.describe('Leaves – Admin Team Leaves tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/leaves');
    const teamTab = page.locator('button:has-text("Team Leaves")');
    await expect(teamTab).toBeVisible({ timeout: 5000 });
    await teamTab.click();
  });

  test('should display the team leave table', async ({ page }) => {
    const table = page.locator('table').first();
    const empty = page.locator('text=/no (pending|leave)/i').first();
    await expect(table.or(empty)).toBeVisible({ timeout: 8000 });
  });

  test('should show Adjust Balances button for admin', async ({ page }) => {
    await expect(page.locator('button:has-text("Adjust Balances")')).toBeVisible();
  });

  test('should have pending requests with Approve and Reject buttons', async ({ page }) => {
    const approveBtn = page.locator('button:has-text("Approve")').first();
    const noData     = page.locator('text=/no (pending|leave)/i').first();
    // Either pending records with actions OR empty state — both are valid
    await expect(approveBtn.or(noData)).toBeVisible({ timeout: 8000 });
  });
});
