import { test, expect } from '@playwright/test';

test.describe('Admin Settings Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'TT0001');
    await page.fill('input[type="password"]', 'Mouni@1702');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to settings and view configuration', async ({ page }) => {
    // Wait for the navigation menu
    await page.click('text=Settings');
    await expect(page).toHaveURL(/\/settings/);
    
    // Check if settings form loads
    await expect(page.locator('text=Company Name')).toBeVisible();
    await expect(page.locator('button:has-text("Save Settings")')).toBeVisible();
  });

  test('should view audit logs', async ({ page }) => {
    // Wait for the navigation menu
    await page.click('text=Audit Logs');
    await expect(page).toHaveURL(/\/audit-logs/);
    
    // Check table
    await expect(page.locator('table')).toBeVisible();
    
    // Check filter
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();
  });

  test('should navigate to holiday calendar and add holiday', async ({ page }) => {
    // Wait for the navigation menu
    await page.click('text=Holidays');
    await expect(page).toHaveURL(/\/holidays/);
    
    // Check add button
    const addBtn = page.locator('button:has-text("Add Holiday")');
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    
    // Check modal
    await expect(page.locator('text=New Holiday')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="date"]')).toBeVisible();
  });
});
