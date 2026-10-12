import { test, expect } from '@playwright/test';

test.describe('Sprint 3: AI Coach Voice Conversation Flow', () => {
  const password = 'Password123!';

  test('Flow: Select Coach Topic, Start Voice Session, Receive Live Script & End Session', async ({ page }) => {
    const email = `coach_e2e_${Date.now()}@example.com`;

    // 1. Register & complete onboarding to unlock AI Coach
    await page.goto('/register');
    await page.fill('#reg-name', 'Coach Test User');
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

    // 2. Navigate to AI Coach (Screen 14)
    await page.goto('/coach');
    await expect(page).toHaveURL(/\/coach/);
    await expect(page.locator('h1')).toContainText('Luyện nói 1-1 với AI Coach');

    // 3. Verify topic groups and selected topic card
    await expect(page.locator('text=Chủ đề đang chọn')).toBeVisible();
    await expect(page.locator('text=Gợi ý cho bạn')).toBeVisible();
    await expect(page.locator('text=Giao tiếp hằng ngày')).toBeVisible();

    // Verify search filter works
    const searchInput = page.locator('input[placeholder*="Tìm kiếm chủ đề"]');
    await searchInput.fill('Travel');
    await expect(page.locator('text=Favorite Travel Destination')).toBeVisible();

    // Select this topic
    await page.click('text=Favorite Travel Destination');
    await expect(page.locator('text=Chủ đề đang chọn')).toBeVisible();

    // 4. Start Voice Session -> transitions to Screen 15
    await page.click('button:has-text("Bắt đầu nói")');
    await expect(page).toHaveURL(/\/coach\/session\//);

    // Screen 15 dark UI elements
    await expect(page.locator('text=AI Coach Session')).toBeVisible();
    await expect(page.locator('text=LIVE SCRIPT')).toBeVisible();

    // 5. Initial AI Greeting in Live Script
    await expect(page.locator('.speaker-ai')).toBeVisible({ timeout: 10000 });

    // 6. Send text fallback speech input or simulated user speech
    const textInput = page.locator('input[placeholder*="Gõ nội dung nếu micro có vấn đề"]');
    await textInput.fill('I really enjoy traveling to Da Nang because of the beautiful beaches.');
    await page.click('button:has-text("Gửi")');

    // 7. Verify User Live Script segment rendered
    await expect(page.locator('.speaker-user')).toContainText('Da Nang', { timeout: 10000 });

    // 8. Wait for AI Coach response turn
    await expect(page.locator('.speaker-ai').nth(1)).toBeVisible({ timeout: 15000 });

    // 9. End Session via End Button & Modal
    await page.click('button:has-text("Kết thúc")');
    await expect(page.locator('text=Kết thúc phiên luyện nói?')).toBeVisible();

    // Confirm end
    await page.click('button:has-text("Xác nhận kết thúc")');

    // 10. Navigates back to /coach
    await expect(page).toHaveURL(/\/coach/, { timeout: 10000 });
  });
});
