import { test, expect } from '@playwright/test';

test.describe('Profile Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'TT0001');
    await page.fill('input[type="password"]', 'Mouni@1702');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Open profile from avatar dropdown
    const avatar = page.locator('.avatar').first();
    await avatar.click();
    await page.click('text=Profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should view profile details and open edit modal', async ({ page }) => {
    // Verify ID is visible
    await expect(page.locator('text=TT0001').first()).toBeVisible();
    
    // Click edit button
    const editBtn = page.locator('button:has-text("Edit Profile")');
    await editBtn.click();
    
    // Verify modal opens
    await expect(page.locator('text=Edit Personal Info')).toBeVisible();
    
    // Close modal
    await page.click('button[aria-label="Close"]');
  });

  test('should open change password modal and validate', async ({ page }) => {
    // Click change password button
    const passBtn = page.locator('button:has-text("Change Password")');
    await passBtn.click();
    
    await expect(page.locator('text=Update Password')).toBeVisible();
    
    // Try to submit empty form
    await page.click('button:has-text("Update Password")');
    
    // Check validation errors
    await expect(page.locator('text=Current password is required')).toBeVisible();
    await expect(page.locator('text=New password is required')).toBeVisible();
  });
});
