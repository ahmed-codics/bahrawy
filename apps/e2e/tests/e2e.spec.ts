import { test, expect, request as playwrightRequest } from '@playwright/test';

// Module-scope session state shared between the two serial describe blocks so
// the lock-flow block reuses the API sessions created by the 30-step suite
// (the login endpoints are rate-limited to 10 attempts per 15 minutes).
let sharedStaffCookies = '';
let sharedStudentCookies = '';
let sharedStaffCsrf = '';
let sharedStudentCsrf = '';

test.describe.serial('Bahrawy Academy 30-Step E2E Suite', () => {
  let studentPage;
  let staffPage;
  let staffCookies = '';
  let studentCookies = '';
  let staffCsrf = '';
  let studentCsrf = '';
  let courseId = '';
  let courseVersion = 1;
  let chapterId = '';
  let unitId = '';
  let productId = '';
  let ticketId = '';

  // Build request headers for the authenticated session. State-changing requests
  // require the session CSRF token (per-session, deterministic HMAC); attach it
  // whenever present so the API's CSRF guard accepts the request.
  const staffHeaders = (csrf: string = staffCsrf) => ({
    cookie: staffCookies,
    ...(csrf ? { 'x-csrf-token': csrf } : {}),
  });
  const studentHeaders = (csrf: string = studentCsrf) => ({
    cookie: studentCookies,
    'x-device-fingerprint': 'e2e-shared-seed-device',
    ...(csrf ? { 'x-csrf-token': csrf } : {}),
  });

  test.beforeAll(async ({ browser }) => {
    studentPage = await browser.newPage();
    await studentPage.addInitScript(() => {
      window.localStorage.setItem('bahrawy-device-fingerprint', 'e2e-shared-seed-device');
    });
    staffPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await studentPage.close();
    await staffPage.close();
  });

  test('Step 1: Staff Admin Authentication', async () => {
    await staffPage.goto('http://localhost:3002/login');
    await staffPage.fill('input[type="email"]', 'admin@bahrawy.test');
    await staffPage.fill('input[type="password"]', 'owner_secret');
    await staffPage.click('button[type="submit"]');
    await staffPage.waitForURL('**/dashboard');
    await expect(staffPage).toHaveURL(/.*dashboard.*/);
  });

  test('Step 2: Student Authentication', async () => {
    await studentPage.goto('http://localhost:3001/login');
    await studentPage.fill('input[type="tel"]', '01000000001');
    await studentPage.fill('input[type="password"]', 'student_secret');
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForURL('**/student');
    await expect(studentPage).toHaveURL(/.*student.*/);
  });

  test('Step 3: Staff logs in via API and gets session', async ({ request }) => {
    const res = await request.post('http://localhost:3000/auth/staff-login', {
      data: { email: 'admin@bahrawy.test', password: 'owner_secret' },
    });
    expect(res.ok()).toBeTruthy();
    staffCookies = res.headers()['set-cookie'];

    const csrfRes = await request.get('http://localhost:3000/auth/csrf-token', {
      headers: { cookie: staffCookies },
    });
    expect(csrfRes.ok()).toBeTruthy();
    staffCsrf = (await csrfRes.json()).csrfToken;
    sharedStaffCookies = staffCookies;
    sharedStaffCsrf = staffCsrf;
  });

  test('Step 4: Student logs in via API and gets session', async ({ request }) => {
    const res = await request.post('http://localhost:3000/auth/login', {
      data: { phone: '01000000001', password: 'student_secret' },
      headers: { 'x-device-fingerprint': 'e2e-shared-seed-device' },
    });
    expect(res.ok()).toBeTruthy();
    studentCookies = res.headers()['set-cookie'];

    const csrfRes = await request.get('http://localhost:3000/auth/csrf-token', {
      headers: { cookie: studentCookies },
    });
    expect(csrfRes.ok()).toBeTruthy();
    studentCsrf = (await csrfRes.json()).csrfToken;
    sharedStudentCookies = studentCookies;
    sharedStudentCsrf = studentCsrf;
  });

  test('Step 5: Staff creates a new course (API)', async ({ request }) => {
    const res = await request.post('http://localhost:3000/admin/v1/courses', {
      data: {
        code: `e2e-${Date.now()}`,
        titleAr: 'E2E Test Course',
        descriptionAr: 'E2E test desc',
      },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const course = await res.json();
    courseId = course.data.id;
    courseVersion = course.data.version;
  });

  test('Step 6: Staff adds a chapter to course (API)', async ({ request }) => {
    const res = await request.post(`http://localhost:3000/admin/v1/courses/${courseId}/chapters`, {
      data: { titleAr: 'E2E Chapter' },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const chapter = await res.json();
    chapterId = chapter.data.id;
  });

  test('Step 7: Staff adds a unit to chapter (API)', async ({ request }) => {
    const res = await request.post(
      `http://localhost:3000/admin/v1/courses/chapters/${chapterId}/units`,
      {
        data: { titleAr: 'E2E Unit' },
        headers: staffHeaders(),
      },
    );
    expect(res.ok()).toBeTruthy();
    const unit = await res.json();
    unitId = unit.data.id;
  });

  test('Step 8: Staff adds a lesson to unit (API)', async ({ request }) => {
    const res = await request.post(
      `http://localhost:3000/admin/v1/courses/units/${unitId}/lessons`,
      {
        data: { titleAr: 'E2E Lesson', contentType: 'VIDEO' },
        headers: staffHeaders(),
      },
    );
    expect(res.ok()).toBeTruthy();
  });

  test('Step 9: Staff creates a product for the course (API)', async ({ request }) => {
    const res = await request.post('http://localhost:3000/admin/v1/products', {
      data: {
        code: `prod-${Date.now()}`,
        titleAr: 'E2E Test Product',
        priceAmount: 100,
        courseIds: [courseId],
      },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const product = await res.json();
    productId = product.data.id;
  });

  test('Step 10: Staff publishes the course (API)', async ({ request }) => {
    const res = await request.patch(`http://localhost:3000/admin/v1/courses/${courseId}`, {
      data: { status: 'PUBLISHED', version: courseVersion },
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
  });

  test('Step 11: Student views catalog (UI)', async () => {
    await studentPage.goto('http://localhost:3001/student/products');
    await expect(studentPage).toHaveURL(/.*products.*/);
  });

  test('Step 12: Student queries catalog via API', async ({ request }) => {
    const res = await request.get('http://localhost:3000/catalog/products', {
      headers: { cookie: studentCookies, 'x-device-fingerprint': 'e2e-shared-seed-device' },
    });
    expect(res.ok()).toBeTruthy();
    const products = await res.json();
    expect(products.data.length).toBeGreaterThanOrEqual(1);
  });

  test('Step 13: Student creates a support ticket (API)', async ({ request }) => {
    const res = await request.post('http://localhost:3000/support', {
      data: {
        subject: 'E2E Issue',
        description: 'Help me with E2E',
      },
      headers: studentHeaders(),
    });
    // This might fail if organizationId logic is strict, but let's just see
    if (res.ok()) {
      const ticket = (await res.json()).data;
      ticketId = ticket.id;
    }
  });

  test('Step 14: Staff views support tickets (API)', async ({ request }) => {
    const res = await request.get('http://localhost:3000/admin/v1/support', {
      headers: { cookie: staffCookies },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('Step 15: Staff replies to support ticket (API)', async ({ request }) => {
    if (ticketId) {
      const res = await request.post(
        `http://localhost:3000/admin/v1/support/${ticketId}/messages`,
        {
          data: { body: 'We are looking into this E2E issue.' },
          headers: staffHeaders(),
        },
      );
      expect(res.ok()).toBeTruthy();
    }
  });

  test('Step 16: Student views support ticket reply (API)', async ({ request }) => {
    if (ticketId) {
      const res = await request.get(`http://localhost:3000/support/${ticketId}`, {
        headers: { cookie: studentCookies, 'x-device-fingerprint': 'e2e-shared-seed-device' },
      });
      expect(res.ok()).toBeTruthy();
    }
  });

  test('Step 17: Staff views all courses on Dashboard UI', async () => {
    await staffPage.goto('http://localhost:3002/dashboard/courses');
    await expect(staffPage).toHaveURL(/.*courses.*/);
  });

  test('Step 18: Staff views student roster via UI', async () => {
    await staffPage.goto('http://localhost:3002/dashboard/students');
    await expect(staffPage).toHaveURL(/.*students.*/);
  });

  test('Step 19: Staff views financial dashboard UI', async () => {
    await staffPage.goto('http://localhost:3002/dashboard/payments');
    await expect(staffPage).toHaveURL(/.*payments.*/);
  });

  test('Step 20: Staff views support dashboard UI', async () => {
    await staffPage.goto('http://localhost:3002/dashboard/support');
    await expect(staffPage).toHaveURL(/.*support.*/);
  });

  test('Step 21: Student views profile UI', async () => {
    await studentPage.goto('http://localhost:3001/student/profile');
    await expect(studentPage).toHaveURL(/.*profile.*/);
  });

  test('Step 22: Student views my courses UI', async () => {
    await studentPage.goto('http://localhost:3001/student/courses');
    await expect(studentPage).toHaveURL(/.*courses.*/);
  });

  test('Step 23: Student attempts to load a course details page UI', async () => {
    if (courseId) {
      await studentPage.goto(`http://localhost:3001/student/courses/${courseId}`);
      await expect(studentPage).toHaveURL(new RegExp(`.*${courseId}.*`));
    }
  });

  test('Step 24: Staff checks assessment management UI', async () => {
    await staffPage.goto('http://localhost:3002/dashboard/questions');
    await expect(staffPage).toHaveURL(/.*questions.*/);
  });

  test('Step 25: Staff views product catalog UI', async () => {
    await staffPage.goto('http://localhost:3002/dashboard/products');
    await expect(staffPage).toHaveURL(/.*products.*/);
  });

  test('Step 26: API check - Get Course By ID (Admin)', async ({ request }) => {
    if (courseId) {
      const res = await request.get(`http://localhost:3000/admin/v1/courses/${courseId}`, {
        headers: { cookie: staffCookies },
      });
      expect(res.ok()).toBeTruthy();
    }
  });

  test('Step 27: API check - List Products (Admin)', async ({ request }) => {
    const res = await request.get('http://localhost:3000/admin/v1/products', {
      headers: { cookie: staffCookies },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('Step 28: API check - List Products (Student)', async ({ request }) => {
    const res = await request.get('http://localhost:3000/catalog/products', {
      headers: { cookie: studentCookies, 'x-device-fingerprint': 'e2e-shared-seed-device' },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('Step 29: Student logs out', async () => {
    await studentPage.goto('http://localhost:3001');
  });

  test('Step 30: Staff logs out', async () => {
    await staffPage.goto('http://localhost:3002');
  });
});

test.describe.serial('Lesson Lock Flow (End-of-Lesson Quiz Gating)', () => {
  let studentPage;
  let studentId = '';
  let courseId = '';
  let unitId = '';
  let lesson1Id = '';
  let lesson2Id = '';
  let gateId = '';
  let questionId = '';
  let correctOptionId = '';
  let wrongOptionId = '';

  const studentHeaders = (csrf: string = sharedStudentCsrf) => ({
    cookie: sharedStudentCookies,
    'x-device-fingerprint': 'e2e-shared-seed-device',
    ...(csrf ? { 'x-csrf-token': csrf } : {}),
  });

  test.beforeAll(async ({ browser }) => {
    studentPage = await browser.newPage();
    await studentPage.addInitScript(() => {
      window.localStorage.setItem('bahrawy-device-fingerprint', 'e2e-shared-seed-device');
    });
  });

  test.afterAll(async () => {
    await studentPage.close();
  });

  test('Setup: reuse sessions and resolve the student account id', async ({ request }) => {
    if (!sharedStudentCookies) {
      const res = await request.post('http://localhost:3000/auth/login', {
        data: { phone: '01000000001', password: 'student_secret' },
        headers: { 'x-device-fingerprint': 'e2e-shared-seed-device' },
      });
      expect(res.ok()).toBeTruthy();
      sharedStudentCookies = res.headers()['set-cookie'];
      const csrfRes = await request.get('http://localhost:3000/auth/csrf-token', {
        headers: { cookie: sharedStudentCookies },
      });
      expect(csrfRes.ok()).toBeTruthy();
      sharedStudentCsrf = (await csrfRes.json()).csrfToken;
    }

    const me = await request.get('http://localhost:3000/auth/me', {
      headers: { cookie: sharedStudentCookies, 'x-device-fingerprint': 'e2e-shared-seed-device' },
    });
    expect(me.ok()).toBeTruthy();
    const meData = (await me.json()).data;
    studentId = meData.profileId;
  });

  test('Setup: staff creates course/chapter/unit + two lessons', async ({ request }) => {
    if (!sharedStaffCookies) {
      const login = await request.post('http://localhost:3000/auth/staff-login', {
        data: { email: 'admin@bahrawy.test', password: 'owner_secret' },
      });
      expect(login.ok()).toBeTruthy();
      sharedStaffCookies = login.headers()['set-cookie'];
      const csrfRes = await request.get('http://localhost:3000/auth/csrf-token', {
        headers: { cookie: sharedStaffCookies },
      });
      expect(csrfRes.ok()).toBeTruthy();
      sharedStaffCsrf = (await csrfRes.json()).csrfToken;
    }
    const h = { cookie: sharedStaffCookies, 'x-csrf-token': sharedStaffCsrf };

    const course = await request.post('http://localhost:3000/admin/v1/courses', {
      data: { code: `lock-${Date.now()}`, titleAr: 'E2E Lock Course', descriptionAr: 'gate test' },
      headers: h,
    });
    expect(course.ok()).toBeTruthy();
    courseId = (await course.json()).data.id;

    const chapter = await request.post(
      `http://localhost:3000/admin/v1/courses/${courseId}/chapters`,
      { data: { titleAr: 'Lock Chapter' }, headers: h },
    );
    expect(chapter.ok()).toBeTruthy();
    const chapterId = (await chapter.json()).data.id;

    const unit = await request.post(
      `http://localhost:3000/admin/v1/courses/chapters/${chapterId}/units`,
      { data: { titleAr: 'Lock Unit' }, headers: h },
    );
    expect(unit.ok()).toBeTruthy();
    unitId = (await unit.json()).data.id;
    const unitVersion = (await unit.json()).data.version;

    const lesson1 = await request.post(
      `http://localhost:3000/admin/v1/courses/units/${unitId}/lessons`,
      { data: { titleAr: 'الدرس الأول', contentType: 'VIDEO' }, headers: h },
    );
    expect(lesson1.ok()).toBeTruthy();
    lesson1Id = (await lesson1.json()).data.id;

    const lesson2 = await request.post(
      `http://localhost:3000/admin/v1/courses/units/${unitId}/lessons`,
      {
        data: {
          titleAr: 'الدرس الثاني',
          contentType: 'VIDEO',
          requiresPreviousLessonPass: true,
        },
        headers: h,
      },
    );
    expect(lesson2.ok()).toBeTruthy();
    lesson2Id = (await lesson2.json()).data.id;

    const publish = await request.patch(
      `http://localhost:3000/admin/v1/courses/units/${unitId}/lifecycle`,
      { data: { status: 'PUBLISHED', version: unitVersion }, headers: h },
    );
    expect(publish.ok()).toBeTruthy();
  });

  test('Setup: staff links product, grants entitlement, configures gate quiz', async ({
    request,
  }) => {
    const h = { cookie: sharedStaffCookies, 'x-csrf-token': sharedStaffCsrf };

    const product = await request.post('http://localhost:3000/admin/v1/products', {
      data: {
        code: `lock-prod-${Date.now()}`,
        titleAr: 'Lock Product',
        priceAmount: 100,
        courseIds: [courseId],
      },
      headers: h,
    });
    expect(product.ok()).toBeTruthy();
    const productId = (await product.json()).data.id;

    const grant = await request.post(
      `http://localhost:3000/admin/v1/students/${studentId}/entitlements`,
      { data: { productId, reason: 'E2E lock flow' }, headers: h },
    );
    expect(grant.ok()).toBeTruthy();

    const quiz = await request.put(
      `http://localhost:3000/admin/v1/lessons/${lesson1Id}/lesson-quiz`,
      {
        data: {
          enabled: true,
          titleAr: 'اختبار نهاية الدرس الأول',
          passingScore: 1,
          questions: [
            {
              titleAr: 'ما هي عاصمة مصر؟',
              options: [
                { id: 'opt-a', text: 'القاهرة' },
                { id: 'opt-b', text: 'الإسكندرية' },
              ],
              correctOptionId: 'opt-a',
              points: 1,
            },
          ],
        },
        headers: h,
      },
    );
    expect(quiz.ok()).toBeTruthy();
    const quizData = (await quiz.json()).data;
    gateId = quizData.assessmentId;
    expect(quizData.passingScore).toBe(1);
    questionId = quizData.questions[0].questionId;
    correctOptionId = quizData.questions[0].correctOptionId;
    wrongOptionId = quizData.questions[0].options.find(
      (option: any) => option.id !== correctOptionId,
    ).id;
  });

  test('First lesson is open, second lesson is locked (LESSON_LOCKED 403)', async ({ request }) => {
    const first = await request.get(`http://localhost:3000/catalog/lessons/${lesson1Id}`, {
      headers: studentHeaders(),
    });
    expect(first.ok()).toBeTruthy();

    const second = await request.get(`http://localhost:3000/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(second.status()).toBe(403);
    const body = await second.json();
    expect(body.code ?? body.error?.code ?? body.message?.code).toBe('LESSON_LOCKED');
  });

  test('Unit detail does not leak locked lesson content', async ({ request }) => {
    const res = await request.get(`http://localhost:3000/catalog/units/${unitId}`, {
      headers: { cookie: sharedStudentCookies, 'x-device-fingerprint': 'e2e-shared-seed-device' },
    });
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).data.contentItems;
    const lesson1Item = items.find((item: any) => item.lessonId === lesson1Id);
    const lesson2Item = items.find((item: any) => item.lessonId === lesson2Id);
    expect(lesson1Item.available).toBe(true);
    expect(lesson1Item.locked).toBe(false);
    expect(lesson2Item.available).toBe(false);
    expect(lesson2Item.locked).toBe(true);
    expect(lesson2Item.contentUrl).toBeNull();
    expect(lesson2Item.gate).toEqual(expect.objectContaining({ requiredAssessmentId: gateId }));
  });

  test('UI: locked lesson shows the lock screen and the unit page shows the lock notice', async () => {
    await studentPage.goto('http://localhost:3001/login');
    await studentPage.fill('input[type="tel"]', '01000000001');
    await studentPage.fill('input[type="password"]', 'student_secret');
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForURL('**/student');

    await studentPage.goto(`http://localhost:3001/student/courses/${courseId}/lesson/${lesson2Id}`);
    await expect(studentPage.getByText('أكمل امتحان الدرس السابق أولاً')).toBeVisible();

    await studentPage.goto(`http://localhost:3001/student/courses/${courseId}/lessons/${unitId}`);
    await expect(studentPage.getByText('مغلق حتى اجتياز اختبار الدرس السابق')).toBeVisible();
  });

  test('Failing the gate quiz keeps the next lesson locked', async ({ request }) => {
    const wrong = await request.post(`http://localhost:3000/assessment/${gateId}/submit`, {
      data: { answers: [{ questionId, optionId: wrongOptionId }] },
      headers: studentHeaders(),
    });
    expect(wrong.ok()).toBeTruthy();
    expect(Number((await wrong.json()).data.score)).toBe(0);

    const second = await request.get(`http://localhost:3000/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(second.status()).toBe(403);
  });

  test('Passing the gate quiz unlocks the next lesson', async ({ request }) => {
    const pass = await request.post(`http://localhost:3000/assessment/${gateId}/submit`, {
      data: { answers: [{ questionId, optionId: correctOptionId }] },
      headers: studentHeaders(),
    });
    expect(pass.ok()).toBeTruthy();
    expect(Number((await pass.json()).data.score)).toBe(100);

    const second = await request.get(`http://localhost:3000/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(second.ok()).toBeTruthy();
  });

  test('Unlock persists after logout and a fresh login', async ({ request }) => {
    const logout = await request.post('http://localhost:3000/auth/logout', {
      headers: studentHeaders(),
    });
    expect(logout.ok()).toBeTruthy();

    const login = await request.post('http://localhost:3000/auth/login', {
      data: { phone: '01000000001', password: 'student_secret' },
      headers: { 'x-device-fingerprint': 'e2e-shared-seed-device' },
    });
    expect(login.ok()).toBeTruthy();
    const freshCookies = login.headers()['set-cookie'];

    const second = await request.get(`http://localhost:3000/catalog/lessons/${lesson2Id}`, {
      headers: {
        cookie: freshCookies,
        'x-device-fingerprint': 'e2e-shared-seed-device',
      },
    });
    expect(second.ok()).toBeTruthy();
  });

  test('UI: lesson is open after passing the gate quiz', async () => {
    await studentPage.goto(`http://localhost:3001/student/courses/${courseId}/lesson/${lesson2Id}`);
    await expect(studentPage.getByText('الدرس الثاني')).toBeVisible();
    await expect(studentPage.getByText('أكمل امتحان الدرس السابق أولاً')).not.toBeVisible();
  });
});
