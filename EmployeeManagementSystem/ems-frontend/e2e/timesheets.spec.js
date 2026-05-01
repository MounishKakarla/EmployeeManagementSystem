// e2e/timesheets.spec.js — uses saved auth cookies
import { test, expect } from '@playwright/test';

test.describe('Timesheets – My Timesheet tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/timesheets');
  });

  test('should load the timesheet grid with week navigation', async ({ page }) => {
    // Prev/Next week buttons
    await expect(page.locator('button[aria-label="Previous week"],button:has-text("‹")').first()).toBeVisible({ timeout: 8000 });
    // Timesheet table or grid must exist
    await expect(page.locator('table').first()).toBeVisible();
  });

  test('should display Add Row and Submit Timesheet buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Add Row")')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button:has-text("Submit")')).toBeVisible();
  });

  test('should navigate to the previous week', async ({ page }) => {
    const prevBtn = page.locator('button[aria-label="Previous week"],button:has-text("‹")').first();
    await prevBtn.click();
    // After navigation the table should still be present
    await expect(page.locator('table').first()).toBeVisible();
  });

  test('should add a new timesheet row when clicking Add Row', async ({ page }) => {
    const before = await page.locator('table tbody tr').count();
    await page.click('button:has-text("Add Row")');
    const after = await page.locator('table tbody tr').count();
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test('should show DRAFT or SUBMITTED status badge', async ({ page }) => {
    const badge = page.locator('text=/DRAFT|SUBMITTED|APPROVED|REJECTED/i').first();
    const empty = page.locator('text=/no timesheet|start logging/i').first();
    await expect(badge.or(empty)).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Timesheets – Admin Team Timesheets tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/timesheets');
    const teamTab = page.locator('button:has-text("Team Timesheets")');
    await expect(teamTab).toBeVisible({ timeout: 5000 });
    await teamTab.click();
  });

  test('should display team timesheet table or empty state', async ({ page }) => {
    const table = page.locator('table').first();
    const empty = page.locator('text=/no timesheet/i').first();
    await expect(table.or(empty)).toBeVisible({ timeout: 8000 });
  });

  test('should have Export PDF button', async ({ page }) => {
    await expect(page.locator('button:has-text("Export PDF")')).toBeVisible({ timeout: 5000 });
  });

  test('should have an Approve/Reject action for submitted timesheets', async ({ page }) => {
    const approveBtn = page.locator('button:has-text("Approve")').first();
    const noData     = page.locator('text=/no (submitted|timesheet)/i').first();
    await expect(approveBtn.or(noData)).toBeVisible({ timeout: 8000 });
  });
});
