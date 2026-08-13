import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3000';
const STAFF_UI = 'http://localhost:3002';
const EXAM_TITLE = `امتحان إعادة الفتح ${Date.now()}`;

let staffCookies = '';
let staffCsrf = '';
let studentCookies = '';
let studentCsrf = '';
let studentProfileId = '';
let studentName = '';
let courseId = '';
let lessonId = '';
let assessmentId = '';
let attemptId = '';
let sessionId = '';

const staffHeaders = (csrf = staffCsrf) => ({
  cookie: staffCookies,
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const studentHeaders = (csrf = studentCsrf) => ({
  cookie: studentCookies,
  'x-device-fingerprint': 'e2e-shared-seed-device',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});

test.describe.serial('Exam reopen flow (staff-admin) + same-attempt/audit/security', () => {
  let staffPage: Page;

  test.beforeAll(async ({ browser }) => {
    staffPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await staffPage.close();
  });

  test('setup: sessions, course with EXAM lesson + DRAFT assessment, product + entitlement', async ({
    request,
  }) => {
    const staffLogin = await request.post(`${API}/auth/staff-login`, {
      data: { email: 'admin@bahrawy.test', password: 'owner_secret' },
    });
    expect(staffLogin.ok()).toBeTruthy();
    staffCookies = staffLogin.headers()['set-cookie'];
    const staffCsrfRes = await request.get(`${API}/auth/csrf-token`, {
      headers: { cookie: staffCookies },
    });
    staffCsrf = (await staffCsrfRes.json()).csrfToken;
    expect(staffCsrf).toBeTruthy();

    const studentLogin = await request.post(`${API}/auth/login`, {
      data: { phone: '01000000001', password: 'student_secret' },
      headers: { 'x-device-fingerprint': 'e2e-shared-seed-device' },
    });
    expect(studentLogin.ok()).toBeTruthy();
    studentCookies = studentLogin.headers()['set-cookie'];
    const studentCsrfRes = await request.get(`${API}/auth/csrf-token`, {
      headers: { cookie: studentCookies },
    });
    studentCsrf = (await studentCsrfRes.json()).csrfToken;
    expect(studentCsrf).toBeTruthy();

    const me = await request.get(`${API}/auth/me`, {
      headers: { cookie: studentCookies, 'x-device-fingerprint': 'e2e-shared-seed-device' },
    });
    expect(me.ok()).toBeTruthy();
    studentProfileId = (await me.json()).data.profileId;
    studentName = (await me.json()).data.name;

    const h = staffHeaders();
    const course = await request.post(`${API}/admin/v1/courses`, {
      data: { code: `reopen-${Date.now()}`, titleAr: 'E2E Reopen Course' },
      headers: h,
    });
    expect(course.ok()).toBeTruthy();
    courseId = (await course.json()).data.id;

    const chapter = await request.post(`${API}/admin/v1/courses/${courseId}/chapters`, {
      data: { titleAr: 'Chapter' },
      headers: h,
    });
    expect(chapter.ok()).toBeTruthy();
    const chapterId = (await chapter.json()).data.id;

    const unit = await request.post(`${API}/admin/v1/courses/chapters/${chapterId}/units`, {
      data: { titleAr: 'Unit' },
      headers: h,
    });
    expect(unit.ok()).toBeTruthy();

    const lesson = await request.post(
      `${API}/admin/v1/courses/units/${(await unit.json()).data.id}/lessons`,
      { data: { titleAr: EXAM_TITLE, contentType: 'EXAM' }, headers: h },
    );
    expect(lesson.ok()).toBeTruthy();
    lessonId = (await lesson.json()).data.id;

    const assessment = await request.post(`${API}/admin/v1/assessments/lessons/${lessonId}`, {
      data: {
        titleAr: EXAM_TITLE,
        type: 'QUIZ',
        durationMinutes: 30,
        shuffleQuestions: true,
        resultReleaseRule: 'MANUAL',
      },
      headers: h,
    });
    expect(assessment.ok()).toBeTruthy();
    assessmentId = (await assessment.json()).data.id;

    const product = await request.post(`${API}/admin/v1/products`, {
      data: {
        code: `reopen-prod-${Date.now()}`,
        titleAr: 'Reopen Product',
        priceAmount: 100,
        courseIds: [courseId],
      },
      headers: h,
    });
    expect(product.ok()).toBeTruthy();
    const productId = (await product.json()).data.id;

    const grant = await request.post(`${API}/admin/v1/students/${studentProfileId}/entitlements`, {
      data: { productId, reason: 'exam reopen regression' },
      headers: h,
    });
    expect(grant.ok()).toBeTruthy();
  });

  test('publish the assessment (cascades the parent EXAM lesson) and start the exam', async ({
    request,
  }) => {
    const patch = await request.patch(`${API}/admin/v1/assessments/${assessmentId}`, {
      data: {
        titleAr: EXAM_TITLE,
        type: 'QUIZ',
        durationMinutes: 30,
        shuffleQuestions: true,
        resultReleaseRule: 'MANUAL',
        passingScore: null,
        maxAttempts: null,
        status: 'PUBLISHED',
        version: 1,
      },
      headers: staffHeaders(),
    });
    expect(patch.ok()).toBeTruthy();
    expect((await patch.json()).data.status).toBe('PUBLISHED');

    const lesson = await request.get(`${API}/admin/v1/courses/lessons/${lessonId}`, {
      headers: staffHeaders(),
    });
    expect((await lesson.json()).data.status).toBe('PUBLISHED');

    const start = await request.post(`${API}/assessments/${assessmentId}/start`, {
      data: {},
      headers: studentHeaders(),
    });
    expect(start.ok()).toBeTruthy();
    const attempt = (await start.json()).data;
    attemptId = attempt.id;
    sessionId = attempt.examSessionId;
    expect(attemptId).toBeTruthy();
    expect(sessionId).toBeTruthy();
  });

  test('student autosaves an answer before the lock', async ({ request }) => {
    const save = await request.post(`${API}/assessments/attempt/${attemptId}/autosave`, {
      data: { answers: { q1: 'opt-a' } },
      headers: studentHeaders(),
    });
    expect(save.ok()).toBeTruthy();
  });

  test('reporting a violation locks the session', async ({ request }) => {
    const violation = await request.post(
      `${API}/assessments/attempt/${attemptId}/exam-session/violations`,
      {
        data: { reason: 'FULLSCREEN_EXIT' },
        headers: studentHeaders(),
      },
    );
    expect(violation.ok()).toBeTruthy();
    const data = (await violation.json()).data;
    expect(data.status).toBe('LOCKED');
    expect(data.lockReason).toBe('FULLSCREEN_EXIT');
    expect(data.violationCount).toBe(1);

    const blocked = await request.post(`${API}/assessments/attempt/${attemptId}/autosave`, {
      data: { answers: { q1: 'opt-a' } },
      headers: studentHeaders(),
    });
    expect(blocked.status()).toBe(403);
    expect((await blocked.json()).code ?? (await blocked.json()).error?.code).toBe(
      'EXAM_SESSION_LOCKED',
    );
  });

  test('the suspended list exposes the locked session with student + exam info', async ({
    request,
  }) => {
    const res = await request.get(
      `${API}/admin/v1/exam-violations?status=LOCKED&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).data.items;
    const row = items.find((item: any) => item.sessionId === sessionId);
    expect(row).toBeTruthy();
    expect(row.status).toBe('LOCKED');
    expect(row.lockReason).toBe('FULLSCREEN_EXIT');
    expect(row.student.name).toBe(studentName);
    expect(row.exam.titleAr).toBe(EXAM_TITLE);
    expect(typeof row.openCount).toBe('number');
    expect(typeof row.attemptCount).toBe('number');
  });

  test('security: a student cannot reopen the session', async ({ request }) => {
    const res = await request.post(`${API}/admin/v1/exam-violations/${sessionId}/reopen`, {
      data: {},
      headers: studentHeaders(),
    });
    expect([401, 403]).toContain(res.status());
  });

  test('security: reopening an unknown/cross-tenant session 404s', async ({ request }) => {
    const res = await request.post(`${API}/admin/v1/exam-violations/does-not-exist/reopen`, {
      data: {},
      headers: staffHeaders(),
    });
    expect(res.status()).toBe(404);
  });

  test('UI: staff sees the suspended row with an إعادة فتح الاختبار action', async () => {
    await staffPage.goto(`${STAFF_UI}/login`);
    await staffPage.fill('input[type="email"]', 'admin@bahrawy.test');
    await staffPage.fill('input[type="password"]', 'owner_secret');
    await staffPage.click('button[type="submit"]');
    await staffPage.waitForURL('**/dashboard');

    await staffPage.goto(`${STAFF_UI}/dashboard/exam-violations`);
    const row = staffPage.locator('table tbody tr').filter({ hasText: EXAM_TITLE });
    await expect(row.getByRole('button', { name: 'إعادة فتح الاختبار' })).toBeVisible();
  });

  test('UI: confirmation dialog shows student + exam and reopening removes the action', async () => {
    const row = staffPage.locator('table tbody tr').filter({ hasText: EXAM_TITLE });
    await row.getByRole('button', { name: 'إعادة فتح الاختبار' }).click();

    await expect(staffPage.getByText('إعادة فتح الاختبار').first()).toBeVisible();
    const dialog = staffPage.getByRole('dialog');
    await expect(dialog.getByText('الطالب:', { exact: true })).toBeVisible();
    await expect(dialog.getByText(studentName)).toBeVisible();
    await expect(dialog.getByText('الامتحان:', { exact: true })).toBeVisible();
    await expect(dialog.getByText(EXAM_TITLE)).toBeVisible();

    await staffPage.getByRole('button', { name: 'نعم، إعادة فتح الاختبار' }).click();

    await expect(staffPage.getByText('تم إعادة فتح الاختبار للطالب')).toBeVisible();
    await expect(row.getByRole('button', { name: 'إعادة فتح الاختبار' })).not.toBeVisible();
  });

  test('the student is immediately resumable: same attempt accepts answers and submits', async ({
    request,
  }) => {
    const save = await request.post(`${API}/assessments/attempt/${attemptId}/autosave`, {
      data: { answers: { q1: 'opt-a' } },
      headers: studentHeaders(),
    });
    expect(save.ok()).toBeTruthy();

    const submit = await request.post(`${API}/assessments/attempt/${attemptId}/submit`, {
      data: {},
      headers: studentHeaders(),
    });
    expect(submit.ok()).toBeTruthy();

    const session = await request.get(`${API}/assessments/attempt/${attemptId}/exam-session`, {
      headers: studentHeaders(),
    });
    expect(session.ok()).toBeTruthy();
    expect((await session.json()).data.status).toBe('SUBMITTED');
  });

  test('security: reopening an already-active/submitted session conflicts (409)', async ({
    request,
  }) => {
    const res = await request.post(`${API}/admin/v1/exam-violations/${sessionId}/reopen`, {
      data: {},
      headers: staffHeaders(),
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe('EXAM_SESSION_NOT_LOCKED');
  });

  test('audit: EXAM_REOPENED event records actor, attempt, org and previous lock state', async ({
    request,
  }) => {
    const res = await request.get(`${API}/admin/v1/exam-violations/${sessionId}/events`, {
      headers: staffHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const events = (await res.json()).data;
    const reopenEvent = events.find((event: any) => event.eventType === 'EXAM_REOPENED');
    expect(reopenEvent).toBeTruthy();
    expect(reopenEvent.actor).toBeTruthy();
    const meta = reopenEvent.metadata;
    expect(meta.wasStatus).toBe('LOCKED');
    expect(meta.reason).toBe('FULLSCREEN_EXIT');
    expect(meta.attemptId).toBe(attemptId);
    expect(meta.organizationId).toBeTruthy();
  });

  // Real runtime UI check: the student is sitting on the lock screen, the admin
  // unlocks the exam server-side, then the student recovers in-place (retry
  // button / periodic poll) WITHOUT a full page reload and the exam actually
  // opens — the success of the unlock is proven by student access, not by the
  // admin toast.
  test('UI: a blocked student recovers on the same page after the admin unlock', async ({
    browser,
    request,
  }) => {
    const studentPage = await browser.newPage();
    await studentPage.addInitScript(() => {
      window.localStorage.setItem('bahrawy-device-fingerprint', 'e2e-shared-seed-device');
    });
    try {
      await studentPage.goto('http://localhost:3001/login');
      await studentPage.fill('input[type="tel"]', '01000000001');
      await studentPage.fill('input[type="password"]', 'student_secret');
      await studentPage.click('button[type="submit"]');
      await studentPage.waitForURL('**/student');

      const start = await request.post(`${API}/assessments/${assessmentId}/start`, {
        data: { newAttempt: true },
        headers: studentHeaders(),
      });
      expect(start.ok()).toBeTruthy();
      const uiAttempt = (await start.json()).data;
      const uiSessionId = uiAttempt.examSessionId;
      expect(uiSessionId).toBeTruthy();

      const lock = await request.post(
        `${API}/assessments/attempt/${uiAttempt.id}/exam-session/violations`,
        { data: { reason: 'FULLSCREEN_EXIT' }, headers: studentHeaders() },
      );
      expect((await lock.json()).data.status).toBe('LOCKED');

      await studentPage.goto(`http://localhost:3001/student/assessments/${assessmentId}`);
      await expect(studentPage.getByText('تعذر فتح الاختبار')).toBeVisible();
      await expect(studentPage.getByText('تم إيقاف الامتحان')).toBeVisible();

      const reopen = await request.post(`${API}/admin/v1/exam-violations/${uiSessionId}/reopen`, {
        data: {},
        headers: staffHeaders(),
      });
      expect([200, 201]).toContain(reopen.status());

      await studentPage.getByRole('button', { name: 'إعادة المحاولة' }).click();

      await expect(studentPage.getByText('تعذر فتح الاختبار')).not.toBeVisible();
      await expect(studentPage.getByRole('heading', { name: 'وضع ملء الشاشة' })).toBeVisible();

      await studentPage.reload();
      await expect(studentPage.getByRole('heading', { name: 'وضع ملء الشاشة' })).toBeVisible();
    } finally {
      await studentPage.close();
    }
  });
});
