import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const api = 'http://127.0.0.1:8000/api/v1';
const password = 'TestPassword123!';

async function register(request: APIRequestContext, prefix: string) {
  const email = prefix + '-' + randomUUID() + '@example.com';
  const signup = await request.post(api + '/auth/register', {
    data: { email, fullName: 'Editorial Test', password, termsAccepted: true }
  });
  expect(signup.ok()).toBeTruthy();
  const { accessToken } = await signup.json();
  const headers = { Authorization: 'Bearer ' + accessToken };
  const me = await request.get(api + '/me', { headers });
  expect(me.ok()).toBeTruthy();
  return { email, id: (await me.json()).id as string, headers };
}

async function logIn(page: Page, email: string) {
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

test('admin creates and replaces a scenario visible to a learner', async ({ page, browser, request, baseURL }) => {
  test.skip(process.env.RUN_ADMIN_E2E !== 'true', 'Requires an isolated DB and the admin CLI');
  const databaseUrl = process.env.DATABASE_URL;
  expect(databaseUrl).toMatch(/@(?:localhost|127\.0\.0\.1):\d+\/talkwithme_admin_e2e$/);
  test.setTimeout(60_000);

  const admin = await register(request, 'admin');
  execFileSync(process.env.PLAYWRIGHT_PYTHON ?? 'python', ['-m', 'scripts.admin_role', 'grant', admin.id], {
    cwd: resolve('backend'),
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
  const learner = await register(request, 'learner');
  const options = await request.get(api + '/onboarding/options');
  expect(options.ok()).toBeTruthy();
  const choices = await options.json();
  const level = await request.put(api + '/me/level', {
    headers: learner.headers, data: { level: 'B1', source: 'SELF' }
  });
  expect(level.ok()).toBeTruthy();
  const preferences = await request.put(api + '/me/preferences', {
    headers: learner.headers,
    data: {
      interests: [choices.interests[0].key],
      goals: [choices.goals[0].key],
      weakPoints: [choices.weakPoints[0].key]
    }
  });
  expect(preferences.ok()).toBeTruthy();
  expect((await request.post(api + '/me/onboarding/complete', { headers: learner.headers })).ok()).toBeTruthy();

  await page.route('https://**/*', (route) => route.abort());
  await page.goto('/admin/scenarios/new');
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  await logIn(page, admin.email);
  await expect(page).toHaveURL(/\/admin\/scenarios\/new$/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const slug = 'admin-lesson-' + randomUUID();
  const title = 'Bài học gọi món ' + slug.slice(-6);
  await page.getByLabel('Mã đường dẫn').fill(slug);
  await page.getByLabel('Tiêu đề tiếng Việt').fill(title);
  await page.getByLabel('Tiêu đề tiếng Anh').fill('Ordering at a restaurant');
  await page.getByLabel('Bối cảnh').fill('Bạn đang gọi món tại nhà hàng.');
  await page.getByLabel('Vai người học').fill('Thực khách');
  await page.getByLabel('Vai AI').fill('Waiter');
  await page.getByRole('button', { name: 'Thêm mục tiêu' }).click();
  await page.getByLabel('Mục tiêu 1', { exact: true }).fill('Gọi món và cảm ơn');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  for (let index = 1; index <= 4; index += 1) {
    await page.getByRole('button', { name: 'Thêm cụm từ' }).click();
    const group = page.getByRole('group', { name: 'Cụm từ ' + index, exact: true });
    await group.getByLabel('Cụm từ tiếng Anh').fill('Could I order dish ' + index + '?');
    await group.getByLabel('Nghĩa tiếng Việt').fill('Tôi gọi món số ' + index + ' được không?');
    await group.getByLabel('Câu mẫu tiếng Anh').fill('Could I order dish ' + index + ' with rice?');
    await group.getByRole('button', { name: 'Thêm biến thể' }).click();
    await group.getByLabel('Biến thể 1', { exact: true }).fill('May I order dish ' + index + '?');
    for (const [option, text] of ['Can you pay?', 'Where are you?', 'Good evening.'].entries()) {
      await group.getByLabel('Đáp án sai tiếng Anh ' + (option + 1)).fill(text);
    }
    for (const [option, text] of ['Bạn trả tiền được không?', 'Bạn ở đâu?', 'Chào buổi tối.'].entries()) {
      await group.getByLabel('Đáp án sai tiếng Việt ' + (option + 1)).fill(text);
    }
  }
  await page.getByRole('button', { name: /Cụm từ 1 Could/ }).click();
  await page.getByRole('button', { name: 'Đưa cụm từ 1 xuống' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Thêm yêu cầu' }).click();
  await page.getByLabel('Mô tả').fill('Gọi ít nhất một món.');
  await page.getByRole('button', { name: 'Xem trước giao diện người học' }).click();
  const preview = page.getByRole('dialog');
  await expect(preview.getByRole('heading', { name: 'Ordering at a restaurant' })).toBeVisible();
  await expect(preview.getByText(/Could I order dish/)).toHaveText(
    [2, 1, 3, 4].map((index) => 'Could I order dish ' + index + '?')
  );
  await preview.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
  await expect(page).toHaveURL(/\/admin\/scenarios\/[\da-f-]{36}$/);
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByText('Đã xuất bản', { exact: true })).toBeVisible();
  const originalUrl = page.url();

  const learnerPage = await browser.newPage({ baseURL });
  await learnerPage.route('https://**/*', (route) => route.abort());
  try {
    await learnerPage.goto('/login');
    await logIn(learnerPage, learner.email);
    await expect(learnerPage).toHaveURL(/\/dashboard$/);
    await learnerPage.goto('/scenarios/' + slug);
    await expect(learnerPage.getByRole('heading', { name: 'Ordering at a restaurant' })).toBeVisible();

    await page.getByRole('button', { name: 'Nhân bản', exact: true }).click();
    await page.getByLabel('Mã đường dẫn bản nhân').fill(slug + '-new');
    await page.getByRole('button', { name: 'Tạo bản nhân' }).click();
    await expect(page).not.toHaveURL(originalUrl);
    await expect(page.getByText('Bản nháp', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
    await expect(page.getByText('Đã xuất bản', { exact: true })).toBeVisible();

    await page.goto(originalUrl);
    await page.getByRole('button', { name: 'Ẩn bài học', exact: true }).click();
    await page.getByRole('button', { name: 'Xác nhận ẩn' }).click();
    await expect(page.getByText('Đã ẩn', { exact: true })).toBeVisible();
    await learnerPage.reload();
    await expect(learnerPage.getByText('Không thể tải thông tin bài học.')).toBeVisible();
    await learnerPage.goto('/scenarios/' + slug + '-new');
    await expect(learnerPage.getByRole('heading', { name: 'Ordering at a restaurant' })).toBeVisible();
  } finally {
    await learnerPage.close();
  }
});
