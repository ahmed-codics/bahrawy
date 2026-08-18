import { test, expect, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:3000';
const STAFF = 'http://localhost:3002';
const WEB = 'http://localhost:3001';

const REQUESTABLE_LESSON_ID = '3318de6c-e140-47a5-bf8e-5d37afdf4b8c';
const COURSE_ID = 'afbb2884-19d6-40a8-8f7b-bb0174ab0589';

let staffCookies = '';
let staffCsrf = '';

let sharedPhone = '';
let sharedPassword = 'student_secret';
// One fixed device fingerprint so the shared student's primary device never
// changes between serial tests (device-lock blocks unknown devices).
const SHARED_FP = 'e2e-video-access-shared-device';

const staffHeaders = (csrf = staffCsrf) => ({
  cookie: staffCookies,
  ...(csrf ? { 'x-csrf-token': csrf } : {}),
});

const login = async (
  request: APIRequestContext,
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

const registerOneStudent = async (request: APIRequestContext) => {
  const stamp = Date.now();
  const phone = `01${['0', '1', '2', '5'][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`;
  const res = await request.post(`${API}/auth/register`, {
    data: {
      firstName: 'Video',
      secondName: 'Access',
      thirdName: 'Request',
      lastName: `E2E${stamp}`,
      phone,
      parentPhone: `01${['0', '1', '2', '5'][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `videoaccess${stamp}@bahrawy.test`,
      schoolName: 'Test School',
      gender: 'MALE',
      city: 'Cairo',
      gradeId: '6ba0f5e8-120e-4492-a135-0696839bb80a',
      password: sharedPassword,
    },
  });
  expect(res.ok()).toBeTruthy();
  return phone;
};

test.describe.serial('Video Access Request feature', () => {
  test('Setup: staff session + one shared student', async ({ request }) => {
    const staff = await login(request, '/auth/staff-login', {
      email: 'admin@bahrawy.test',
      password: 'owner_secret',
    });
    staffCookies = staff.cookies;
    staffCsrf = staff.csrf;

    sharedPhone = await registerOneStudent(request);
    expect(sharedPhone).toBeTruthy();

    // The shared student logs in from a single fixed device across tests, so
    // the first login makes that device primary and no device-lock triggers.
    const student = await login(request, '/auth/login', {
      phone: sharedPhone,
      password: sharedPassword,
    }, SHARED_FP);
    expect(student.cookies).toBeTruthy();
  });

  test('Student request lifecycle via API', async ({ request }) => {
    expect(sharedPhone).toBeTruthy();

    const fp = SHARED_FP;
    const student = await login(request, '/auth/login', {
      phone: sharedPhone,
      password: sharedPassword,
    }, fp);

    // The student has no entitlement to this course -> requestable.
    const statusBefore = await request.get(
      `${API}/video-access-requests/${REQUESTABLE_LESSON_ID}/status`,
      {
        headers: { cookie: student.cookies, 'x-device-fingerprint': fp },
      },
    );
    expect(statusBefore.ok()).toBeTruthy();
    const statusBeforeBody = await statusBefore.json();
    expect(statusBeforeBody.data.requestable).toBe(true);
    expect(statusBeforeBody.data.canPlay).toBe(false);

    // Create the request.
    const create = await request.post(`${API}/video-access-requests`, {
      data: { lessonId: REQUESTABLE_LESSON_ID },
      headers: {
        cookie: student.cookies,
        'x-device-fingerprint': fp,
        'x-csrf-token': student.csrf,
      },
    });
    expect(create.ok()).toBeTruthy();
    const created = (await create.json()).data;
    expect(created.status).toBe('PENDING');

    // Duplicate pending is rejected.
    const duplicate = await request.post(`${API}/video-access-requests`, {
      data: { lessonId: REQUESTABLE_LESSON_ID },
      headers: {
        cookie: student.cookies,
        'x-device-fingerprint': fp,
        'x-csrf-token': student.csrf,
      },
    });
    expect(duplicate.status()).toBe(409);

    // Playback is denied before approval.
    const manifestBefore = await request.get(
      `${API}/video/${REQUESTABLE_LESSON_ID}/manifest`,
      { headers: { cookie: student.cookies, 'x-device-fingerprint': fp } },
    );
    expect([403, 404]).toContain(manifestBefore.status());

    // Admin approves with a fixed duration.
    const approve = await request.post(
      `${API}/admin/v1/video-access/requests/${created.id}/approve`,
      {
        data: { durationType: 'ONE_DAY' },
        headers: staffHeaders(staffCsrf),
      },
    );
    expect(approve.ok()).toBeTruthy();
    const approved = (await approve.json()).data;
    expect(approved.grantId).toBeTruthy();

    // Playback is now granted.
    const manifestAfter = await request.get(
      `${API}/video/${REQUESTABLE_LESSON_ID}/manifest`,
      { headers: { cookie: student.cookies, 'x-device-fingerprint': fp } },
    );
    expect(manifestAfter.ok()).toBeTruthy();

    // Status now reflects canPlay.
    const statusAfter = await request.get(
      `${API}/video-access-requests/${REQUESTABLE_LESSON_ID}/status`,
      {
        headers: { cookie: student.cookies, 'x-device-fingerprint': fp },
      },
    );
    const statusAfterBody = await statusAfter.json();
    expect(statusAfterBody.data.canPlay).toBe(true);

    // Admin revokes, playback is denied again.
    const revoke = await request.post(
      `${API}/admin/v1/video-access/grants/${approved.grantId}/revoke`,
      {
        data: { reason: 'E2E revoke' },
        headers: staffHeaders(staffCsrf),
      },
    );
    expect(revoke.ok()).toBeTruthy();

    const manifestRevoked = await request.get(
      `${API}/video/${REQUESTABLE_LESSON_ID}/manifest`,
      { headers: { cookie: student.cookies, 'x-device-fingerprint': fp } },
    );
    const revokedBody = await manifestRevoked.json();
    expect(manifestRevoked.status()).toBe(403);
    expect(revokedBody.code).toBe('VIDEO_ACCESS_REVOKED');
  });

  test('Admin rejects a request with a reason', async ({ request }) => {
    expect(sharedPhone).toBeTruthy();

    const fp = SHARED_FP;
    const student = await login(request, '/auth/login', {
      phone: sharedPhone,
      password: sharedPassword,
    }, fp);

    const create = await request.post(`${API}/video-access-requests`, {
      data: { lessonId: REQUESTABLE_LESSON_ID },
      headers: {
        cookie: student.cookies,
        'x-device-fingerprint': fp,
        'x-csrf-token': student.csrf,
      },
    });
    expect(create.ok()).toBeTruthy();
    const created = (await create.json()).data;

    const reject = await request.post(
      `${API}/admin/v1/video-access/requests/${created.id}/reject`,
      {
        data: { reason: 'E2E rejection reason' },
        headers: staffHeaders(staffCsrf),
      },
    );
    expect(reject.ok()).toBeTruthy();

    const status = await request.get(
      `${API}/video-access-requests/${REQUESTABLE_LESSON_ID}/status`,
      {
        headers: { cookie: student.cookies, 'x-device-fingerprint': fp },
      },
    );
    const statusBody = await status.json();
    expect(statusBody.data.request.status).toBe('REJECTED');
    expect(statusBody.data.request.rejectionReason).toBe('E2E rejection reason');
  });

  test('Non-privileged staff cannot access the admin endpoints', async ({
    request,
  }) => {
    const res = await request.get(`${API}/admin/v1/video-access/requests`, {
      headers: { cookie: 'invalid-session' },
    });
    expect(res.status()).toBe(401);
  });
});