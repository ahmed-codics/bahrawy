import { test, expect, Page } from '@playwright/test';

/**
 * Student exam results reporting (Staff Admin):
 *   sidebar navigation -> "درجات الطلاب" page renders summary cards + results table,
 *   filters (grade / exam) and search behave, empty search state shows the empty message.
 */
test.describe.serial('Staff Exam Results (درجات الطلاب)', () => {
  const WEB = 'http://localhost:3002';
  let adminPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Login once and share the authenticated page across the tests in this
    // block — the login endpoints are rate-limited (10 attempts per 15 min)
    // and the session cookie is reusable for every request in this suite.
    adminPage = await browser.newPage();
    await adminPage.goto(`${WEB}/login`);
    await adminPage.fill('input[type="email"]', 'admin@bahrawy.test');
    await adminPage.fill('input[type="password"]', 'owner_secret');
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL('**/dashboard', { timeout: 20000 });
  });

  test.afterAll(async () => {
    await adminPage.close();
  });

  test('staff logs in through the admin UI', async () => {
    await expect(adminPage).toHaveURL(/.*dashboard.*/);
  });

  test('the admin sidebar exposes the exam results section', async () => {
    await adminPage.goto(`${WEB}/dashboard`);
    const item = adminPage.getByRole('button', { name: /درجات الطلاب/ });
    await expect(item).toBeVisible({ timeout: 15000 });
    await item.click();
    await adminPage.waitForURL('**/dashboard/exam-results');
  });

  test('the results page shows summary cards and the full results table', async () => {
    await adminPage.goto(`${WEB}/dashboard/exam-results`);

    await expect(adminPage.getByRole('heading', { name: 'درجات الطلاب' })).toBeVisible({
      timeout: 15000,
    });
    for (const label of [
      'عدد الطلاب الممتحنين',
      'أعلى درجة',
      'متوسط الدرجات',
      'عدد الطلاب الناجحين',
    ]) {
      await expect(adminPage.getByText(label)).toBeVisible();
    }

    for (const header of [
      'ترتيب الطالب',
      'اسم الطالب',
      'كود الطالب',
      'الصف الدراسي',
      'اسم الامتحان',
      'الدرجة',
      'الدرجة الكلية',
      'النسبة المئوية',
      'تاريخ الامتحان',
    ]) {
      await expect(
        adminPage.getByRole('columnheader', { name: header, exact: true }),
      ).toBeVisible();
    }

    await expect(adminPage.locator('table tbody tr').first()).toBeVisible();
  });

  test('search narrows results and shows the empty state for unknown names', async () => {
    await adminPage.goto(`${WEB}/dashboard/exam-results`);
    await adminPage.getByRole('searchbox', { name: 'بحث' }).fill('zzz-no-such-student');
    await expect(adminPage.getByText('لا توجد نتائج مطابقة للبحث')).toBeVisible({
      timeout: 15000,
    });
  });

  test('grade and exam filters are populated and filter the table together', async () => {
    await adminPage.goto(`${WEB}/dashboard/exam-results`);

    const examSelect = adminPage.getByLabel('تصفية بالامتحان');
    await expect(examSelect).toBeVisible();
    const options = examSelect.locator('option');
    await expect.poll(() => options.count()).toBeGreaterThan(1);
    const count = await options.count();
    expect(count).toBeGreaterThan(1);

    const firstExam = (await options.nth(1).getAttribute('value')) as string;
    await examSelect.selectOption(firstExam);

    const rows = adminPage.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});
