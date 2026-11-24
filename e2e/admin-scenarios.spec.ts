import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const browserApi = 'http://localhost:8000/api/v1';
const api = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:8000/api/v1';
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

async function prepareBrowser(page: Page) {
  await page.route('https://**/*', (route) => route.abort());
  if (process.env.PLAYWRIGHT_API_URL) {
    await page.route(browserApi + '/**', (route) =>
      route.continue({ url: route.request().url().replace(browserApi, api) }));
  }
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

  await prepareBrowser(page);
  await page.goto('/admin/scenarios/new');
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  await logIn(page, admin.email);
  await expect(page).toHaveURL(/\/admin\/scenarios\/new$/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const slug = 'admin-lesson-' + randomUUID();
  const title = 'Bài học gọi món ' + slug.slice(-6);
  await page.getByLabel('Tiêu đề tiếng Việt').fill(title);
  await expect(page.getByLabel('Mã đường dẫn')).toBeHidden();
  await page.getByText('Thiết lập nâng cao', { exact: true }).click();
  await expect(page.getByLabel('Mã đường dẫn')).toHaveValue('bai-hoc-goi-mon-' + slug.slice(-6));
  await page.getByLabel('Mã đường dẫn').fill(slug);
  await page.getByText('Thiết lập nâng cao', { exact: true }).click();
  await page.getByLabel('Tiêu đề tiếng Anh').fill('Ordering at a restaurant');
  await page.getByLabel('Bối cảnh').fill('Bạn đang gọi món tại nhà hàng.');
  await page.getByRole('textbox', { name: 'Vai người học', exact: true }).fill('Thực khách');
  await page.getByRole('textbox', { name: 'Vai AI', exact: true }).fill('Waiter');
  await page.getByRole('button', { name: 'Thêm mục tiêu' }).click();
  await page.getByLabel('Mục tiêu 1', { exact: true }).fill('Gọi món và cảm ơn');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Về danh sách bài học' }).click();
  await expect(page).toHaveURL(/\/admin\/scenarios\/new$/);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/scenarios\/new$/);
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
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Bài học còn thiếu nội dung');
  await expect(page.getByLabel('Mô tả')).toBeFocused();
  await page.getByLabel('Mô tả').fill('Gọi ít nhất một món.');
  await page.getByRole('button', { name: 'Xem trước giao diện người học' }).click();
  const preview = page.getByRole('dialog');
  await expect(preview.getByRole('heading', { name: 'Ordering at a restaurant' })).toBeVisible();
  await expect(preview.getByText(/Could I order dish/)).toHaveText(
    [2, 1, 3, 4].map((index) => 'Could I order dish ' + index + '?')
  );
  await preview.getByRole('button', { name: 'Đóng', exact: true }).click();
  let failPublish = true;
  await page.route('**/api/v1/admin/scenarios/*/status', async (route) => {
    if (route.request().method() !== 'PATCH' || !failPublish) {
      await route.fallback();
      return;
    }
    failPublish = false;
    await route.fulfill({
      status: 422,
      headers: { 'access-control-allow-origin': new URL(page.url()).origin },
      json: {
        code: 'SCENARIO_NOT_READY',
        details: { fields: { 'chunks.0.distractorsEn': 'Add three distinct incorrect answers.' } }
      }
    });
  });
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByText('Đã lưu bản nháp.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Đáp án sai tiếng Anh 1', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/scenarios\/[\da-f-]{36}$/);
  await expect(page.getByText('Đã xuất bản', { exact: true })).toBeVisible();
  const originalUrl = page.url();

  const learnerPage = await browser.newPage({ baseURL });
  await prepareBrowser(learnerPage);
  try {
    await learnerPage.goto('/login');
    await logIn(learnerPage, learner.email);
    await expect(learnerPage).toHaveURL(/\/dashboard$/);
    await learnerPage.goto('/scenarios/' + slug);
    await expect(learnerPage.getByRole('heading', { name: 'Ordering at a restaurant' })).toBeVisible();

    const duplicated = page.waitForResponse((response) => response.url().endsWith('/duplicate'));
    await page.getByRole('button', { name: 'Tạo bản chỉnh sửa' }).click();
    const replacement = await (await duplicated).json();
    await expect(page).not.toHaveURL(originalUrl);
    await expect(page.getByText('Bản nháp', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Nhiệm vụ & kiểm tra/ }).click();
    await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
    await expect(page.getByText('Đã xuất bản', { exact: true })).toBeVisible();

    await page.goto(originalUrl);
    await page.getByRole('button', { name: 'Ẩn bài học', exact: true }).click();
    await page.getByRole('button', { name: 'Xác nhận ẩn' }).click();
    await expect(page.getByText('Đã ẩn', { exact: true })).toBeVisible();
    await learnerPage.reload();
    await expect(learnerPage.getByText('Không thể tải thông tin bài học.')).toBeVisible();
    await learnerPage.goto('/scenarios/' + replacement.slug);
    await expect(learnerPage.getByRole('heading', { name: 'Ordering at a restaurant' })).toBeVisible();

    await page.goto('/admin/scenarios');
    await page.getByRole('searchbox', { name: 'Tìm bài học' }).fill(slug);
    await expect(page.getByRole('button', { name: 'Tất cả (2)', exact: true })).toBeVisible();
    const catalog = page.getByRole('region', { name: 'Bảng bài học' });
    expect(await catalog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    const originalPath = new URL(originalUrl).pathname;
    const original = page.getByRole('row').filter({ has: page.locator(`a[href="${originalPath}"]`) });
    await original.getByRole('button', { name: 'Xem nhanh' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
    await original.getByRole('switch').click();
    await expect(original.getByRole('switch')).toHaveAttribute('aria-checked', 'true');

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Tổng quan quản trị' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Buổi luyện đã kết thúc' })).toBeVisible();
    await page.getByRole('link', { name: 'Nhóm chủ đề', exact: true }).click();
    const categorySuffix = slug.slice(-6);
    await page.getByRole('textbox', { name: 'Tên nhóm', exact: true }).first().fill('Đặt phòng ' + categorySuffix);
    await expect(page.getByRole('textbox', { name: 'Mã nhóm', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Thêm nhóm' }).click();
    await expect(page.getByText('DAT_PHONG_' + categorySuffix.toUpperCase(), { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Tài khoản', exact: true }).first().click();
    await page.getByRole('searchbox', { name: 'Tìm tài khoản' }).fill(learner.email);
    const row = page.getByRole('row').filter({ hasText: learner.email });
    await row.getByRole('button', { name: 'Cấp quyền admin' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
    await expect(row.getByRole('button', { name: 'Thu hồi quyền' })).toBeVisible();
    await row.getByRole('button', { name: 'Khóa', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
    await expect(row.getByRole('button', { name: 'Mở khóa' })).toBeVisible();

    await page.goto('/admin/scenarios/new');
    const topic = 'Đặt phòng khách sạn ' + slug.slice(-6);
    await page.getByLabel('Chủ đề cho AI').fill(topic);
    await page.getByRole('button', { name: 'B1', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo bài bằng AI' }).click();
    await expect(page.getByLabel('Tiêu đề tiếng Việt')).toHaveValue(topic);
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByRole('heading', { name: 'Cụm từ (5/6)' })).toBeVisible();
    await page.getByRole('button', { name: 'Gợi ý đáp án nhiễu' }).click();
    await expect(page.getByRole('textbox', { name: 'Đáp án sai tiếng Anh 1', exact: true }))
      .toHaveValue('Are you staying here?');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(page).toHaveURL(/\/admin\/scenarios\/[\da-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Cụm từ (5/6)' })).toBeVisible();
  } finally {
    await learnerPage.close();
  }
});

test('admin reviews and enables an AI Coach topic', async ({ page, request }) => {
  test.skip(process.env.RUN_ADMIN_E2E !== 'true', 'Requires an isolated DB and the admin CLI');
  const admin = await register(request, 'topic-editor');
  execFileSync(process.env.PLAYWRIGHT_PYTHON ?? 'python', ['-m', 'scripts.admin_role', 'grant', admin.id], {
    cwd: resolve('backend'),
    env: process.env,
  });
  await prepareBrowser(page);
  await page.goto('/admin/coach-topics');
  await logIn(page, admin.email);
  await page.getByRole('button', { name: 'Tạo chủ đề' }).click();
  await page.getByLabel('Ý tưởng cho AI').fill('Practice planning a weekend');
  await page.getByRole('button', { name: 'Soạn bản nháp' }).click();
  await expect(page.getByRole('status')).toContainText('Đã điền bản nháp');
  const title = 'Weekend plans ' + randomUUID();
  await page.getByRole('region', { name: 'Thông tin chủ đề' }).getByLabel('Tiêu đề').fill(title);
  await page.getByRole('button', { name: 'Lưu chủ đề' }).click();
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toContainText('Đã ẩn');
  await row.getByRole('button', { name: 'Hiện', exact: true }).click();
  await expect(row).toContainText('Đang hiển thị');
  await row.getByRole('button', { name: 'Ẩn', exact: true }).click();
  await expect(row).toContainText('Đã ẩn');
});

test('admin edits a rule and opens the XP ledger', async ({ page, request }) => {
  test.skip(process.env.RUN_ADMIN_E2E !== 'true', 'Requires an isolated DB and the admin CLI');
  const admin = await register(request, 'gamification-admin');
  execFileSync(process.env.PLAYWRIGHT_PYTHON ?? 'python', ['-m', 'scripts.admin_role', 'grant', admin.id], {
    cwd: resolve('backend'), env: process.env,
  });
  await prepareBrowser(page);
  await page.goto('/admin/gamification');
  await logIn(page, admin.email);
  const daily = page.locator('form').filter({ has: page.getByRole('heading', { name: 'DAILY_MISSION', exact: true }) });
  const amount = daily.getByLabel('Điểm XP');
  const previous = await amount.inputValue();
  await amount.fill(previous === '74' ? '75' : '74');
  await daily.getByRole('button', { name: 'Lưu quy tắc' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu quy tắc XP');
  await amount.fill(previous);
  await daily.getByRole('button', { name: 'Lưu quy tắc' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu quy tắc XP');
  await page.getByRole('button', { name: 'Sổ cái XP' }).click();
  await expect(page.getByRole('columnheader', { name: 'Mã giao dịch' })).toBeVisible();
});

test('admin inspects a session and revokes the learner login', async ({ page, request }) => {
  test.skip(process.env.RUN_ADMIN_E2E !== 'true', 'Requires an isolated DB and the admin CLI');
  const admin = await register(request, 'qa-admin');
  const learner = await register(request, 'qa-learner');
  execFileSync(process.env.PLAYWRIGHT_PYTHON ?? 'python', ['-m', 'scripts.admin_role', 'grant', admin.id], {
    cwd: resolve('backend'), env: process.env,
  });
  const choices = await (await request.get(api + '/onboarding/options')).json();
  expect((await request.put(api + '/me/level', {
    headers: learner.headers, data: { level: 'A2', source: 'SELF' },
  })).ok()).toBeTruthy();
  expect((await request.put(api + '/me/preferences', {
    headers: learner.headers,
    data: { interests: [choices.interests[0].key], goals: [choices.goals[0].key], weakPoints: [choices.weakPoints[0].key] },
  })).ok()).toBeTruthy();
  expect((await request.post(api + '/me/onboarding/complete', { headers: learner.headers })).ok()).toBeTruthy();
  const created = await request.post(api + '/coach/sessions', { headers: learner.headers, data: {} });
  expect(created.status()).toBe(201);
  const session = await created.json();

  await prepareBrowser(page);
  await page.goto('/admin/sessions/' + session.id);
  await logIn(page, admin.email);
  await page.getByRole('button', { name: 'Mở transcript' }).click();
  await expect(page.getByText(session.initialMessage, { exact: true })).toBeVisible();
  await page.getByLabel('Lỗi chấm điểm').check();
  await page.getByRole('button', { name: 'Lưu nhãn QA' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu nhãn QA');
  await page.goto('/admin/users/' + learner.id);
  await page.getByRole('button', { name: 'Thu hồi phiên đăng nhập' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByRole('status')).toContainText('Đã thu hồi các phiên đăng nhập');
  expect((await request.get(api + '/me', { headers: learner.headers })).status()).toBe(401);
});
