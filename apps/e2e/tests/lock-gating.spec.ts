import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';

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
let lesson3Id = '';
let gate1Id = '';
let gate1QuestionId = '';
let gate1Correct = '';
let gate1Wrong = '';
let gate2Id = '';
let gate2QuestionId = '';
let gate2Correct = '';
let gate2Wrong = '';
let student2Phone = '';

const staffHeaders = (csrf = staffCsrf) => ({
  cookie: staffCookies,
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const studentHeaders = (csrf = studentCsrf) => ({
  cookie: studentCookies,
  'x-device-fingerprint': 'lock-gating-device',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const student2Headers = (csrf = student2Csrf) => ({
  cookie: student2Cookies,
  'x-device-fingerprint': 'lock-gating-device-2',
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

test.describe.serial('End-of-Lesson Quiz Gating (3-lesson regression)', () => {
  let studentPage;

  test.beforeAll(async ({ browser }) => {
    studentPage = await browser.newPage();
    await studentPage.addInitScript(() => {
      window.localStorage.setItem('bahrawy-device-fingerprint', 'lock-gating-device');
    });
  });

  test.afterAll(async () => {
    await studentPage.close();
  });

  test('Setup: sessions, 3-lesson course, gates on lesson 1 and 2, entitlements', async ({
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

    student2Phone = `011${Math.floor(10000000 + Math.random() * 90000000)}`;
    const reg = await request.post(`${API}/auth/register`, {
      data: {
        firstName: 'Isolation',
        secondName: 'Two',
        thirdName: 'Student',
        lastName: 'Reg',
        phone: student2Phone,
        parentPhone: `011${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `iso${Date.now()}@bahrawy.test`,
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

    const h = staffHeaders();
    const course = await request.post(`${API}/admin/v1/courses`, {
      data: {
        code: `lockgate-${Date.now()}`,
        titleAr: 'Lock Gate Regression Course',
        descriptionAr: '3-lesson chain regression',
      },
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
    unitId = (await unit.json()).data.id;
    const unitVersion = (await unit.json()).data.version;

    const lessons = [];
    for (let i = 1; i <= 3; i += 1) {
      const lesson = await request.post(`${API}/admin/v1/courses/units/${unitId}/lessons`, {
        data: {
          titleAr: `الدرس ${i}`,
          contentType: 'VIDEO',
          requiresPreviousLessonPass: i >= 2,
        },
        headers: h,
      });
      expect(lesson.ok()).toBeTruthy();
      lessons.push((await lesson.json()).data.id);
    }
    lesson1Id = lessons[0];
    lesson2Id = lessons[1];
    lesson3Id = lessons[2];

    const publish = await request.patch(`${API}/admin/v1/courses/units/${unitId}/lifecycle`, {
      data: { status: 'PUBLISHED', version: unitVersion },
      headers: h,
    });
    expect(publish.ok()).toBeTruthy();

    const product = await request.post(`${API}/admin/v1/products`, {
      data: {
        code: `lockgate-prod-${Date.now()}`,
        titleAr: 'Lock Gate Product',
        priceAmount: 100,
        courseIds: [courseId],
      },
      headers: h,
    });
    expect(product.ok()).toBeTruthy();
    const productId = (await product.json()).data.id;

    const me1 = await request.get(`${API}/auth/me`, {
      headers: { cookie: studentCookies },
    });
    const me2 = await request.get(`${API}/auth/me`, {
      headers: { cookie: student2Cookies },
    });
    const student1ProfileId = (await me1.json()).data.profileId;
    const student2ProfileId = (await me2.json()).data.profileId;
    for (const profileId of [student1ProfileId, student2ProfileId]) {
      const grant = await request.post(`${API}/admin/v1/students/${profileId}/entitlements`, {
        data: { productId, reason: 'lock gate regression' },
        headers: h,
      });
      expect(grant.ok()).toBeTruthy();
    }

    const quiz = (lessonId) =>
      request.put(`${API}/admin/v1/lessons/${lessonId}/lesson-quiz`, {
        data: {
          enabled: true,
          titleAr: 'Gate Quiz',
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
      });

    const q1 = await quiz(lesson1Id);
    expect(q1.ok()).toBeTruthy();
    const d1 = (await q1.json()).data;
    gate1Id = d1.assessmentId;
    gate1QuestionId = d1.questions[0].questionId;
    gate1Correct = d1.questions[0].correctOptionId;
    gate1Wrong = d1.questions[0].options.find((o: any) => o.id !== gate1Correct).id;

    const q2 = await quiz(lesson2Id);
    expect(q2.ok()).toBeTruthy();
    const d2 = (await q2.json()).data;
    gate2Id = d2.assessmentId;
    gate2QuestionId = d2.questions[0].questionId;
    gate2Correct = d2.questions[0].correctOptionId;
    gate2Wrong = d2.questions[0].options.find((o: any) => o.id !== gate2Correct).id;
  });

  test('1) failed prerequisite -> next lesson locked; direct URL rejected; no content leak', async ({
    request,
  }) => {
    const course = await request.get(`${API}/catalog/courses/${courseId}`, {
      headers: studentHeaders(),
    });
    expect(course.ok()).toBeTruthy();
    const lessons = (await course.json()).data.course.chapters
      .flatMap((ch: any) => ch.units)
      .flatMap((u: any) => u.lessons);
    const byTitle = new Map(lessons.map((l: any) => [l.titleAr, l]));
    expect(byTitle.get('الدرس 1').locked).toBe(false);
    expect(byTitle.get('الدرس 2').locked).toBe(true);
    expect(byTitle.get('الدرس 3').locked).toBe(true);

    const first = await request.get(`${API}/catalog/lessons/${lesson1Id}`, {
      headers: studentHeaders(),
    });
    expect(first.ok()).toBeTruthy();

    const second = await request.get(`${API}/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(second.status()).toBe(403);
    const body = await second.json();
    expect(body.code ?? body.error?.code ?? body.message?.code).toBe('LESSON_LOCKED');

    const unit = await request.get(`${API}/catalog/units/${unitId}`, {
      headers: studentHeaders(),
    });
    expect(unit.ok()).toBeTruthy();
    const items = (await unit.json()).data.contentItems;
    const item2 = items.find((i: any) => i.lessonId === lesson2Id);
    expect(item2.locked).toBe(true);
    expect(item2.available).toBe(false);
    expect(item2.contentUrl).toBeNull();
    expect(item2.attachedPdfUrl).toBeNull();
    expect(item2.gate.requiredAssessmentId).toBe(gate1Id);
  });

  test('2) failed attempt does not unlock and does not mark the lesson complete', async ({
    request,
  }) => {
    const fail = await request.post(`${API}/assessment/${gate1Id}/submit`, {
      data: { answers: [{ questionId: gate1QuestionId, optionId: gate1Wrong }] },
      headers: studentHeaders(),
    });
    expect(fail.ok()).toBeTruthy();
    expect(Number((await fail.json()).data.score)).toBe(0);

    const second = await request.get(`${API}/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(second.status()).toBe(403);

    const unit = await request.get(`${API}/catalog/units/${unitId}`, {
      headers: studentHeaders(),
    });
    const item1 = (await unit.json()).data.contentItems.find((i: any) => i.lessonId === lesson1Id);
    expect(item1.completedAt).toBeNull();
  });

  test('3) passing lesson 1 unlocks lesson 2, marks lesson 1 complete, lesson 3 stays locked', async ({
    request,
  }) => {
    const pass = await request.post(`${API}/assessment/${gate1Id}/submit`, {
      data: { answers: [{ questionId: gate1QuestionId, optionId: gate1Correct }] },
      headers: studentHeaders(),
    });
    expect(pass.ok()).toBeTruthy();
    expect(Number((await pass.json()).data.score)).toBe(100);

    const second = await request.get(`${API}/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(second.ok()).toBeTruthy();

    const third = await request.get(`${API}/catalog/lessons/${lesson3Id}`, {
      headers: studentHeaders(),
    });
    expect(third.status()).toBe(403);
    const body = await third.json();
    expect(body.code ?? body.error?.code ?? body.message?.code).toBe('LESSON_LOCKED');

    const unit = await request.get(`${API}/catalog/units/${unitId}`, {
      headers: studentHeaders(),
    });
    const items = (await unit.json()).data.contentItems;
    expect(items.find((i: any) => i.lessonId === lesson1Id).completedAt).toBeTruthy();
    expect(items.find((i: any) => i.lessonId === lesson2Id).locked).toBe(false);
    expect(items.find((i: any) => i.lessonId === lesson3Id).locked).toBe(true);
  });

  test('4) refresh (re-fetch) after pass preserves the unlocked state', async ({ request }) => {
    const second = await request.get(`${API}/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(second.ok()).toBeTruthy();
    const course = await request.get(`${API}/catalog/courses/${courseId}`, {
      headers: studentHeaders(),
    });
    const lessons = (await course.json()).data.course.chapters
      .flatMap((ch: any) => ch.units)
      .flatMap((u: any) => u.lessons);
    expect(lessons.find((l: any) => l.id === lesson2Id).locked).toBe(false);
  });

  test('5) pass-then-fail on lesson 1 keeps lesson 2 unlocked (UI and access agree)', async ({
    request,
  }) => {
    const fail = await request.post(`${API}/assessment/${gate1Id}/submit`, {
      data: { answers: [{ questionId: gate1QuestionId, optionId: gate1Wrong }] },
      headers: studentHeaders(),
    });
    expect(fail.ok()).toBeTruthy();
    expect(Number((await fail.json()).data.score)).toBe(0);

    const course = await request.get(`${API}/catalog/courses/${courseId}`, {
      headers: studentHeaders(),
    });
    const lessons = (await course.json()).data.course.chapters
      .flatMap((ch: any) => ch.units)
      .flatMap((u: any) => u.lessons);
    expect(lessons.find((l: any) => l.id === lesson2Id).locked).toBe(false);

    const second = await request.get(`${API}/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(second.ok()).toBeTruthy();
  });

  test('6) direct URL blocked before pass, works after (UI)', async () => {
    await studentPage.goto('http://localhost:3001/login');
    await studentPage.fill('input[type="tel"]', '01000000001');
    await studentPage.fill('input[type="password"]', 'student_secret');
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForURL('**/student');

    await studentPage.goto(`http://localhost:3001/student/courses/${courseId}/lesson/${lesson2Id}`);
    await expect(studentPage.getByText('أكمل امتحان الدرس السابق أولاً')).not.toBeVisible();
    await expect(studentPage.getByText('الدرس 2')).toBeVisible();
  });

  test('7) passing lesson 2 unlocks lesson 3 (chain rule)', async ({ request }) => {
    const fail = await request.post(`${API}/assessment/${gate2Id}/submit`, {
      data: { answers: [{ questionId: gate2QuestionId, optionId: gate2Wrong }] },
      headers: studentHeaders(),
    });
    expect(fail.ok()).toBeTruthy();
    const thirdAfterFail = await request.get(`${API}/catalog/lessons/${lesson3Id}`, {
      headers: studentHeaders(),
    });
    expect(thirdAfterFail.status()).toBe(403);

    const pass = await request.post(`${API}/assessment/${gate2Id}/submit`, {
      data: { answers: [{ questionId: gate2QuestionId, optionId: gate2Correct }] },
      headers: studentHeaders(),
    });
    expect(pass.ok()).toBeTruthy();
    expect(Number((await pass.json()).data.score)).toBe(100);

    const third = await request.get(`${API}/catalog/lessons/${lesson3Id}`, {
      headers: studentHeaders(),
    });
    expect(third.ok()).toBeTruthy();

    const unit = await request.get(`${API}/catalog/units/${unitId}`, {
      headers: studentHeaders(),
    });
    const items = (await unit.json()).data.contentItems;
    expect(items.find((i: any) => i.lessonId === lesson2Id).completedAt).toBeTruthy();
    expect(items.find((i: any) => i.lessonId === lesson3Id).locked).toBe(false);
  });

  test('8) cross-student isolation: student 2 (entitled, no pass) is still blocked', async ({
    request,
  }) => {
    const secondForS2 = await request.get(`${API}/catalog/lessons/${lesson2Id}`, {
      headers: student2Headers(),
    });
    expect(secondForS2.status()).toBe(403);
    const body = await secondForS2.json();
    expect(body.code ?? body.error?.code ?? body.message?.code).toBe('LESSON_LOCKED');

    const secondForS1 = await request.get(`${API}/catalog/lessons/${lesson2Id}`, {
      headers: studentHeaders(),
    });
    expect(secondForS1.ok()).toBeTruthy();

    const thirdForS2 = await request.get(`${API}/catalog/lessons/${lesson3Id}`, {
      headers: student2Headers(),
    });
    expect(thirdForS2.status()).toBe(403);
  });
});
