import { test, expect, type Page, type Browser } from '@playwright/test';

const API = 'http://localhost:3000';
const STAFF = 'http://localhost:3002';
const WEB = 'http://localhost:3001';

const GRADE_ID = '6ba0f5e8-120e-4492-a135-0696839bb80a';

let staffCookies = '';
let staffCsrf = '';

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

const registerStudent = async (
  request: Parameters<Parameters<typeof test>[2]>[0]['request'],
) => {
  const stamp = Date.now();
  const phone = `01${['0','1','2','5'][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`;
  const res = await request.post(`${API}/auth/register`, {
    data: {
      firstName: 'Lock',
      secondName: 'Device',
      thirdName: 'Student',
      lastName: `E2E${stamp}`,
      phone,
      parentPhone: `01${['0','1','2','5'][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `lock${stamp}@bahrawy.test`,
      schoolName: 'Test School',
      gender: 'MALE',
      city: 'Cairo',
      gradeId: GRADE_ID,
      password: 'student_secret',
    },
  });
  expect(res.ok()).toBeTruthy();
  return { phone, name: `Lock Device Student E2E${stamp}` };
};

const studentApiLogin = async (
  request: Parameters<Parameters<typeof test>[2]>[0]['request'],
  phone: string,
  deviceFingerprint: string,
) => {
  const res = await request.post(`${API}/auth/login`, {
    data: { phone, password: 'student_secret' },
    headers: { 'x-device-fingerprint': deviceFingerprint },
  });
  return res;
};

test.describe.serial('Device Lock Feature (one device per student)', () => {
  let staffPage: Page;
  let deviceAPage: Page;
  let deviceBPage: Page;

  let phone: string;
  let studentName = '';

  test.beforeAll(async ({ browser }) => {
    staffPage = await browser.newPage();
    deviceAPage = await browser.newPage();
    deviceBPage = await browser.newPage();
    await deviceAPage.addInitScript(() => {
      window.localStorage.setItem(
        'bahrawy-device-fingerprint',
        'e2e-device-lock-a',
      );
    });
    await deviceBPage.addInitScript(() => {
      window.localStorage.setItem(
        'bahrawy-device-fingerprint',
        'e2e-device-lock-b',
      );
    });
  });

  test.afterAll(async () => {
    await staffPage.close();
    await deviceAPage.close();
    await deviceBPage.close();
  });

  test('Setup: staff session + fresh student', async ({ request }) => {
    const staff = await login(request, '/auth/staff-login', {
      email: 'admin@bahrawy.test',
      password: 'owner_secret',
    });
    staffCookies = staff.cookies;
    staffCsrf = staff.csrf;
    const registered = await registerStudent(request);
    phone = registered.phone;
    studentName = registered.name;
  });

  test('Device A registers the primary device on login', async ({ request }) => {
    const res = await studentApiLogin(request, phone, 'e2e-device-lock-a');
    expect(res.ok()).toBeTruthy();
  });

  test('Device B (unknown) is rejected and the account is blocked', async ({
    request,
  }) => {
    const res = await studentApiLogin(request, phone, 'e2e-device-lock-b');
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain('DEVICE_BLOCKED');
  });

  test('Staff sees the blocked student in the banned list with forensics', async () => {
    await staffPage.goto(`${STAFF}/login`);
    await staffPage.fill('input[type="email"]', 'admin@bahrawy.test');
    await staffPage.fill('input[type="password"]', 'owner_secret');
    await staffPage.click('button[type="submit"]');
    await staffPage.waitForURL('**/dashboard');

    await staffPage.goto(`${STAFF}/dashboard/device-locks`);
    await staffPage.waitForSelector('table');
    const studentRow = staffPage
      .getByRole('row')
      .filter({ hasText: studentName });
    await expect(studentRow).toBeVisible();
    await expect(
      studentRow.getByText('جهاز غير معروف', { exact: true }),
    ).toBeVisible();
  });

  test('Staff unlocks the account and Device A can log in again', async ({
    request,
  }) => {
    await staffPage.getByRole('button', { name: /فتح الحساب/ }).first().click();
    await staffPage.getByRole('button', { name: /نعم، فتح الحساب/ }).click();
    await expect(
      staffPage.getByText('تم فتح حساب الطالب'),
    ).toBeVisible();

    const res = await studentApiLogin(request, phone, 'e2e-device-lock-a');
    expect(res.ok()).toBeTruthy();
  });

  test('Device B is blocked again, allow-device promotes it to primary', async ({
    request,
  }) => {
    const block = await studentApiLogin(request, phone, 'e2e-device-lock-b');
    expect(block.status()).toBe(403);

    await staffPage.goto(`${STAFF}/dashboard/device-locks`);
    await staffPage.waitForSelector('table');
    await expect(
      staffPage.getByText(studentName).first(),
    ).toBeVisible();

    await staffPage
      .getByRole('button', { name: /السماح بالجهاز/ })
      .first()
      .click();
    await staffPage.getByRole('button', { name: /نعم، السماح بهذا الجهاز/ }).click();
    await expect(
      staffPage.getByText('تم السماح بالجهاز الحالي وإعادة تفعيل الحساب'),
    ).toBeVisible();

    const allowed = await studentApiLogin(request, phone, 'e2e-device-lock-b');
    expect(allowed.ok()).toBeTruthy();
  });

  test('Device A can no longer log in after allow-device promoted Device B', async ({
    request,
  }) => {
    const res = await studentApiLogin(request, phone, 'e2e-device-lock-a');
    expect(res.status()).toBe(403);
  });

  test('Staff resets the primary device and Device A is the primary again', async ({
    request,
  }) => {
    await staffPage.goto(`${STAFF}/dashboard/device-locks`);
    await staffPage.waitForSelector('table');
    await expect(
      staffPage.getByText(studentName).first(),
    ).toBeVisible();

    await staffPage
      .getByRole('button', { name: /إعادة تعيين الجهاز/ })
      .first()
      .click();
    await staffPage.getByRole('button', { name: /نعم، إعادة التعيين/ }).click();
    await expect(
      staffPage.getByText('تمت إعادة تعيين الجهاز الأساسي وإعادة تفعيل الحساب'),
    ).toBeVisible();

    const res = await studentApiLogin(request, phone, 'e2e-device-lock-a');
    expect(res.ok()).toBeTruthy();
  });

  test('Student UI: Device A can log in end-to-end after reset', async () => {
    await deviceAPage.goto(`${WEB}/login`);
    await deviceAPage.fill('input[type="tel"]', phone);
    await deviceAPage.fill('input[type="password"]', 'student_secret');
    await deviceAPage.click('button[type="submit"]');
    await deviceAPage.waitForURL('**/student');
    await expect(deviceAPage).toHaveURL(/.*student.*/);
  });
});
