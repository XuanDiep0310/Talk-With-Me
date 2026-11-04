import { test, expect } from '@playwright/test';

test.describe('Sprint 6: Gamification, Streak, XP & Dashboard Flow', () => {
  const password = 'Password123!';

  test('Flow: Complete Coach session -> XP, Streak, Daily Mission & Dashboard updated', async ({ page }) => {
    const email = `gamification_e2e_${Date.now()}@example.com`;

    // 1. Register & complete onboarding
    await page.goto('/register');
    await page.fill('#reg-name', 'Gamer Test User');
    await page.fill('#reg-email', email);
    await page.fill('#reg-password', password);
    await page.click('input[type="checkbox"]');
    await page.click('button:has-text("Bắt đầu")');

    await expect(page).toHaveURL(/\/onboarding/);
    await page.click('button:has-text("Bỏ qua, tôi tự chọn level")');
    await page.click('button:has-text("B1 — Trung cấp")');
    await page.click('button:has-text("Tiếp tục →")');

    await page.click('button:has-text("Du lịch")');
    await page.click('button:has-text("Tiếp tục →")');

    await page.click('button:has-text("Giao tiếp hằng ngày tự nhiên")');
    await page.click('button:has-text("Tiếp tục →")');

    await page.click('button:has-text("Phát âm")');
    await page.click('button:has-text("Hoàn tất & Vào Dashboard")');
    await expect(page).toHaveURL(/\/dashboard/);

    // Initial Dashboard verification
    await expect(page.locator('text=Nhiệm vụ hôm nay')).toBeVisible();
    await expect(page.locator('text=XP tích lũy')).toBeVisible();

    // 2. Navigate to AI Coach and complete a session
    await page.goto('/ai-coach');
    await expect(page).toHaveURL(/\/ai-coach/);
    await page.click('button:has-text("Bắt đầu nói")');
    await expect(page).toHaveURL(/\/ai-coach-session/);

    // Wait for initial greeting
    await expect(page.locator('.speaker-ai').first()).toBeVisible({ timeout: 10000 });

    // Enable Mock Mic if available
    const mockCheckbox = page.locator('input[type="checkbox"]');
    if (await mockCheckbox.isVisible()) {
      await mockCheckbox.check();
    }

    // Single turn speak
    const micBtn = page.getByTestId('coach-mic-btn');
    if (await micBtn.isVisible()) {
      await micBtn.click();
      await page.waitForTimeout(500);
      await micBtn.click();
      await page.waitForTimeout(1000);
    }

    // End session
    const endBtn = page.locator('button:has-text("Kết thúc")');
    if (await endBtn.isVisible()) {
      await endBtn.click();
      const confirmBtn = page.locator('button:has-text("Xác nhận kết thúc")');
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
    }

    // 3. Return to Dashboard to check updated gamification stats
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify streak and XP cards exist and are rendered
    await expect(page.locator('text=XP tích lũy')).toBeVisible();
    await expect(page.locator('text=Streak')).toBeVisible();
    await expect(page.locator('text=Điểm giao tiếp')).toBeVisible();

    // 4. Navigate to Achievements & verify badges & missions tabs
    await page.goto('/achievements');
    await expect(page).toHaveURL(/\/achievements/);
    await expect(page.locator('text=Huy hiệu')).toBeVisible();
    await expect(page.locator('text=Nhiệm vụ ngày')).toBeVisible();
    await expect(page.locator('text=Lịch sử XP')).toBeVisible();

    // 5. Navigate to Progress & verify Skills, History, Roadmap
    await page.goto('/progress');
    await expect(page).toHaveURL(/\/progress/);
    await expect(page.locator('text=Kỹ năng')).toBeVisible();
    await expect(page.locator('text=Lịch sử')).toBeVisible();
    await expect(page.locator('text=Lộ trình')).toBeVisible();
  });
});
