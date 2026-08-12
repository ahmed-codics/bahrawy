import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000';

let staffCookies = '';
let staffCsrf = '';
let studentCookies = '';
let courseId = '';
let unitId = '';
let lessonId = '';
let assessmentId = '';

const staffHeaders = (csrf = staffCsrf) => ({
  cookie: staffCookies,
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});
const studentHeaders = (csrf = '') => ({
  cookie: studentCookies,
  'x-device-fingerprint': 'exam-publish-device',
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});

test.describe.serial('Exam publish cascades to parent lesson', () => {
  test('setup: sessions, course with an EXAM lesson + DRAFT assessment, entitlement', async ({
    request,
  }) => {
    const staffRes = await request.post(`${API}/auth/staff-login`, {
      data: { email: 'admin@bahrawy.test', password: 'owner_secret' },
    });
    expect(staffRes.ok()).toBeTruthy();
    staffCookies = staffRes.headers()['set-cookie'];
    const staffCsrfRes = await request.get(`${API}/auth/csrf-token`, {
      headers: { cookie: staffCookies },
    });
    staffCsrf = (await staffCsrfRes.json()).csrfToken;

    const s1 = await request.post(`${API}/auth/login`, {
      data: { phone: '01000000001', password: 'student_secret' },
    });
    expect(s1.ok()).toBeTruthy();
    studentCookies = s1.headers()['set-cookie'];

    const h = staffHeaders();
    const course = await request.post(`${API}/admin/v1/courses`, {
      data: {
        code: `exampub-${Date.now()}`,
        titleAr: 'Exam Publish Cascade',
      },
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

    const lesson = await request.post(`${API}/admin/v1/courses/units/${unitId}/lessons`, {
      data: { titleAr: 'امتحان', contentType: 'EXAM' },
      headers: h,
    });
    expect(lesson.ok()).toBeTruthy();
    lessonId = (await lesson.json()).data.id;

    const assessment = await request.post(`${API}/admin/v1/assessments/lessons/${lessonId}`, {
      data: {
        titleAr: 'امتحان',
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
        code: `exampub-prod-${Date.now()}`,
        titleAr: 'Exam Publish Product',
        priceAmount: 100,
        courseIds: [courseId],
      },
      headers: h,
    });
    const productId = (await product.json()).data.id;
    const me = await request.get(`${API}/auth/me`, {
      headers: { cookie: studentCookies },
    });
    const profileId = (await me.json()).data.profileId;
    const grant = await request.post(`${API}/admin/v1/students/${profileId}/entitlements`, {
      data: { productId, reason: 'exam publish regression' },
      headers: h,
    });
    expect(grant.ok()).toBeTruthy();
  });

  test('1) before publishing: assessment DRAFT, lesson DRAFT, exam hidden from students', async ({
    request,
  }) => {
    const lesson = await request.get(`${API}/admin/v1/courses/lessons/${lessonId}`, {
      headers: staffHeaders(),
    });
    expect((await lesson.json()).data.status).toBe('DRAFT');

    const assessment = await request.get(`${API}/admin/v1/assessments/${assessmentId}`, {
      headers: staffHeaders(),
    });
    expect((await assessment.json()).data.status).toBe('DRAFT');

    const catalog = await request.get(`${API}/catalog/courses/${courseId}`, {
      headers: studentHeaders(),
    });
    const lessons = (await catalog.json()).data.course.chapters
      .flatMap((ch: any) => ch.units)
      .flatMap((u: any) => u.lessons);
    expect(lessons.find((l: any) => l.id === lessonId)).toBeUndefined();
  });

  test('2) publishing the exam assessment publishes the parent lesson', async ({ request }) => {
    const patch = await request.patch(`${API}/admin/v1/assessments/${assessmentId}`, {
      data: {
        titleAr: 'امتحان',
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
  });

  test('3) after publishing: the exam is visible to the entitled student', async ({ request }) => {
    const catalog = await request.get(`${API}/catalog/courses/${courseId}`, {
      headers: studentHeaders(),
    });
    const lessons = (await catalog.json()).data.course.chapters
      .flatMap((ch: any) => ch.units)
      .flatMap((u: any) => u.lessons);
    const exam = lessons.find((l: any) => l.id === lessonId);
    expect(exam).toBeTruthy();
    expect(exam.contentType).toBe('EXAM');
    expect(exam.status).toBe('PUBLISHED');

    const unit = await request.get(`${API}/catalog/units/${unitId}`, {
      headers: studentHeaders(),
    });
    const items = (await unit.json()).data.contentItems;
    expect(items.find((i: any) => i.lessonId === lessonId)).toBeUndefined();
    const examItem = items.find((i: any) => i.assessmentId === assessmentId);
    expect(examItem).toBeTruthy();
    expect(examItem.type).toBe('ASSESSMENT');
    expect(examItem.available).toBe(true);
  });
});
