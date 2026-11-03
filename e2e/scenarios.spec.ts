import { test, expect } from '@playwright/test';

test.describe('Sprint 5: Scenario Lessons, Chunks, Reflex Drill & Roleplay Evaluation Flow', () => {
  const password = 'Password123!';

  test('Flow: Scenario Library -> Detail 3 Tabs -> Drill Skip/Next -> Roleplay -> Mission Evaluation Report', async ({ page }) => {
    const email = `scenario_e2e_${Date.now()}@example.com`;

    // 1. Register & complete onboarding
    await page.goto('/register');
    await page.fill('#reg-name', 'Scenario Learner');
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

    // 2. Navigate to Scenarios Library (Screen 17)
    await page.goto('/scenarios');
    await expect(page).toHaveURL(/\/scenarios/);
    await expect(page.locator('text=Thư viện tình huống')).toBeVisible();

    // Verify category group tabs and filter
    await expect(page.locator('text=Đời sống hằng ngày').first()).toBeVisible();
    await expect(page.locator('text=Giao tiếp xã hội').first()).toBeVisible();

    // Search for supermarket scenario
    const searchInput = page.locator('input[placeholder*="Tìm"]');
    await searchInput.fill('siêu thị');

    // Click on Supermarket scenario card
    const scenarioCard = page.locator('button:has-text("Mua sắm tại siêu thị")').first();
    await expect(scenarioCard).toBeVisible();
    await scenarioCard.click();

    // 3. Scenario Detail (Screen 18 & 19)
    await expect(page).toHaveURL(/\/scenarios\/|\/scenario-detail/);
    await expect(page.locator('text=Mua sắm tại siêu thị')).toBeVisible();

    // Tab 1: Context & Goals
    await expect(page.locator('text=Bối cảnh & Mục tiêu')).toBeVisible();
    await expect(page.locator('text=Mục tiêu nhiệm vụ cần đạt')).toBeVisible();

    // Switch to Tab 2: Chunks
    await page.click('button:has-text("2. Mẫu câu (Chunks)")');
    await expect(page.locator('text=Các mẫu câu (Language Chunks) quan trọng')).toBeVisible();

    // Switch to Tab 3: Reflex Drill
    await page.click('button:has-text("3. Luyện phản xạ")');
    await expect(page.locator('text=Luyện phản xạ trước khi Roleplay')).toBeVisible();
    await expect(page.locator('text=Nói lại')).toBeVisible();
    await expect(page.locator('text=Bỏ qua')).toBeVisible();

    // Click "Bỏ qua" to advance chunk in drill
    await page.click('button:has-text("Bỏ qua")');

    // 4. Start Roleplay
    const startRoleplayBtn = page.locator('button:has-text("Bắt đầu Roleplay ngay")');
    await expect(startRoleplayBtn).toBeVisible();
    await startRoleplayBtn.click();

    await expect(page).toHaveURL(/\/scenario-roleplay/);

    // 5. Roleplay Screen
    await expect(page.locator('text=Roleplay Tình huống')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Mẫu câu gợi ý')).toBeVisible();

    // Type a message in fallback input
    const input = page.locator('input[placeholder*="Gõ câu thoại"]');
    if (await input.isVisible()) {
      await input.fill('Excuse me, where can I find the fresh produce section?');
      await page.click('button:has-text("Gửi")');
    }

    // 6. Complete Roleplay
    await page.click('button:has-text("Hoàn thành")');
    await expect(page.locator('text=Kết thúc phiên Roleplay?')).toBeVisible();
    await page.click('button:has-text("Xác nhận hoàn thành")');

    // 7. Mission Evaluation Report
    await expect(page).toHaveURL(/\/scenario-result/);
    await expect(page.locator('text=Đánh giá kết quả Roleplay')).toBeVisible();
    await expect(page.locator('text=Đánh giá từng mục tiêu nhiệm vụ')).toBeVisible();
    await expect(page.locator('text=Chunk bạn đã dùng tốt')).toBeVisible();
    await expect(page.locator('text=Chunk nên luyện thêm')).toBeVisible();
  });
});
