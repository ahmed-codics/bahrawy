import { test, expect } from '@playwright/test';

// FAILED-quiz admin unlock (ExamGrant) regression.
//
// Proves the "فتح الامتحان للطالب" flow for a FAILED case end-to-end against the
// real API + PostgreSQL:
//   - a student who fails at the attempt limit is blocked from retaking
//   - the student surfaces in the unified exam-violations list as caseType FAILED
//   - the admin unlock endpoint creates exactly ONE extra attempt (a grant)
//   - the previous FAILED attempt stays intact in history (no deletion)
//   - after the granted retake, the limit is enforced again (one grant == one try)
//   - the grant is student-scoped: another student cannot use it
//   - unlock authorization is enforced (student cannot unlock; unknown student 404s)
//
// The pass-then-unlock lesson-gating behaviour is covered by lock-gating.spec.ts
// and lesson-prerequisite-gating.spec.ts; this spec focuses on the grant mechanics.

const API = 'http://localhost:3000';
const EXAM_TITLE = `امتحان فتح المحاولة ${Date.now()}`;

let staffCookies = '';
let staffCsrf = '';
let studentCookies = '';
let studentCsrf = '';
let student2Cookies = '';
let student2Csrf = '';
let studentProfileId = '';
let student2ProfileId = '';
let studentAccountId = '';
let student2AccountId = '';
let studentName = '';
let courseId = '';
let lessonId = '';
let assessmentId = '';

