import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const STAFF = 'http://localhost:3002';
const GRADE_ID = '6ba0f5e8-120e-4492-a135-0696839bb80a';

let staffCookies = '';
let staffCsrf = '';
let courseId = '';
let courseCode = '';
let studentPhone = '';
let studentName = '';
let generatedCode = '';
let batchId = '';

const staffHeaders = (csrf = staffCsrf) => ({
  cookie: staffCookies,
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});

const login = async (
  request: Parameters<Parameters<typeof test>[2]>[0]['request'],
  path: string,
  body: Record<string, string>,
  deviceFingerprint?: string,
) => {
  const res = await request.post(`${API}${path}`, {
    data: body,
    headers: deviceFingerprint
      ? { 'x-device-fingerprint': deviceFingerprint }
      : undefined,
  });
  expect(res.ok()).toBeTruthy();
  const cookies = res.headers()['set-cookie'];
  const csrfRes = await request.get(`${API}/auth/csrf-token`, {
    headers: { cookie: cookies },
  });
  expect(csrfRes.ok()).toBeTruthy();
  return { cookies, csrf: (await csrfRes.json()).csrfToken };
};

test.describe.serial('Offline Access Codes Feature', () => {
  let staffPage: Page;
  let studentPage: Page;

  test.beforeAll(async ({ browser }) => {
    staffPage = await browser.newPage();
    studentPage = await browser.newPage();
    await studentPage.addInitScript(() => {
      window.localStorage.setItem(
        'bahrawy-device-fingerprint',
        'e2e-offline-student',
      );
    });
  });

  test.afterAll(async () => {
    await staffPage.close();
    await studentPage.close();
  });

  test('Setup: staff session + course + fresh student', async ({ request }) => {
    const staff = await login(request, '/auth/staff-login', {
      email: 'admin@bahrawy.test',
      password: 'owner_secret',
    });
    staffCookies = staff.cookies;
    staffCsrf = staff.csrf;

    const stamp = Date.now();
    courseCode = `offline-pw-${stamp}`;
    const courseRes = await request.post(`${API}/admin/v1/courses`, {
      data: {
        code: courseCode,
        titleAr: `كورس أوفلاين بلاي رايت ${stamp}`,
        descriptionAr: 'E2E offline course',
      },
      headers: staffHeaders(),
    });
    expect(courseRes.ok()).toBeTruthy();
    courseId = (await courseRes.json()).data.id;

    const phone = `01${['0', '1', '2', '5'][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await request.post(`${API}/auth/register`, {
      data: {
        firstName: 'Offline',
        secondName: 'Code',
        thirdName: 'Student',
        lastName: `E2E${stamp}`,
        phone,
        parentPhone: `01${['0', '1', '2', '5'][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `offline${stamp}@bahrawy.test`,
        schoolName: 'Test School',
        gender: 'MALE',
        city: 'Cairo',
        gradeId: GRADE_ID,
        password: 'student_secret',
      },
    });
    expect(res.ok()).toBeTruthy();
    studentPhone = phone;
    studentName = `Offline Code Student E2E${stamp}`;
  });

  test('Staff generates a batch of codes (API)', async ({ request }) => {
    const res = await request.post(`${API}/admin/v1/offline-codes/generate`, {
      data: { quantity: 1, courseId, gradeId: GRADE_ID, maxUses: 1 },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()).data;
    expect(data.codes).toHaveLength(1);
    generatedCode = data.codes[0].code;
    batchId = data.batch.id;
    expect(generatedCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  test('Student activates the code and gains the course (API)', async ({
    request,
  }) => {
    const student = await login(
      request,
      '/auth/login',
      { phone: studentPhone, password: 'student_secret' },
      'e2e-offline-student',
    );
    const res = await request.post(`${API}/student/offline-codes/activate`, {
      data: { code: generatedCode },
      headers: {
        cookie: student.cookies,
        'x-csrf-token': student.csrf,
        'x-device-fingerprint': 'e2e-offline-student',
      },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.courseId).toBe(courseId);
  });

  test('Staff-admin offline-codes page lists the batch and its code', async () => {
    await staffPage.goto(`${STAFF}/login`);
    await staffPage.fill('input[type="email"]', 'admin@bahrawy.test');
    await staffPage.fill('input[type="password"]', 'owner_secret');
    await staffPage.click('button[type="submit"]');
    await staffPage.waitForURL('**/dashboard');

    await staffPage.goto(`${STAFF}/dashboard/offline-codes`);
    await staffPage.waitForSelector('table');
    await expect(
      staffPage.getByText(/إجمالي الأكواد/).first(),
    ).toBeVisible();

    // switch to batches tab
    await staffPage.getByRole('button', { name: /الدفعات/ }).click();
    await expect(
      staffPage.getByRole('button', { name: /تصدير الأكواد/ }).first(),
    ).toBeVisible();
  });

  test('Export shows the decrypted code for the batch', async ({ request }) => {
    const res = await request.get(
      `${API}/admin/v1/offline-codes/batches/${batchId}/export`,
      { headers: staffHeaders() },
    );
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()).data;
    expect(data.codes.map((c: { code: string }) => c.code)).toContain(
      generatedCode,
    );
  });
});