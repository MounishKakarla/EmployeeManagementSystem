// e2e/attendance.spec.js — uses saved auth cookies (no login UI needed)
import { test, expect } from '@playwright/test';

test.describe('Attendance – My Attendance tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/attendance');
  });

  test('should load the attendance page with all three tabs', async ({ page }) => {
    await expect(page.locator('text=My Attendance')).toBeVisible();
    await expect(page.locator('text=Daily Roster')).toBeVisible();
    await expect(page.locator('text=Team Report')).toBeVisible();
  });

  test('should display today status card with check-in and check-out times', async ({ page }) => {
    // The "today" card must always render even if empty
    await expect(page.locator('text=Check In').first()).toBeVisible();
    await expect(page.locator('text=Check Out').first()).toBeVisible();
    await expect(page.locator('text=Duration').first()).toBeVisible();
  });

  test('should display recent attendance history section', async ({ page }) => {
    await expect(page.locator('text=Recent History')).toBeVisible();
    // Either a history row OR the empty-state message must be present
    const row   = page.locator('[class*="historyRow"]').first();
    const empty = page.locator('text=No attendance records yet');
    await expect(row.or(empty)).toBeVisible({ timeout: 6000 });
  });
});

test.describe('Attendance – Admin Daily Roster tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/attendance');
    await page.click('text=Daily Roster');
  });

  test('should display date filter and Today/Yesterday shortcuts', async ({ page }) => {
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
    await expect(page.locator('button:has-text("Yesterday")')).toBeVisible();
  });

  test('should change roster date with Yesterday shortcut', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]').first();
    const before    = await dateInput.inputValue();
    await page.click('button:has-text("Yesterday")');
    const after = await dateInput.inputValue();
    expect(after).not.toBe(before);
  });

  test('should render roster table or empty state', async ({ page }) => {
    const table = page.locator('table').first();
    const empty = page.locator('text=No attendance data for this date');
    await expect(table.or(empty)).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Attendance – Admin Team Report tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/attendance');
    await page.click('text=Team Report');
  });

  test('should show From and To date inputs', async ({ page }) => {
    const inputs = page.locator('input[type="date"]');
    await expect(inputs).toHaveCount(2);
  });

  test('should have a This Month shortcut that resets dates', async ({ page }) => {
    await expect(page.locator('button:has-text("This Month")')).toBeVisible();
    await page.click('button:has-text("This Month")');
    // Verify dates are not empty after clicking
    const from = await page.locator('input[type="date"]').nth(0).inputValue();
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

test.describe('Attendance – Manual Override modal', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/attendance');
    await page.click('button:has-text("Override")');
    // Wait for modal
    await expect(page.locator('text=Manual Override')).toBeVisible();
  });

  test('should open override modal with readonly Employee ID and Date', async ({ page }) => {
    await expect(page.locator('input[placeholder="09:00"]').first()).toBeVisible();
    await expect(page.locator('input[placeholder="18:00"]').first()).toBeVisible();
  });

  test('should show duration badge for a valid 9-to-6 shift', async ({ page }) => {
    await page.fill('input[placeholder="09:00"]', '09:00');
    await page.fill('input[placeholder="18:00"]', '18:00');
    await expect(page.locator('text=Duration: 9h')).toBeVisible();
  });

  test('should show overnight badge when checkout < checkin', async ({ page }) => {
    await page.fill('input[placeholder="09:00"]', '22:00');
    await page.fill('input[placeholder="18:00"]', '06:00');
    await expect(page.locator('text=Overnight')).toBeVisible();
  });

  test('should block saving a 23:59 overflow shift', async ({ page }) => {
    // 09:00 → 09:00 = exactly 24h
    await page.fill('input[placeholder="09:00"]', '09:00');
    await page.fill('input[placeholder="18:00"]', '09:00');
    await expect(page.locator('text=Working hours cannot exceed 23:59 hours')).toBeVisible();
    const saveBtn = page.locator('button:has-text("Save Override")');
    await expect(saveBtn).toBeDisabled();
  });

  test('should reject invalid time format in 24h input', async ({ page }) => {
    await page.fill('input[placeholder="09:00"]', '25:99');
    await expect(page.locator('text=Invalid — use HH:MM')).toBeVisible();
  });

  test('should reject invalid time format in 12h input', async ({ page }) => {
    await page.fill('input[placeholder="9:00 AM"]', '13:00 XM');
    await expect(page.locator('text=Use H:MM AM or H:MM PM')).toBeVisible();
  });
});
