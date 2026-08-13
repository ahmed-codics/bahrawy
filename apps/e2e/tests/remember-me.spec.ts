import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const API = 'http://localhost:3000';
const WEB = 'http://localhost:3001';
const GRADE_ID = '6ba0f5e8-120e-4492-a135-0696839bb80a';
const DEVICE = 'e2e-remember-device';
const PASSWORD = 'RememberE2E!2026';

let studentPhone = '';
let studentId = '';
let studentProfileId = '';
let studentVersion = 1;

test.describe.serial('Remember Me - Playwright', () => {
  test.beforeAll(async ({ request }) => {
    // Fresh student bound to the e2e device so device-lock does not interfere.
    const stamp = Date.now();
    const phone = `01${['0', '1', '2', '5'][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await request.post(`${API}/auth/register`, {
      data: {
        firstName: 'Remember',
        secondName: 'Me',
        thirdName: 'E2E',
        lastName: `Pw${stamp}`,
        phone,
        parentPhone: `01${['0', '1', '2', '5'][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `remember${stamp}@bahrawy.test`,
        schoolName: 'Test School',
        gender: 'MALE',
        city: 'Cairo',
        gradeId: GRADE_ID,
        password: PASSWORD,
      },
      headers: { 'x-device-fingerprint': DEVICE },
    });
    expect(res.ok()).toBeTruthy();
    studentPhone = phone;
    studentId = (await res.json()).accountId;
  });

  test.afterAll(async () => {
    // Cleanup is best-effort; sessions are revoked by the tests themselves.
  });

  async function openLoggedOutContext(browser: import('@playwright/test').Browser): Promise<BrowserContext> {
    const context = await browser.newContext();
    await context.addInitScript((device: string) => {
      window.localStorage.setItem('bahrawy-device-fingerprint', device);
    }, DEVICE);
    return context;
  }

  async function loginThroughUi(
    page: Page,
    rememberMe: boolean,
  ): Promise<void> {
    await page.goto(`${WEB}/login`);
    await page.fill('input[type="tel"]', studentPhone);
    await page.fill('input[type="password"]', PASSWORD);
    if (rememberMe) {
      await page.check('input[type="checkbox"]');
    }
    await page.click('button[type="submit"]');
    await page.waitForURL('**/student');
  }

  test('checkbox "تذكرني على هذا الجهاز" is present and unchecked by default', async ({
    browser,
  }) => {
    const context = await openLoggedOutContext(browser);
    const page = await context.newPage();
    await page.goto(`${WEB}/login`);
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await context.close();
  });

  test('login WITHOUT rememberMe sets a session cookie (no Max-Age) and does not survive a browser restart', async ({
    browser,
  }) => {
    const context = await openLoggedOutContext(browser);
    const page = await context.newPage();
    await loginThroughUi(page, false);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes('bahrawy_session_student'),
    );
    expect(sessionCookie).toBeDefined();
    // Session cookie: expires === -1, meaning "delete on browser close".
    expect(sessionCookie!.expires).toBe(-1);

    // Simulated browser restart: new context, session cookie is dropped.
    await context.close();
    const restarted = await openLoggedOutContext(browser);
    const freshPage = await restarted.newPage();
    await freshPage.goto(`${WEB}/student`);
    await freshPage.waitForURL('**/login');
    await restarted.close();
  });

  test('login WITH rememberMe sets a Max-Age cookie and the session survives a browser restart', async ({
    browser,
  }) => {
    const context = await openLoggedOutContext(browser);
    const page = await context.newPage();
    await loginThroughUi(page, true);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes('bahrawy_session_student'),
    );
    expect(sessionCookie).toBeDefined();
    // Persistent cookie: far-future expires attribute (~30 days).
    expect(sessionCookie!.expires).toBeGreaterThan(Date.now() / 1000);
    expect(sessionCookie!.expires).toBeLessThan(Date.now() / 1000 + 31 * 86400);

    // Simulated browser restart carrying the persisted cookie.
    const persistedCookie = `${sessionCookie!.name}=${sessionCookie!.value}`;
    await context.close();
    const restarted = await openLoggedOutContext(browser);
    await restarted.addCookies([
      {
        name: sessionCookie!.name,
        value: sessionCookie!.value,
        domain: 'localhost',
        path: '/',
      },
    ]);
    const freshPage = await restarted.newPage();
    await freshPage.goto(`${WEB}/student`);
    await freshPage.waitForURL('**/student');
    await restarted.close();
  });

  test('the session cookie is HttpOnly and no password/token is stored in localStorage', async ({
    browser,
  }) => {
    const context = await openLoggedOutContext(browser);
    const page = await context.newPage();
    await loginThroughUi(page, true);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes('bahrawy_session_student'),
    );
    expect(sessionCookie!.httpOnly).toBe(true);

    const storage = await page.evaluate(() => ({ ...window.localStorage }));
    const storageText = JSON.stringify(storage).toLowerCase();
    expect(storageText).not.toContain('password');
    expect(storageText).not.toContain('bahrawy_session');
    expect(storageText).not.toContain('access_token');
    await context.close();
  });

  test('logout revokes the persistent session; the old cookie cannot be reused', async ({
    browser,
  }) => {
    const context = await openLoggedOutContext(browser);
    const page = await context.newPage();
    await loginThroughUi(page, true);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes('bahrawy_session_student'),
    );
    const oldCookie = `${sessionCookie!.name}=${sessionCookie!.value}`;

    // Logout via API (mirrors the UI logout call).
    const csrfRes = await page.request.get(`${API}/auth/csrf-token`);
    const csrfToken = (await csrfRes.json()).csrfToken;
    const logout = await page.request.post(`${API}/auth/logout`, {
      headers: {
        'x-csrf-token': csrfToken,
        'x-device-fingerprint': DEVICE,
      },
    });
    expect(logout.ok()).toBeTruthy();

    // Reusing the old cookie must now be rejected.
    const me = await page.request.get(`${API}/auth/me`, {
      headers: { cookie: oldCookie, 'x-device-fingerprint': DEVICE },
    });
    expect([401, 403]).toContain(me.status());
    await context.close();
  });

  test('suspending the account revokes the remember-me session', async ({
    browser,
  }) => {
    const context = await openLoggedOutContext(browser);
    const page = await context.newPage();
    await loginThroughUi(page, true);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes('bahrawy_session_student'),
    );
    const oldCookie = `${sessionCookie!.name}=${sessionCookie!.value}`;

    // Resolve the student profile id + version via the public me endpoint.
    const me = await page.request.get(`${API}/auth/me`, {
      headers: { cookie: oldCookie, 'x-device-fingerprint': DEVICE },
    });
    expect(me.ok()).toBeTruthy();
    const profileId = (await me.json()).data.profileId;
    expect(profileId).toBeTruthy();
    studentProfileId = profileId;

    // Staff login + suspend via the real admin endpoint.
    const staff = await page.request.post(`${API}/auth/staff-login`, {
      data: { email: 'admin@bahrawy.test', password: 'owner_secret' },
    });
    expect(staff.ok()).toBeTruthy();
    const staffCookies = staff.headers()['set-cookie'];
    const csrfRes = await page.request.get(`${API}/auth/csrf-token`, {
      headers: { cookie: staffCookies },
    });
    const staffCsrf = (await csrfRes.json()).csrfToken;

    const suspend = await page.request.patch(
      `${API}/admin/v1/students/${profileId}/status`,
      {
        data: { status: 'SUSPENDED', reason: 'E2E remember-me suspension', version: 1 },
        headers: { cookie: staffCookies, 'x-csrf-token': staffCsrf },
      },
    );
    expect(suspend.ok()).toBeTruthy();
    studentVersion = (await suspend.json()).data?.version ?? studentVersion;

    // The remember-me session must now be rejected.
    const after = await page.request.get(`${API}/auth/me`, {
      headers: { cookie: oldCookie, 'x-device-fingerprint': DEVICE },
    });
    expect([401, 403]).toContain(after.status());

    // Restore the account so later runs are not polluted.
    const csrf2 = (await (
      await page.request.get(`${API}/auth/csrf-token`, {
        headers: { cookie: staffCookies },
      })
    ).json()).csrfToken;
    await page.request.patch(
      `${API}/admin/v1/students/${profileId}/status`,
      {
        data: { status: 'ACTIVE', reason: 'E2E restore', version: studentVersion },
        headers: { cookie: staffCookies, 'x-csrf-token': csrf2 },
      },
    );
    await context.close();
  });
});