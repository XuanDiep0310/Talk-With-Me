import { test, expect } from '@playwright/test';

test.describe('Sprint 2: Onboarding Flows (Self-Selected & Voice Test)', () => {
  const password = 'Password123!';

  test('Flow 1: Complete Onboarding via Self-Selected Level', async ({ page }) => {
    const email = `onboard_self_${Date.now()}@example.com`;

    // 1. Register new user
    await page.goto('/register');
    await page.fill('#reg-name', 'Self Selection User');
    await page.fill('#reg-email', email);
    await page.fill('#reg-password', password);
    await page.click('input[type="checkbox"]');
    await page.click('button:has-text("Bắt đầu")');

    // Should arrive on /onboarding
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.locator('h1')).toContainText('Bắt đầu hành trình tiếng Anh');

    // 2. Choose "Bỏ qua, tôi tự chọn level"
    await page.click('button:has-text("Bỏ qua, tôi tự chọn level")');
    await expect(page.locator('h1')).toContainText('Tự chọn level');

    // Select B2
    await page.click('button:has-text("B2 — Trung cao cấp")');
    await page.click('button:has-text("Tiếp tục →")');

    // 3. Select Interests (Step 3)
    await expect(page.locator('h1')).toContainText('Bạn quan tâm chủ đề nào?');
    await page.click('button:has-text("Du lịch")');
    await page.click('button:has-text("Công nghệ")');
    await page.click('button:has-text("Tiếp tục →")');

    // 4. Select Goals (Step 4)
    await expect(page.locator('h1')).toContainText('Mục tiêu học tập');
    await page.click('button:has-text("Giao tiếp hằng ngày tự nhiên")');
    await page.click('button:has-text("Tiếp tục →")');

    // 5. Select Weak Points (Step 5)
    await expect(page.locator('h1')).toContainText('Kỹ năng muốn cải thiện');
    await page.click('button:has-text("Phát âm")');

    // 6. Complete and navigate to Dashboard
    await page.click('button:has-text("Hoàn tất & Vào Dashboard")');
    await expect(page).toHaveURL(/\/dashboard/);

    // 7. Verify guard: Going back to /onboarding should redirect to /dashboard
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/dashboard/);

    // 8. Verify Profile reflects selected interests and level
    await page.goto('/profile');
    await expect(page.locator('text=B2')).toBeVisible();
    await expect(page.locator('text=Du lịch')).toBeVisible();
    await expect(page.locator('text=Công nghệ')).toBeVisible();
  });

  test('Flow 2: Complete Onboarding via Voice Test (Dev Mock / Fake STT)', async ({ page }) => {
    const email = `onboard_voice_${Date.now()}@example.com`;

    // 1. Register new user
    await page.goto('/register');
    await page.fill('#reg-name', 'Voice Test User');
    await page.fill('#reg-email', email);
    await page.fill('#reg-password', password);
    await page.click('input[type="checkbox"]');
    await page.click('button:has-text("Bắt đầu")');

    await expect(page).toHaveURL(/\/onboarding/);

    // 2. Start Voice Test path
    await page.click('button:has-text("Voice Test để xác định level")');
    await expect(page.locator('h1')).toContainText('Kiểm tra micro');

    // Mic check step
    await page.click('button:has-text("Kiểm tra micro")');
    await expect(page.locator('text=Micro đã sẵn sàng')).toBeVisible();
    await page.click('button:has-text("Bắt đầu Voice Test →")');

    // 3. Question answering
    await expect(page.locator('h1')).toContainText('Voice Test');
    await page.click('button:has-text("Nhấn để bắt đầu nói")');
    await expect(page.locator('text=Đang lắng nghe câu trả lời')).toBeVisible();
    await page.click('button:has-text("Hoàn tất câu trả lời")');

    // Result of answer recognized
    await expect(page.locator('text=Transcript nhận dạng được')).toBeVisible();
    await page.click('button:has-text("Xem kết quả đánh giá →")');

    // 4. Proposed Level result page
    await expect(page.locator('h1')).toContainText('Level đề xuất');
    await page.click('button:has-text("Dùng level đề xuất")');

    // 5. Select Interests
    await expect(page.locator('h1')).toContainText('Bạn quan tâm chủ đề nào?');
    await page.click('button:has-text("Ẩm thực")');
    await page.click('button:has-text("Tiếp tục →")');

    // 6. Select Goals
    await expect(page.locator('h1')).toContainText('Mục tiêu học tập');
    await page.click('button:has-text("Thuyết trình công việc")');
    await page.click('button:has-text("Tiếp tục →")');

    // 7. Select Weak Points
    await expect(page.locator('h1')).toContainText('Kỹ năng muốn cải thiện');
    await page.click('button:has-text("Từ vựng")');

    // 8. Complete to Dashboard
    await page.click('button:has-text("Hoàn tất & Vào Dashboard")');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
