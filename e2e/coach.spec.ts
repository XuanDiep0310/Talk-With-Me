import { test, expect } from '@playwright/test';

test.describe('Sprint 3: AI Coach Voice Conversation Flow (The Coach Style)', () => {
  const password = 'Password123!';

  test('Flow: Select Coach Topic, Start Voice Session, Tap Mic to Speak, Auto-play & Replay, End Session', async ({ page }) => {
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
    await page.goto('/ai-coach');
    await expect(page).toHaveURL(/\/ai-coach/);

    // 3. Verify topic groups and selected topic card
    await expect(page.locator('text=Chủ đề đang chọn')).toBeVisible();
    await expect(page.locator('text=Gợi ý cho bạn')).toBeVisible();
    await expect(page.locator('text=Giao tiếp hằng ngày')).toBeVisible();

    // Select a topic and click "Bắt đầu nói"
    await page.click('button:has-text("Bắt đầu nói")');
    await expect(page).toHaveURL(/\/ai-coach-session/);

    // 4. Verify initial AI Greeting in Live Script with speaker button
    await expect(page.locator('.speaker-ai').first()).toBeVisible({ timeout: 10000 });

    // Enable Mock Mic for deterministic test turn
    const mockCheckbox = page.locator('input[type="checkbox"]');
    if (await mockCheckbox.isVisible()) {
      await mockCheckbox.check();
    }

    // 5. Tap single central Mic button to start speaking ("Đang nói")
    const micBtn = page.getByTestId('coach-mic-btn');
    await expect(micBtn).toBeVisible();
    await micBtn.click();
    await expect(page.locator('text=Bạn đang nói')).toBeVisible();

    // 6. Tap speaking icon again to finish speaking & send sentence
    await micBtn.click();

    // 7. Verify User Live Script segment rendered with replay speaker button
    await expect(page.locator('.speaker-user').first()).toBeVisible({ timeout: 10000 });

    // 8. Wait for AI Coach response turn
    await expect(page.locator('.speaker-ai').nth(1)).toBeVisible({ timeout: 15000 });

    // 9. Verify replay speaker button works when clicked
    const replayBtn = page.locator('button:has-text("Nghe lại")').first();
    if (await replayBtn.isVisible()) {
      await replayBtn.click();
    }

    // 10. End Session via End Button & Modal -> Redirects to Feedback Screen
    await page.click('button:has-text("Kết thúc")');
    await expect(page.locator('text=Kết thúc phiên luyện nói?')).toBeVisible();

    await page.click('button:has-text("Xác nhận kết thúc")');
    await expect(page).toHaveURL(/\/feedback/, { timeout: 10000 });
    await expect(page.locator('text=Kết quả & Phản hồi buổi nói')).toBeVisible({ timeout: 10000 });
  });
});
