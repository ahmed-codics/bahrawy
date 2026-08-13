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
let lessonIds: string[] = [];
let quizRefs: Record<
  string,
  { assessmentId: string; questionId: string; correct: string; wrong: string }
> = {};
let student1Phone = '';
let student2Phone = '';

const staffHeaders = (csrf = staffCsrf) => ({
  cookie: staffCookies,
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const studentHeaders = (csrf = studentCsrf) => ({
  cookie: studentCookies,
  'x-device-fingerprint': 'prereq-gate-device',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const student2Headers = (csrf = student2Csrf) => ({
  cookie: student2Cookies,
  'x-device-fingerprint': 'prereq-gate-device-2',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});

const login = async (
  request,
  path: string,
  body: Record<string, string>,
  device?: string,
) => {
  const res = await request.post(`${API}${path}`, {
    data: body,
    ...(device ? { headers: { 'x-device-fingerprint': device } } : {}),
  });
  expect(res.ok()).toBeTruthy();
  const cookies = res.headers()['set-cookie'];
  const csrfRes = await request.get(`${API}/auth/csrf-token`, {
    headers: { cookie: cookies },
  });
  expect(csrfRes.ok()).toBeTruthy();
  return { cookies, csrf: (await csrfRes.json()).csrfToken };
};

const lessonLock = async (request, lessonId: string, headers: any) => {
  const res = await request.get(`${API}/catalog/lessons/${lessonId}`, {
    headers,
  });
  return res;
};

const lockedCode = async (res: any) => {
  const body = await res.json();
  return body.code ?? body.error?.code ?? body.message?.code;
};

async function setFlag(request, lessonId: string, value: boolean) {
  const detail = await request.get(`${API}/admin/v1/courses/lessons/${lessonId}`, {
    headers: staffHeaders(),
  });
  expect(detail.ok()).toBeTruthy();
  const lesson = (await detail.json()).data;
  const patch = await request.patch(`${API}/admin/v1/courses/lesson/${lessonId}/content`, {
    data: { requiresPreviousLessonPass: value, version: lesson.version },
    headers: staffHeaders(),
  });
  expect(patch.ok()).toBeTruthy();
  return patch;
}

test.describe.serial('Per-lesson requiresPreviousLessonPass gating', () => {
  let studentPage;
  let staffPage;

  test.beforeAll(async ({ browser }) => {
    studentPage = await browser.newPage();
    await studentPage.addInitScript(() => {
      window.localStorage.setItem('bahrawy-device-fingerprint', 'prereq-gate-device');
    });
    staffPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await studentPage.close();
    await staffPage.close();
  });

  test('Setup: 4-lesson course, flags L1 ON / L2 ON / L3 OFF / L4 ON, quizzes on L1..L3, entitlements', async ({
    request,
  }) => {
    const staff = await login(request, '/auth/staff-login', {
      email: 'admin@bahrawy.test',
      password: 'owner_secret',
    });
    staffCookies = staff.cookies;
    staffCsrf = staff.csrf;

    const registerStudent = async (phonePrefix: string, emailTag: string) => {
      const phone = `${phonePrefix}${Math.floor(10000000 + Math.random() * 90000000)}`;
      const reg = await request.post(`${API}/auth/register`, {
        data: {
          firstName: 'Prereq',
          secondName: 'Isolation',
          thirdName: 'Student',
          lastName: emailTag,
          phone,
          parentPhone: `${phonePrefix}${Math.floor(10000000 + Math.random() * 90000000)}`,
          email: `prereq${Date.now()}-${emailTag}@bahrawy.test`,
          schoolName: 'Test School',
          gender: 'MALE',
          city: 'Cairo',
          gradeId: '6ba0f5e8-120e-4492-a135-0696839bb80a',
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
    }, 'prereq-gate-device');
    studentCookies = s1.cookies;
    studentCsrf = s1.csrf;

    const s2 = await login(request, '/auth/login', {
      phone: student2Phone,
      password: 'student_secret',
    }, 'prereq-gate-device-2');
    student2Cookies = s2.cookies;
    student2Csrf = s2.csrf;

    const h = staffHeaders();
    const course = await request.post(`${API}/admin/v1/courses`, {
      data: {
        code: `prereq-${Date.now()}`,
        titleAr: 'Prerequisite Gate Course',
        descriptionAr: 'per-lesson requirement flag regression',
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

    // Lesson 1 -> ON (no previous lesson), Lesson 2 -> ON, Lesson 3 -> OFF,
    // Lesson 4 -> ON: every lesson follows its own setting.
    const flags = [true, true, false, true];
    for (let i = 1; i <= 4; i += 1) {
      const lesson = await request.post(`${API}/admin/v1/courses/units/${unitId}/lessons`, {
        data: {
          titleAr: `الدرس ${i}`,
          contentType: 'VIDEO',
          requiresPreviousLessonPass: flags[i - 1],
        },
        headers: h,
      });
      expect(lesson.ok()).toBeTruthy();
      lessonIds.push((await lesson.json()).data.id);
    }

    // Persisted value round-trips through the admin read endpoint.
    for (let i = 0; i < 4; i += 1) {
      const detail = await request.get(`${API}/admin/v1/courses/lessons/${lessonIds[i]}`, {
        headers: h,
      });
      expect(detail.ok()).toBeTruthy();
      expect((await detail.json()).data.requiresPreviousLessonPass).toBe(flags[i]);
    }

    const publish = await request.patch(`${API}/admin/v1/courses/units/${unitId}/lifecycle`, {
      data: { status: 'PUBLISHED', version: unitVersion },
      headers: h,
    });
    expect(publish.ok()).toBeTruthy();

    const product = await request.post(`${API}/admin/v1/products`, {
      data: {
        code: `prereq-prod-${Date.now()}`,
        titleAr: 'Prerequisite Product',
        priceAmount: 100,
        courseIds: [courseId],
      },
      headers: h,
    });
    expect(product.ok()).toBeTruthy();
    const productId = (await product.json()).data.id;

    const me1 = await request.get(`${API}/auth/me`, {
      headers: { cookie: studentCookies, 'x-device-fingerprint': 'prereq-gate-device' },
    });
    const me2 = await request.get(`${API}/auth/me`, {
      headers: { cookie: student2Cookies, 'x-device-fingerprint': 'prereq-gate-device-2' },
    });
    const student1ProfileId = (await me1.json()).data.profileId;
    const student2ProfileId = (await me2.json()).data.profileId;
    for (const profileId of [student1ProfileId, student2ProfileId]) {
      const grant = await request.post(`${API}/admin/v1/students/${profileId}/entitlements`, {
        data: { productId, reason: 'prerequisite gating regression' },
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

    for (let i = 0; i < 3; i += 1) {
      const q = await quiz(lessonIds[i]);
      expect(q.ok()).toBeTruthy();
      const d = (await q.json()).data;
      const correct = d.questions[0].correctOptionId;
      quizRefs[lessonIds[i]] = {
        assessmentId: d.assessmentId,
        questionId: d.questions[0].questionId,
        correct,
        wrong: d.questions[0].options.find((o: any) => o.id !== correct).id,
      };
    }
  });

  test('1) each lesson follows its own flag: flag-false open, flag-true locked; first lesson open despite flag; direct URL blocked', async ({
    request,
  }) => {
    const course = await request.get(`${API}/catalog/courses/${courseId}`, {
      headers: studentHeaders(),
    });
    expect(course.ok()).toBeTruthy();
    const lessons = (await course.json()).data.course.chapters
      .flatMap((ch: any) => ch.units)
      .flatMap((u: any) => u.lessons);
    const status = (i: number) => lessons.find((l: any) => l.id === lessonIds[i - 1]);
    expect(status(1).locked).toBe(false); // flag ON but no previous lesson -> open
    expect(status(2).locked).toBe(true); // flag ON + L1 quiz not passed -> locked
    expect(status(3).locked).toBe(false); // flag OFF -> open despite L2 quiz
    expect(status(4).locked).toBe(true); // flag ON + L3 quiz not passed -> locked

    const l1 = await lessonLock(request, lessonIds[0], studentHeaders());
    expect(l1.ok()).toBeTruthy();
    const l3 = await lessonLock(request, lessonIds[2], studentHeaders());
    expect(l3.ok()).toBeTruthy();

    const l2 = await lessonLock(request, lessonIds[1], studentHeaders());
    expect(l2.status()).toBe(403);
    expect(await lockedCode(l2)).toBe('LESSON_LOCKED');

    const l4 = await lessonLock(request, lessonIds[3], studentHeaders());
    expect(l4.status()).toBe(403);
    expect(await lockedCode(l4)).toBe('LESSON_LOCKED');
  });

  test('2) student UI: locked lessons show the lock + prerequisite message; direct lesson URL is blocked in the UI', async () => {
    await studentPage.goto('http://localhost:3001/login');
    await studentPage.fill('input[type="tel"]', student1Phone);
    await studentPage.fill('input[type="password"]', 'student_secret');
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForURL('**/student');

    await studentPage.goto(`http://localhost:3001/student/courses/${courseId}`);
    await expect(studentPage.getByText(/مغلق حتى اجتياز اختبار الدرس السابق/)).toBeVisible();

    await studentPage.goto(
      `http://localhost:3001/student/courses/${courseId}/lesson/${lessonIds[1]}`,
    );
    await expect(studentPage.getByText('أكمل امتحان الدرس السابق أولاً')).toBeVisible();
  });

  test('3) admin OFF->ON locks an unfinished lesson and admin ON->OFF unlocks it immediately', async ({
    request,
  }) => {
    // OFF -> ON on lesson 3 (currently flag OFF): it must lock right away
    // because lesson 2's quiz has not been passed.
    await setFlag(request, lessonIds[2], true);
    const detail = await request.get(`${API}/admin/v1/courses/lessons/${lessonIds[2]}`, {
      headers: staffHeaders(),
    });
    expect((await detail.json()).data.requiresPreviousLessonPass).toBe(true);
    const l3locked = await lessonLock(request, lessonIds[2], studentHeaders());
    expect(l3locked.status()).toBe(403);
    expect(await lockedCode(l3locked)).toBe('LESSON_LOCKED');

    // ON -> OFF on lesson 2 (currently flag ON): it must open immediately,
    // even though lesson 1's quiz was never attempted.
    await setFlag(request, lessonIds[1], false);
    const l2open = await lessonLock(request, lessonIds[1], studentHeaders());
    expect(l2open.ok()).toBeTruthy();
  });

  test('4) failed attempt keeps the lock; passing the previous quiz unlocks the gated lesson', async ({
    request,
  }) => {
    const gate2 = quizRefs[lessonIds[1]];
    const fail = await request.post(`${API}/assessment/${gate2.assessmentId}/submit`, {
      data: {
        answers: [{ questionId: gate2.questionId, optionId: gate2.wrong }],
      },
      headers: studentHeaders(),
    });
    expect(fail.ok()).toBeTruthy();
    expect(Number((await fail.json()).data.score)).toBe(0);

    const third = await lessonLock(request, lessonIds[2], studentHeaders());
    expect(third.status()).toBe(403);
    expect(await lockedCode(third)).toBe('LESSON_LOCKED');

    const pass = await request.post(`${API}/assessment/${gate2.assessmentId}/submit`, {
      data: {
        answers: [{ questionId: gate2.questionId, optionId: gate2.correct }],
      },
      headers: studentHeaders(),
    });
    expect(pass.ok()).toBeTruthy();
    const passBody = await pass.json();
    expect(Number(passBody.data.score)).toBe(100);

    const thirdOpen = await lessonLock(request, lessonIds[2], studentHeaders());
    expect(thirdOpen.ok()).toBeTruthy();
  });

  test('5) lesson 4 stays locked until lesson 3 quiz is passed', async ({ request }) => {
    const gate3 = quizRefs[lessonIds[2]];
    const before = await lessonLock(request, lessonIds[3], studentHeaders());
    expect(before.status()).toBe(403);
    expect(await lockedCode(before)).toBe('LESSON_LOCKED');

    const pass = await request.post(`${API}/assessment/${gate3.assessmentId}/submit`, {
      data: {
        answers: [{ questionId: gate3.questionId, optionId: gate3.correct }],
      },
      headers: studentHeaders(),
    });
    expect(pass.ok()).toBeTruthy();

    const after = await lessonLock(request, lessonIds[3], studentHeaders());
    expect(after.ok()).toBeTruthy();
  });

  test('6) cross-student isolation: student 2 (entitled, no passes) stays blocked while student 1 is unlocked', async ({
    request,
  }) => {
    const s2Third = await lessonLock(request, lessonIds[2], student2Headers());
    expect(s2Third.status()).toBe(403);
    expect(await lockedCode(s2Third)).toBe('LESSON_LOCKED');
    const s2Fourth = await lessonLock(request, lessonIds[3], student2Headers());
    expect(s2Fourth.status()).toBe(403);
    expect(await lockedCode(s2Fourth)).toBe('LESSON_LOCKED');

    const s1Third = await lessonLock(request, lessonIds[2], studentHeaders());
    expect(s1Third.ok()).toBeTruthy();
    const s1Fourth = await lessonLock(request, lessonIds[3], studentHeaders());
    expect(s1Fourth.ok()).toBeTruthy();
  });

  test('7) admin UI: lesson editor shows the toggle, persists it across save + reload', async () => {
    await staffPage.goto('http://localhost:3002/login');
    await staffPage.fill('input[type="email"]', 'admin@bahrawy.test');
    await staffPage.fill('input[type="password"]', 'owner_secret');
    await staffPage.click('button[type="submit"]');
    await staffPage.waitForURL('**/dashboard');

    // Create drawer exposes the toggle.
    await staffPage.goto(`http://localhost:3002/dashboard/courses/${courseId}/units/${unitId}`);
    await staffPage.getByRole('button', { name: 'درس جديد' }).click();
    await expect(staffPage.getByText('قفل الدرس حتى اجتياز اختبار الدرس السابق')).toBeVisible();

    // Lesson 1 was created with the flag ON and has no previous lesson.
    const editorUrl = `http://localhost:3002/dashboard/courses/${courseId}/units/${unitId}/lessons/${lessonIds[0]}`;
    await staffPage.goto(editorUrl);
    const toggle = staffPage.getByRole('checkbox', {
      name: /قفل الدرس حتى اجتياز اختبار الدرس السابق/,
    });
    await expect(toggle).toBeChecked();

    // Turn it OFF, save, reload -> still OFF (persisted).
    await toggle.uncheck();
    await staffPage.getByRole('button', { name: 'حفظ الدرس' }).click();
    await expect(staffPage.getByText('تم حفظ بيانات الدرس')).toBeVisible();
    await staffPage.reload();
    await expect(
      staffPage.getByRole('checkbox', {
        name: /قفل الدرس حتى اجتياز اختبار الدرس السابق/,
      }),
    ).not.toBeChecked();

    // Turn it ON again, save, reload -> persists.
    await staffPage
      .getByRole('checkbox', { name: /قفل الدرس حتى اجتياز اختبار الدرس السابق/ })
      .check();
    await staffPage.getByRole('button', { name: 'حفظ الدرس' }).click();
    await expect(staffPage.getByText('تم حفظ بيانات الدرس')).toBeVisible();
    await staffPage.reload();
    await expect(
      staffPage.getByRole('checkbox', {
        name: /قفل الدرس حتى اجتياز اختبار الدرس السابق/,
      }),
    ).toBeChecked();
  });
});
