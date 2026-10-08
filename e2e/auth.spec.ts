import { test, expect } from '@playwright/test';

test.describe('Sprint 1: Auth, Profile, and Settings E2E', () => {
  const testEmail = `user_${Date.now()}@example.com`;
  const password = 'Password123!';
  const fullName = 'Test E2E User';

  test('Register, Login, Update Profile, and Change Settings', async ({ page }) => {
    // 1. Navigate to Register page
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('Tạo tài khoản');

    // Fill registration form
    await page.fill('#reg-name', fullName);
    await page.fill('#reg-email', testEmail);
    await page.fill('#reg-password', password);

    // Agree to terms checkbox
    await page.click('input[type="checkbox"]');

    // Submit registration
    await page.click('button:has-text("Bắt đầu")');

    // Should redirect to onboarding or dashboard
    await expect(page).toHaveURL(/\/(onboarding|dashboard)/);

    // 2. Open Profile page
    await page.goto('/profile');
    await expect(page.locator('h1')).toContainText('Hồ sơ cá nhân');
    await expect(page.locator('text=' + fullName).first()).toBeVisible();

    // Edit profile
    await page.click('button:has-text("Chỉnh sửa")');
    const nameInput = page.locator('input[maxlength="80"]');
    await nameInput.fill('Updated E2E Name');
    await page.click('button:has-text("Lưu thay đổi")');

    // Check update confirmation
    await expect(page.locator('text=Hồ sơ đã được cập nhật')).toBeVisible();

    // 3. Open Settings page
    await page.goto('/settings');
    await expect(page.locator('h1')).toContainText('Cài đặt');

    // Toggle daily reminder
    const reminderToggle = page.locator('button').nth(1);
    await reminderToggle.click();

    // Change AI voice to male
    const voiceSelect = page.locator('select').first();
    await voiceSelect.selectOption('male');
    await expect(voiceSelect).toHaveValue('male');

    // Logout
    await page.click('button:has-text("Đăng xuất tài khoản")');
    await expect(page).toHaveURL(/\/login/);
  });
});