const staffHeaders = (csrf = staffCsrf) => ({
  cookie: staffCookies,
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const studentHeaders = (csrf = studentCsrf) => ({
  cookie: studentCookies,
  'x-device-fingerprint': 'exam-unlock-device',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const student2Headers = (csrf = student2Csrf) => ({
  cookie: student2Cookies,
  'x-device-fingerprint': 'exam-unlock-device-2',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});

const login = async (
  request: any,
  path: string,
  body: Record<string, string>,
) => {
  const res = await request.post(`${API}${path}`, { data: body });
  expect(res.ok()).toBeTruthy();
  const cookies = res.headers()['set-cookie'];
  const csrfRes = await request.get(`${API}/auth/csrf-token`, {
    headers: { cookie: cookies },
  });
  expect(csrfRes.ok()).toBeTruthy();
  return { cookies, csrf: (await csrfRes.json()).csrfToken };
};

const codeFromError = async (res: any) => {
  const body = await res.json();
  return body.code ?? body.error?.code ?? body.message?.code;
};

test.describe.serial('FAILED admin unlock (ExamGrant) flow', () => {
  test('setup: sessions, EXAM lesson + published assessment (maxAttempts=1, passingScore=50), entitlements', async ({
    request,
  }) => {
    const staff = await login(request, '/auth/staff-login', {
      email: 'admin@bahrawy.test',
      password: 'owner_secret',
    });
    staffCookies = staff.cookies;
    staffCsrf = staff.csrf;

    const s1 = await login(request, '/auth/login', {
      phone: '01000000001',
      password: 'student_secret',
    });
    studentCookies = s1.cookies;
    studentCsrf = s1.csrf;

    const me1 = await request.get(`${API}/auth/me`, {
      headers: { cookie: studentCookies },
    });
    const me1Body = (await me1.json()).data;
    studentProfileId = me1Body.profileId;
    studentAccountId = me1Body.accountId ?? me1Body.id;
    studentName = me1Body.name;

    const student2Phone = `011${Math.floor(10000000 + Math.random() * 90000000)}`;
    const reg = await request.post(`${API}/auth/register`, {
      data: {
        firstName: 'Grant',
        secondName: 'Isolation',
        thirdName: 'Two',
        lastName: 'Student',
        phone: student2Phone,
        parentPhone: `011${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `grant-iso${Date.now()}@bahrawy.test`,
        schoolName: 'Test School',
        gender: 'MALE',
        city: 'Cairo',
        gradeId: '6ba0f5e8-120e-4492-a135-0696839bb80a',
        password: 'student_secret',
      },
    });
    expect(reg.ok()).toBeTruthy();
    const s2 = await login(request, '/auth/login', {
      phone: student2Phone,
      password: 'student_secret',
    });
    student2Cookies = s2.cookies;
    student2Csrf = s2.csrf;
    const me2 = await request.get(`${API}/auth/me`, {
      headers: { cookie: student2Cookies },
    });
    const me2Body = (await me2.json()).data;
    student2ProfileId = me2Body.profileId;
    student2AccountId = me2Body.accountId ?? me2Body.id;

    const h = staffHeaders();
    const course = await request.post(`${API}/admin/v1/courses`, {
      data: { code: `unlock-${Date.now()}`, titleAr: 'E2E Unlock Course' },
      headers: h,
    });
    expect(course.ok()).toBeTruthy();
    courseId = (await course.json()).data.id;

    const chapter = await request.post(
      `${API}/admin/v1/courses/${courseId}/chapters`,
      { data: { titleAr: 'Chapter' }, headers: h },
    );
    expect(chapter.ok()).toBeTruthy();
    const chapterId = (await chapter.json()).data.id;

    const unit = await request.post(
      `${API}/admin/v1/courses/chapters/${chapterId}/units`,
      { data: { titleAr: 'Unit' }, headers: h },
    );
    expect(unit.ok()).toBeTruthy();
    const unitId = (await unit.json()).data.id;

    const lesson = await request.post(
      `${API}/admin/v1/courses/units/${unitId}/lessons`,
      { data: { titleAr: EXAM_TITLE, contentType: 'EXAM' }, headers: h },
    );
    expect(lesson.ok()).toBeTruthy();
    lessonId = (await lesson.json()).data.id;

    const assessment = await request.post(
      `${API}/admin/v1/assessments/lessons/${lessonId}`,
      {
        data: {
          titleAr: EXAM_TITLE,
          type: 'QUIZ',
          durationMinutes: 0,
          shuffleQuestions: false,
          resultReleaseRule: 'IMMEDIATE',
        },
        headers: h,
      },
    );
    expect(assessment.ok()).toBeTruthy();
    assessmentId = (await assessment.json()).data.id;

    // Publish with a finite attempt limit and a passing score so that a
    // no-answer submission (score 0) counts as a real FAILED attempt.
    const patch = await request.patch(
      `${API}/admin/v1/assessments/${assessmentId}`,
      {
        data: {
          titleAr: EXAM_TITLE,
          type: 'QUIZ',
          durationMinutes: 0,
          shuffleQuestions: false,
          resultReleaseRule: 'IMMEDIATE',
          passingScore: 50,
          maxAttempts: 1,
          status: 'PUBLISHED',
          version: 1,
        },
        headers: h,
      },
    );
    expect(patch.ok()).toBeTruthy();
    expect((await patch.json()).data.status).toBe('PUBLISHED');

    const product = await request.post(`${API}/admin/v1/products`, {
      data: {
        code: `unlock-prod-${Date.now()}`,
        titleAr: 'Unlock Product',
        priceAmount: 100,
        courseIds: [courseId],
      },
      headers: h,
    });
    expect(product.ok()).toBeTruthy();
    const productId = (await product.json()).data.id;

    for (const profileId of [studentProfileId, student2ProfileId]) {
      const grant = await request.post(
        `${API}/admin/v1/students/${profileId}/entitlements`,
        { data: { productId, reason: 'unlock grant regression' }, headers: h },
      );
      expect(grant.ok()).toBeTruthy();
    }
  });

  test('student fails the single allowed attempt and is then blocked from retrying', async ({
    request,
  }) => {
    const start = await request.post(
      `${API}/assessments/${assessmentId}/start`,
      { data: {}, headers: studentHeaders() },
    );
    expect(start.ok()).toBeTruthy();
    const attemptId = (await start.json()).data.id;
    expect(attemptId).toBeTruthy();

    const submit = await request.post(
      `${API}/assessments/attempt/${attemptId}/submit`,
      { data: {}, headers: studentHeaders() },
    );
    expect(submit.ok()).toBeTruthy();
    const outcome = (await submit.json()).data;
    expect(Number(outcome.score)).toBeLessThan(50);
    expect(outcome.passed).toBe(false);

    // maxAttempts=1 reached with no grant -> a fresh attempt is refused.
    const blocked = await request.post(
      `${API}/assessments/${assessmentId}/start`,
      { data: { newAttempt: true }, headers: studentHeaders() },
    );
    expect(blocked.status()).toBe(403);
    expect(await codeFromError(blocked)).toBe('ASSESSMENT_ATTEMPT_LIMIT_REACHED');
  });

  test('the failed student appears in the unified list as caseType FAILED', async ({
    request,
  }) => {
    const res = await request.get(
      `${API}/admin/v1/exam-violations?caseType=FAILED&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).data.items;
    const row = items.find(
      (item: any) =>
        item.assessmentId === assessmentId &&
        item.accountId === studentAccountId,
    );
    expect(row).toBeTruthy();
    expect(row.caseType).toBe('FAILED');
    expect(row.passingScore).toBe(50);
    expect(row.score).toBeLessThan(50);
    expect(row.reason).toContain('فشل في الاختبار');
    expect(row.student.name).toBe(studentName);
  });

  test('security: a student cannot call the unlock endpoint', async ({
    request,
  }) => {
    const res = await request.post(
      `${API}/admin/v1/exam-violations/assessments/${assessmentId}/students/${studentAccountId}/unlock`,
      { data: {}, headers: studentHeaders() },
    );
    expect([401, 403]).toContain(res.status());
  });

  test('security: unlocking an unknown student 404s', async ({ request }) => {
    const res = await request.post(
      `${API}/admin/v1/exam-violations/assessments/${assessmentId}/students/does-not-exist/unlock`,
      { data: {}, headers: staffHeaders() },
    );
    expect(res.status()).toBe(404);
  });

  test('admin unlock grants exactly ONE extra attempt; previous attempt is preserved', async ({
    request,
  }) => {
    const unlock = await request.post(
      `${API}/admin/v1/exam-violations/assessments/${assessmentId}/students/${studentAccountId}/unlock`,
      { data: {}, headers: staffHeaders() },
    );
    expect([200, 201]).toContain(unlock.status());
    expect((await unlock.json()).data.unlocked).toBe(true);

    // The student can now start a fresh attempt (grant consumed on start).
    const retake = await request.post(
      `${API}/assessments/${assessmentId}/start`,
      { data: { newAttempt: true }, headers: studentHeaders() },
    );
    expect(retake.ok()).toBeTruthy();
    const retakeAttempt = (await retake.json()).data;
    expect(retakeAttempt.id).toBeTruthy();
    expect(retakeAttempt.unlockedByAdmin).toBe(true);

    const submitAgain = await request.post(
      `${API}/assessments/attempt/${retakeAttempt.id}/submit`,
      { data: {}, headers: studentHeaders() },
    );
    expect(submitAgain.ok()).toBeTruthy();

    // Both attempts remain in history — the old FAILED attempt was NOT deleted.
    const results = await request.get(
      `${API}/assessment/${assessmentId}/results`,
      { headers: studentHeaders() },
    );
    expect(results.ok()).toBeTruthy();
    const attempts = (await results.json()).data;
    expect(attempts.length).toBe(2);

    // The single grant is spent: another retake is refused again.
    const blockedAgain = await request.post(
      `${API}/assessments/${assessmentId}/start`,
      { data: { newAttempt: true }, headers: studentHeaders() },
    );
    expect(blockedAgain.status()).toBe(403);
    expect(await codeFromError(blockedAgain)).toBe(
      'ASSESSMENT_ATTEMPT_LIMIT_REACHED',
    );
  });

  test('isolation: student A unlock does not grant student B an extra attempt', async ({
    request,
  }) => {
    // Student B exhausts their own single allowed attempt.
    const start = await request.post(
      `${API}/assessments/${assessmentId}/start`,
      { data: {}, headers: student2Headers() },
    );
    expect(start.ok()).toBeTruthy();
    const attemptId = (await start.json()).data.id;
    const submit = await request.post(
      `${API}/assessments/attempt/${attemptId}/submit`,
      { data: {}, headers: student2Headers() },
    );
    expect(submit.ok()).toBeTruthy();

    // Student A's grant must NOT let student B retake.
    const blocked = await request.post(
      `${API}/assessments/${assessmentId}/start`,
      { data: { newAttempt: true }, headers: student2Headers() },
    );
    expect(blocked.status()).toBe(403);
    expect(await codeFromError(blocked)).toBe('ASSESSMENT_ATTEMPT_LIMIT_REACHED');

    // Sanity: student B never counted toward student A's history.
    expect(student2AccountId).not.toBe(studentAccountId);
  });
});
