import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';
const STAFF_UI = 'http://localhost:3002';

let staffCookies = '';
let staffCsrf = '';
let studentCookies = '';
let studentCsrf = '';
let student2Cookies = '';
let student2Csrf = '';

let courseId = '';
let unitId = '';
let lesson1Id = '';
let lesson2Id = '';
let quiz: {
  assessmentId: string;
  questionId: string;
  correct: string;
  wrong: string;
} | null = null;
let student1Phone = '';
let student2Phone = '';
let student1Name = '';
let accountId1 = '';

const staffHeaders = (csrf = staffCsrf) => ({
  cookie: staffCookies,
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const studentHeaders = (csrf = studentCsrf) => ({
  cookie: studentCookies,
  'x-device-fingerprint': 'fail-unlock-device',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const student2Headers = (csrf = student2Csrf) => ({
  cookie: student2Cookies,
  'x-device-fingerprint': 'fail-unlock-device-2',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});

const login = async (request, path: string, body: Record<string, string>) => {
  const res = await request.post(`${API}${path}`, { data: body });
  expect(res.ok()).toBeTruthy();
  const cookies = res.headers()['set-cookie'];
  const csrfRes = await request.get(`${API}/auth/csrf-token`, {
    headers: { cookie: cookies },
  });
  expect(csrfRes.ok()).toBeTruthy();
  return { cookies, csrf: (await csrfRes.json()).csrfToken };
};

const GRADE = '6ba0f5e8-120e-4492-a135-0696839bb80a';

test.describe.serial('Exam FAILED rows + admin unlock (exams violations section)', () => {
  test('Setup: staff, two fresh students, course w/ gate quiz on lesson1 + gated lesson2', async ({
    request,
  }) => {
    const staff = await login(request, '/auth/staff-login', {
      email: 'admin@bahrawy.test',
      password: 'owner_secret',
    });
    staffCookies = staff.cookies;
    staffCsrf = staff.csrf;

    const registerStudent = async (phonePrefix: string, tag: string) => {
      const phone = `${phonePrefix}${Math.floor(10000000 + Math.random() * 90000000)}`;
      const reg = await request.post(`${API}/auth/register`, {
        data: {
          firstName: 'FailUnlock',
          secondName: 'Isolation',
          thirdName: tag,
          lastName: 'Student',
          phone,
          parentPhone: `${phonePrefix}${Math.floor(10000000 + Math.random() * 90000000)}`,
          email: `failunlock${Date.now()}-${tag}@bahrawy.test`,
          schoolName: 'Test School',
          gender: 'MALE',
          city: 'Cairo',
          gradeId: GRADE,
          password: 'student_secret',
        },
      });
      expect(reg.ok()).toBeTruthy();
      return phone;
    };

    student1Phone = await registerStudent('010', 'one');
    student2Phone = await registerStudent('012', 'two');

    const s1 = await login(request, '/auth/login', {
      phone: student1Phone,
      password: 'student_secret',
    });
    studentCookies = s1.cookies;
    studentCsrf = s1.csrf;
    const s2 = await login(request, '/auth/login', {
      phone: student2Phone,
      password: 'student_secret',
    });
    student2Cookies = s2.cookies;
    student2Csrf = s2.csrf;

    const me1 = await request.get(`${API}/auth/me`, {
      headers: { cookie: studentCookies },
    });
    accountId1 = (await me1.json()).data.accountId;
    student1Name = (await me1.json()).data.name;

    const h = staffHeaders();
    const course = await request.post(`${API}/admin/v1/courses`, {
      data: { code: `failunlock-${Date.now()}`, titleAr: 'Fail Unlock Course' },
      headers: h,
    });
    expect(course.ok()).toBeTruthy();
    courseId = (await course.json()).data.id;

    const chapter = await request.post(`${API}/admin/v1/courses/${courseId}/chapters`, {
      data: { titleAr: 'Chapter' },
      headers: h,
    });
    const chapterId = (await chapter.json()).data.id;

    const unit = await request.post(`${API}/admin/v1/courses/chapters/${chapterId}/units`, {
      data: { titleAr: 'Unit' },
      headers: h,
    });
    unitId = (await unit.json()).data.id;
    const unitVersion = (await unit.json()).data.version;

    const lesson1 = await request.post(`${API}/admin/v1/courses/units/${unitId}/lessons`, {
      data: { titleAr: 'الدرس الأوّل (يمنح الوصول)', contentType: 'VIDEO', requiresPreviousLessonPass: false },
      headers: h,
    });
    lesson1Id = (await lesson1.json()).data.id;

    // Gated by lesson1: only reachable after the student PASSES lesson1's quiz.
    const lesson2 = await request.post(`${API}/admin/v1/courses/units/${unitId}/lessons`, {
      data: { titleAr: 'الدرس الثاني (مقفل)', contentType: 'VIDEO', requiresPreviousLessonPass: true },
      headers: h,
    });
    lesson2Id = (await lesson2.json()).data.id;

    const publish = await request.patch(`${API}/admin/v1/courses/units/${unitId}/lifecycle`, {
      data: { status: 'PUBLISHED', version: unitVersion },
      headers: h,
    });
    expect(publish.ok()).toBeTruthy();

    const product = await request.post(`${API}/admin/v1/products`, {
      data: {
        code: `failunlock-prod-${Date.now()}`,
        titleAr: 'Fail Unlock Product',
        priceAmount: 100,
        courseIds: [courseId],
      },
      headers: h,
    });
    const productId = (await product.json()).data.id;

    const me2 = await request.get(`${API}/auth/me`, {
      headers: { cookie: student2Cookies },
    });
    for (const profileId of [(await me1.json()).data.profileId, (await me2.json()).data.profileId]) {
      const grant = await request.post(`${API}/admin/v1/students/${profileId}/entitlements`, {
        data: { productId, reason: 'failed-attempts regression' },
        headers: h,
      });
      expect(grant.ok()).toBeTruthy();
    }

    const quizRes = await request.put(`${API}/admin/v1/lessons/${lesson1Id}/lesson-quiz`, {
      data: {
        enabled: true,
        titleAr: 'اختبار نهاية الدرس الأوّل',
        passingScore: 1,
        questions: [
          {
            titleAr: 'اختر القاهرة؟',
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
    });
    expect(quizRes.ok()).toBeTruthy();
    const d = (await quizRes.json()).data;
    const correct = d.questions[0].correctOptionId;
    quiz = {
      assessmentId: d.assessmentId,
      questionId: d.questions[0].questionId,
      correct,
      wrong: d.questions[0].options.find((o: any) => o.id !== correct).id,
    };
    expect(quiz.assessmentId).toBeTruthy();

    // Limit attempts to 1 so a FAIL leaves the student locked until admin unlock.
    const quizDetail = await request.get(`${API}/admin/v1/assessments/${quiz.assessmentId}`, {
      headers: h,
    });
    expect(quizDetail.ok()).toBeTruthy();
    const quizData = (await quizDetail.json()).data;
    const patch = await request.patch(`${API}/admin/v1/assessments/${quiz.assessmentId}`, {
      data: {
        titleAr: quizData.titleAr,
        maxAttempts: 1,
        version: quizData.version,
      },
      headers: h,
    });
    expect(patch.ok()).toBeTruthy();
  });

  test('TR-1: failing the quiz (score < passingScore) surfaces a FAILED row with no suspension', async ({
    request,
  }) => {
    const submit = await request.post(`${API}/assessment/${quiz!.assessmentId}/submit`, {
      data: { answers: [{ questionId: quiz!.questionId, optionId: quiz!.wrong }] },
      headers: studentHeaders(),
    });
    expect(submit.ok()).toBeTruthy();
    const payload = (await submit.json()).data;
    expect(payload.attempt.passed).toBe(false);
    expect(Number(payload.score)).toBe(0);

    const res = await request.get(
      `${API}/admin/v1/exam-violations?caseType=ALL&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).data.items;
    const row = items.find(
      (it: any) => it.accountId === accountId1 && it.assessmentId === quiz!.assessmentId,
    );
    expect(row).toBeTruthy();
    expect(row.caseType).toBe('FAILED'); // not SUSPENDED, no EXAM session dependency
    expect(row.score).toBe(0);
    expect(row.passingScore).toBe(1);
    expect(row.reason).toContain('فشل في الاختبار');
    expect(row.reason).toContain('0/1');
    expect(row.student.name).toBe(student1Name);
    expect(row.lesson.titleAr).toBe('الدرس الأوّل (يمنح الوصول)');
    expect(row.sessionId).toBeNull();
  });

  test('TR-2: a genuine suspension is a SUSPENDED row, independent of the FAILED row', async ({
    request,
  }) => {
    const other = await request.get(
      `${API}/admin/v1/exam-violations?caseType=ALL&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    const failedOnly = (await other.json()).data.items.filter(
      (it: any) => it.accountId === accountId1 && it.assessmentId === quiz!.assessmentId,
    );
    expect(failedOnly.length).toBe(1);
    expect(failedOnly[0].caseType).toBe('FAILED');

    // Second student runs a REAL suspension on the same assessment.
    const start = await request.post(`${API}/assessments/${quiz!.assessmentId}/start`, {
      data: { newAttempt: true },
      headers: student2Headers(),
    });
    expect(start.ok()).toBeTruthy();
    const attempt2 = (await start.json()).data;

    const violation = await request.post(
      `${API}/assessments/attempt/${attempt2.id}/exam-session/violations`,
      { data: { reason: 'FULLSCREEN_EXIT' }, headers: student2Headers() },
    );
    expect((await violation.json()).data.status).toBe('LOCKED');

    const res = await request.get(
      `${API}/admin/v1/exam-violations?caseType=ALL&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    const items = (await res.json()).data.items;
    const susp = items.find((it: any) => it.sessionId === attempt2.examSessionId);
    expect(susp).toBeTruthy();
    expect(susp.caseType).toBe('SUSPENDED');
    expect(susp.status).toBe('LOCKED');
    expect(susp.lockReason).toBe('FULLSCREEN_EXIT');
  });

  test('TR-3: FAILED row does not depend on a suspension or ExamSession existence (sessionId null)', async ({
    request,
  }) => {
    const res = await request.get(
      `${API}/admin/v1/exam-violations?caseType=FAILED&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    const items = (await res.json()).data.items;
    const row = items.find(
      (it: any) => it.accountId === accountId1 && it.assessmentId === quiz!.assessmentId,
    );
    expect(row).toBeTruthy();
    expect(row.caseType).toBe('FAILED');
    expect(row.sessionId).toBeNull();
    expect(row.status).toBe('SUBMITTED');
  });

  test('TR-8: grade filter narrows the FAILED list', async ({ request }) => {
    const res = await request.get(
      `${API}/admin/v1/exam-violations?caseType=FAILED&gradeId=${GRADE}&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    const items = (await res.json()).data.items;
    const row = items.find(
      (it: any) => it.accountId === accountId1 && it.assessmentId === quiz!.assessmentId,
    );
    expect(row).toBeTruthy();
  });

  test('TR-11: while FAILED, the student cannot start a new attempt (maxAttempts=1, no grant yet)', async ({
    request,
  }) => {
    const blocked = await request.post(`${API}/assessments/${quiz!.assessmentId}/start`, {
      data: { newAttempt: true },
      headers: studentHeaders(),
    });
    expect(blocked.status()).toBe(403);
    const code =
      (await blocked.json()).code ?? (await blocked.json()).error?.code;
    expect(code).toBe('ASSESSMENT_ATTEMPT_LIMIT_REACHED');
  });

  test('TR-13 REGRESSION: after unlock the student exam page loads (start newAttempt:false then GET /assessments/attempt/:id) — the result view with the grant must render, not EXAM_SESSION_ENDED', async ({
    request,
  }) => {
    const unlock = await request.post(
      `${API}/admin/v1/exam-violations/assessments/${quiz!.assessmentId}/students/${accountId1}/unlock`,
      { data: {}, headers: staffHeaders() },
    );
    expect([200, 201]).toContain(unlock.status());
    const unlockBody = (await unlock.json()).data;
    expect(unlockBody.grantId).toBeTruthy();
    expect(unlockBody.accountId).toBe(accountId1);
    expect(unlockBody.assessmentId).toBe(quiz!.assessmentId);
    expect(unlockBody.remainingGrantedAttempts).toBeGreaterThanOrEqual(1);
    expect(unlockBody.unlocked).toBe(true);

    // Exact student page sequence (apps/academy-web/app/student/assessments/[id]/page.tsx).
    // Step 1: POST /assessments/:id/start {newAttempt:false} returns the OLD submitted attempt.
    const start = await request.post(`${API}/assessments/${quiz!.assessmentId}/start`, {
      data: { newAttempt: false },
      headers: studentHeaders(),
    });
    expect(start.ok()).toBeTruthy();
    const oldAttemptId = (await start.json()).data.id;
    expect(oldAttemptId).toBeTruthy();

    // Step 2: GET /assessments/attempt/:id — MUST be 200 with the result payload.
    // Regression: this previously returned 409 EXAM_SESSION_ENDED for a submitted
    // attempt, so the page never rendered the result view nor the retry button
    // even after an admin unlock. See exam-session enforceForAttempt vs
    // getCurrentAttempt (assessment.service.ts).
    const detail = await request.get(
      `${API}/assessments/attempt/${oldAttemptId}`,
      { headers: studentHeaders() },
    );
    expect(detail.ok()).toBeTruthy();
    const attempt = (await detail.json()).data;
    expect(attempt.id).toBe(oldAttemptId);
    expect(attempt.submittedAt).toBeTruthy();
    expect(attempt.passed).toBe(false);
    // The unused grant must surface so the UI shows "بدء محاولة جديدة".
    expect(attempt.grantedAttempts).toBeGreaterThanOrEqual(1);
    expect(attempt.attemptsRemaining).toBeGreaterThanOrEqual(1);

    // Step 3: GET /assessments/:id/exam-session still works.
    const sess = await request.get(
      `${API}/assessments/${quiz!.assessmentId}/exam-session`,
      { headers: studentHeaders() },
    );
    expect(sess.ok()).toBeTruthy();
  });

  test('TR-4/TR-9: admin unlock grants a real new attempt; the direct URL works after', async ({
    request,
  }) => {
    const unlock = await request.post(
      `${API}/admin/v1/exam-violations/assessments/${quiz!.assessmentId}/students/${accountId1}/unlock`,
      { data: {}, headers: staffHeaders() },
    );
    expect([200, 201]).toContain(unlock.status());
    expect((await unlock.json()).data.unlocked).toBe(true);

    // Direct URL / start must now succeed server-side.
    const start = await request.post(`${API}/assessments/${quiz!.assessmentId}/start`, {
      data: { newAttempt: true },
      headers: studentHeaders(),
    });
    expect(start.ok()).toBeTruthy();
    const attempt = (await start.json()).data;
    expect(attempt.unlockedByAdmin).toBe(true);
    expect(attempt.id).toBeTruthy();
    expect(attempt.examSessionId).toBeTruthy();
  });

  test('TR-12: admin response exposes no sensitive auth fields', async ({ request }) => {
    const res = await request.get(
      `${API}/admin/v1/exam-violations?caseType=ALL&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    const body = JSON.stringify((await res.json()).data.items);
    expect(body).not.toMatch(/passwordHash|tokenHash|phoneEncrypted|emailEncrypted/);
  });

  test('TR-6/TR-10: unauthorized student cannot get an unlock grant', async ({ request }) => {
    const res = await request.post(
      `${API}/admin/v1/exam-violations/assessments/${quiz!.assessmentId}/students/does-not-exist/unlock`,
      { data: {}, headers: staffHeaders() },
    );
    expect(res.status()).toBe(404);
  });

  test('TR-5: after passing on the granted attempt, the student disappears from the FAILED list', async ({
    request,
  }) => {
    const submit = await request.post(`${API}/assessment/${quiz!.assessmentId}/submit`, {
      data: { answers: [{ questionId: quiz!.questionId, optionId: quiz!.correct }] },
      headers: studentHeaders(),
    });
    expect(submit.ok()).toBeTruthy();
    const payload = (await submit.json()).data;
    expect(payload.attempt.passed).toBe(true);

    // Previous FAILED attempt must remain in the student's history.
    const history = await request.get(`${API}/assessment/${quiz!.assessmentId}/results`, {
      headers: studentHeaders(),
    });
    const attempts = (await history.json()).data;
    expect(attempts.length).toBeGreaterThanOrEqual(2);
    expect(attempts.some((a: any) => a.passed === false)).toBe(true);

    // DISAPPEARS from the active FAILED list once the latest attempt PASSED.
    const res = await request.get(
      `${API}/admin/v1/exam-violations?caseType=FAILED&page=1&pageSize=100`,
      { headers: staffHeaders() },
    );
    const items = (await res.json()).data.items;
    const row = items.find(
      (it: any) => it.accountId === accountId1 && it.assessmentId === quiz!.assessmentId,
    );
    expect(row).toBeUndefined();
  });

  test('TR-14: lesson2 (next lesson) unlocks after the pass', async ({ request }) => {
    const det = await request.get(`${API}/admin/v1/courses/lessons/${lesson2Id}`, {
      headers: staffHeaders(),
    });
    expect((await det.json()).data.requiresPreviousLessonPass).toBe(true);

    const cat = await request.get(`${API}/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(cat.ok()).toBeTruthy();
    const code = (await cat.json()).code ?? (await cat.json()).error?.code ?? null;
    expect(['LESSON_LOCKED', 'LESSON_PREREQUISITE_NOT_MET', 'FORBIDDEN']).not.toContain(code);
  });

  test('UI: staff section shows the reason/Lesson columns and the unlock action', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto(`${STAFF_UI}/login`);
      await page.fill('input[type="email"]', 'admin@bahrawy.test');
      await page.fill('input[type="password"]', 'owner_secret');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');

      await page.goto(`${STAFF_UI}/dashboard/exam-violations`);
      await expect(page.getByText('الطلاب الموقوفون في الامتحانات')).toBeVisible();
      await page.getByLabel('تصفية بالحالة').selectOption('FAILED');
      const row = page.locator('table tbody tr').filter({ hasText: student1Name });
      await expect(row.first()).toBeVisible();
      await expect(row.first().getByText('فشل في الاختبار')).toBeVisible();
    } finally {
      await page.close();
    }
  });
});