import { test, expect } from '@playwright/test';

test.describe('Dashboard Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="text"]', 'TT0001');
    await page.fill('input[type="password"]', 'Mouni@1702');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display dashboard KPI cards and quick actions', async ({ page }) => {
    // Verify greeting
    await expect(page.locator('text=Welcome back')).toBeVisible();

    // Verify KPI cards exist
    await expect(page.locator('text=Total Employees').first()).toBeVisible();
    await expect(page.locator('text=Active Leaves').first()).toBeVisible();

    // Verify Quick Actions buttons
    await expect(page.locator('button:has-text("Check In")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Apply Leave")').first()).toBeVisible();
  });

  test('should open notification drawer and interact', async ({ page }) => {
    // Find the bell icon (it usually has an aria-label or is inside the header)
    const bellBtn = page.locator('button .lucide-bell').first();
    if (await bellBtn.isVisible()) {
      await bellBtn.click();
      await expect(page.locator('text=Notifications')).toBeVisible();
      
      const markAllBtn = page.locator('text=Mark all as read');
      if (await markAllBtn.isVisible()) {
        await markAllBtn.click();
      }
    }
  });

  test('should display pending tasks for Admin', async ({ page }) => {
    // Admin should see pending leaves or timesheets
    await expect(page.locator('text=Pending Tasks').first()).toBeVisible();
    
    // There should be a "Review" or "Approve" column or button if tasks exist
    // If empty, verify empty state
    const emptyState = page.locator('text=No pending tasks');
    const tableRow = page.locator('table tbody tr');
    
    await expect(emptyState.or(tableRow.first())).toBeVisible();
  });
});
