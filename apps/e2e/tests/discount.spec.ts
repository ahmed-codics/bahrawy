import { test, expect } from '@playwright/test';

/**
 * Discount pricing E2E:
 *   admin sets originalAmount & final price -> API persists -> reload keeps it ->
 *   student catalog/UI renders crossed-out price + "X% OFF" ->
 *   payment order amount always equals the final (DB) price.
 */
test.describe.serial('Course Discount Pricing End-to-End', () => {
  const API = 'http://localhost:3000';
  const WEB = 'http://localhost:3001';
  const uid = `disc-${Date.now()}`;
  const courseTitle = `Discount E2E ${uid}`;

  let staffCookies = '';
  let staffCsrf = '';
  let studentCookies = '';
  let studentCsrf = '';
  let gradeId = '';
  let courseId = '';
  let courseProductId = '';
  let orderId = '';

  const staffHeaders = () => ({
    cookie: staffCookies,
    'x-csrf-token': staffCsrf,
  });
  const studentHeaders = () => ({
    cookie: studentCookies,
    'x-csrf-token': studentCsrf,
  });

  test('logs in staff via API', async ({ request }) => {
    const login = await request.post(`${API}/auth/staff-login`, {
      data: { email: 'admin@bahrawy.test', password: 'owner_secret' },
    });
    expect(login.ok()).toBeTruthy();
    staffCookies = login.headers()['set-cookie'];
    const csrf = await request.get(`${API}/auth/csrf-token`, {
      headers: { cookie: staffCookies },
    });
    staffCsrf = (await csrf.json()).csrfToken;
  });

  test('logs in student via API and reads their grade', async ({ request }) => {
    const login = await request.post(`${API}/auth/login`, {
      data: { phone: '01000000001', password: 'student_secret' },
    });
    expect(login.ok()).toBeTruthy();
    studentCookies = login.headers()['set-cookie'];
    const csrf = await request.get(`${API}/auth/csrf-token`, {
      headers: { cookie: studentCookies },
    });
    studentCsrf = (await csrf.json()).csrfToken;

    const me = await request.get(`${API}/dashboard/student`, {
      headers: { cookie: studentCookies },
    });
    gradeId = (await me.json()).data?.profile?.gradeId;
  });

  test('staff creates a course in the student grade', async ({ request }) => {
    const res = await request.post(`${API}/admin/v1/courses`, {
      data: { code: uid, titleAr: courseTitle, gradeId: gradeId || undefined },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    courseId = (await res.json()).data.id;
  });

  test('admin saves original=2000 / final=1000 and the API persists it', async ({ request }) => {
    const res = await request.post(`${API}/admin/v1/products/course/${courseId}/commerce`, {
      data: {
        titleAr: courseTitle,
        priceAmount: 1000,
        originalAmount: 2000,
        currency: 'EGP',
        version: 1,
      },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const product = (await res.json()).data;
    courseProductId = product.id;
    const price = product.prices[0];
    expect(Number(price.amount)).toBe(1000);
    expect(Number(price.originalAmount)).toBe(2000);
  });

  test('reloading the admin course keeps the original price', async ({ request }) => {
    const res = await request.get(`${API}/admin/v1/courses/${courseId}`, {
      headers: staffHeaders(),
    });
    const cp = (await res.json()).data.courseProduct;
    expect(cp.id).toBe(courseProductId);
    expect(Number(cp.prices[0].amount)).toBe(1000);
    expect(Number(cp.prices[0].originalAmount)).toBe(2000);
  });

  test('editing the price keeps the original price (2000 -> 2400)', async ({ request }) => {
    const current = await (
      await request.get(`${API}/admin/v1/courses/${courseId}`, { headers: staffHeaders() })
    ).json();
    const currentVersion = current.data.courseProduct.version;

    const res = await request.post(`${API}/admin/v1/products/course/${courseId}/commerce`, {
      data: {
        titleAr: courseTitle,
        priceAmount: 1200,
        originalAmount: 2400,
        currency: 'EGP',
        version: currentVersion,
      },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    expect(Number((await res.json()).data.prices[0].originalAmount)).toBe(2400);

    const reload = await request.get(`${API}/admin/v1/courses/${courseId}`, {
      headers: staffHeaders(),
    });
    const price = (await reload.json()).data.courseProduct.prices[0];
    expect(Number(price.amount)).toBe(1200);
    expect(Number(price.originalAmount)).toBe(2400);
  });

  test('admin publishes the discounted course', async ({ request }) => {
    const res = await request.patch(`${API}/admin/v1/courses/${courseId}`, {
      data: { status: 'PUBLISHED', version: 1 },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
  });

  test('student catalog returns final + original prices (50% OFF)', async ({ request }) => {
    const res = await request.get(`${API}/catalog/courses`, {
      headers: { cookie: studentCookies },
    });
    const courses = (await res.json()).data;
    const course = courses.find((c: any) => c.titleAr === courseTitle);
    expect(course).toBeTruthy();
    const product = course.products
      .map((entry: any) => entry.product)
      .find((p: any) => p.type === 'COURSE');
    expect(product).toBeTruthy();
    expect(Number(product.prices[0].amount)).toBe(1200);
    expect(Number(product.prices[0].originalAmount)).toBe(2400);
  });

  test('student UI shows crossed-out original + final + "50% OFF"', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${WEB}/login`);
    await page.fill('input[type="tel"], input[name="phone"]', '01000000001');
    await page.fill('input[type="password"]', 'student_secret');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/student');

    await page.goto(`${WEB}/student/courses`);
    const card = page.locator('article.student-course-card', { hasText: courseTitle });
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByText('50% OFF')).toBeVisible();
    await expect(card.locator('s').first()).toBeVisible();
    await page.close();
  });

  test('student payment order uses the final price from the DB', async ({ request }) => {
    const res = await request.get(`${API}/catalog/courses`, {
      headers: { cookie: studentCookies },
    });
    const course = (await res.json()).data.find((c: any) => c.titleAr === courseTitle);
    const product = course.products
      .map((entry: any) => entry.product)
      .find((p: any) => p.type === 'COURSE');
    const priceId = product.prices[0].id;

    const created = await request.post(`${API}/payments/order`, {
      data: {
        productId: product.id,
        priceId,
        referenceNumber: `REF-${uid}`,
        idempotencyKey: `order-${uid}`,
      },
      headers: studentHeaders(),
    });
    expect(created.ok()).toBeTruthy();
    orderId = (await created.json()).data.id;

    const order = await (
      await request.get(`${API}/payment/orders/${orderId}`, { headers: studentHeaders() })
    ).json();
    expect(Number(order.data.amountRequested)).toBe(1200);
  });

  test('courses without an original price keep working (no markup)', async ({ request }) => {
    const res = await request.post(`${API}/admin/v1/products`, {
      data: {
        code: `${uid}-plain`,
        titleAr: `Plain Product ${uid}`,
        priceAmount: 200,
        status: 'PUBLISHED',
      },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const product = (await res.json()).data;
    expect(product.prices[0].originalAmount).toBeNull();

    const catalog = await (
      await request.get(`${API}/catalog/products`, { headers: { cookie: studentCookies } })
    ).json();
    const seen = catalog.data.find((p: any) => p.id === product.id);
    expect(seen.prices[0].originalAmount).toBeNull();
    expect(Number(seen.prices[0].amount)).toBe(200);
  });
});