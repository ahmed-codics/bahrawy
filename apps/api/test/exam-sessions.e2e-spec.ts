import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';

const SUFFIX = `${Date.now().toString(36)}`;

describe('Exam Sessions & Violations - E2E', () => {
  let app: INestApplication<App>;
  let staffCookie: string | undefined;
  let studentCookie: string | undefined;
  let studentAccountId: string;

  let assessmentId: string;
  let questionId: string;
  let freshAssessmentId: string;
  let freshQuestionId: string;
  let timerAssessmentId: string;
  let timerQuestionId: string;
  let refreshAssessmentId: string;
  let refreshQuestionId: string;
  let reopenAssessmentId: string;
  let reopenQuestionId: string;

  async function csrf(cookie: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/auth/csrf-token')
      .set('Cookie', cookie)
      .expect(200);
    return (res.body.data ?? res.body).csrfToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const staffLogin = await request(app.getHttpServer())
      .post('/auth/staff-login')
      .send({ email: 'admin@bahrawy.test', password: 'owner_secret' });
    if ([200, 201].includes(staffLogin.status)) {
      staffCookie = staffLogin.headers['set-cookie']?.[0];
    }

    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-fingerprint', 'e2e-shared-seed-device')
      .send({ phone: '+201000000001', password: 'student_secret' });
    if ([200, 201].includes(studentLogin.status)) {
      studentCookie = studentLogin.headers['set-cookie']?.[0];
    }
    expect(staffCookie).toBeDefined();
    expect(studentCookie).toBeDefined();

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', studentCookie!)
      .set('x-device-fingerprint', 'e2e-shared-seed-device')
      .expect(200);
    studentAccountId = (me.body.data ?? me.body).accountId as string;
    expect(studentAccountId).toBeTruthy();

    const course = await db.course.findFirst({
      where: { code: 'eng-g3-t1', status: 'PUBLISHED' },
      select: { id: true },
    });
    expect(course).toBeDefined();

    const organization = await db.organization.findFirst({
      where: { slug: 'bahrawy-academy-dev' },
      select: { id: true },
    });

    const question = await db.question.create({
      data: {
        organizationId: organization!.id,
        titleAr: `EXAM SESSION ${SUFFIX} سؤال`,
        options: { '1': 'أ', '2': 'ب' },
        correctOptionId: '1',
        points: 1,
      },
    });
    questionId = question.id;

    const assessment = await db.assessment.create({
      data: {
        courseId: course!.id,
        titleAr: `EXAM SESSION ${SUFFIX}`,
        durationMinutes: 30,
        status: 'PUBLISHED',
        questions: {
          create: { questionId: question.id },
        },
      },
    });
    assessmentId = assessment.id;

    const freshQuestion = await db.question.create({
      data: {
        organizationId: organization!.id,
        titleAr: `EXAM SESSION FRESH ${SUFFIX}`,
        options: { '1': 'أ', '2': 'ب' },
        correctOptionId: '1',
        points: 1,
      },
    });
    freshQuestionId = freshQuestion.id;

    const freshAssessment = await db.assessment.create({
      data: {
        courseId: course!.id,
        titleAr: `EXAM SESSION FRESH ${SUFFIX}`,
        durationMinutes: 30,
        status: 'PUBLISHED',
        questions: {
          create: { questionId: freshQuestion.id },
        },
      },
    });
    freshAssessmentId = freshAssessment.id;

    const timerQuestion = await db.question.create({
      data: {
        organizationId: organization!.id,
        titleAr: `EXAM TIMER ${SUFFIX} سؤال`,
        options: { '1': 'أ', '2': 'ب' },
        correctOptionId: '1',
        points: 1,
      },
    });
    timerQuestionId = timerQuestion.id;

    const timerAssessment = await db.assessment.create({
      data: {
        courseId: course!.id,
        titleAr: `EXAM TIMER ${SUFFIX}`,
        durationMinutes: 30,
        status: 'PUBLISHED',
        questions: {
          create: { questionId: timerQuestion.id },
        },
      },
    });
    timerAssessmentId = timerAssessment.id;

    const refreshQuestion = await db.question.create({
      data: {
        organizationId: organization!.id,
        titleAr: `EXAM REFRESH ${SUFFIX} سؤال`,
        options: { '1': 'أ', '2': 'ب' },
        correctOptionId: '1',
        points: 1,
      },
    });
    refreshQuestionId = refreshQuestion.id;

    const refreshAssessment = await db.assessment.create({
      data: {
        courseId: course!.id,
        titleAr: `EXAM REFRESH ${SUFFIX}`,
        durationMinutes: 30,
        status: 'PUBLISHED',
        questions: {
          create: { questionId: refreshQuestion.id },
        },
      },
    });
    refreshAssessmentId = refreshAssessment.id;

    const reopenQuestion = await db.question.create({
      data: {
        organizationId: organization!.id,
        titleAr: `EXAM REOPEN ${SUFFIX} سؤال`,
        options: { '1': 'أ', '2': 'ب' },
        correctOptionId: '1',
        points: 1,
      },
    });
    reopenQuestionId = reopenQuestion.id;

    const reopenAssessment = await db.assessment.create({
      data: {
        courseId: course!.id,
        titleAr: `EXAM REOPEN ${SUFFIX}`,
        durationMinutes: 30,
        status: 'PUBLISHED',
        questions: {
          create: { questionId: reopenQuestion.id },
        },
      },
    });
    reopenAssessmentId = reopenAssessment.id;
  });

  afterAll(async () => {
    for (const id of [
      assessmentId,
      freshAssessmentId,
      timerAssessmentId,
      refreshAssessmentId,
      reopenAssessmentId,
    ]) {
      if (!id) continue;
      await db.examSessionEvent
        .deleteMany({ where: { assessmentId: id } })
        .catch(() => null);
      await db.examSession
        .deleteMany({ where: { assessmentId: id } })
        .catch(() => null);
      await db.assessmentAttempt
        .deleteMany({ where: { assessmentId: id } })
        .catch(() => null);
      await db.assessmentQuestion
        .deleteMany({ where: { assessmentId: id } })
        .catch(() => null);
      await db.assessment.delete({ where: { id } }).catch(() => null);
    }
    for (const id of [
      questionId,
      freshQuestionId,
      timerQuestionId,
      refreshQuestionId,
      reopenQuestionId,
    ]) {
      if (!id) continue;
      await db.question.delete({ where: { id } }).catch(() => null);
    }
    await db.$disconnect();
    await app.close();
  });

  async function startAttempt(newAttempt = false) {
    if (!studentCookie) throw new Error('no student cookie');
    const token = await csrf(studentCookie);
    const res = await request(app.getHttpServer())
      .post(`/assessments/${assessmentId}/start`)
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', 'e2e-shared-seed-device')
      .set('x-csrf-token', token)
      .send({ newAttempt })
      .expect(201);
    return res.body.data;
  }

  async function reportViolation(attemptId: string, reason: string) {
    if (!studentCookie) throw new Error('no student cookie');
    const token = await csrf(studentCookie);
    return request(app.getHttpServer())
      .post(`/assessments/attempt/${attemptId}/exam-session/violations`)
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', 'e2e-shared-seed-device')
      .set('x-csrf-token', token)
      .send({ reason });
  }

  async function dbSession(
    overrides: Partial<{
      expiresAt: Date;
      status: 'ACTIVE' | 'LOCKED' | 'EXPIRED' | 'SUBMITTED';
      lockReason: string;
      lockedAt: Date;
    }> = {},
  ): Promise<{ attemptId: string; sessionId: string }> {
    const session = await db.examSession.create({
      data: {
        assessmentId,
        accountId: studentAccountId,
        startedAt: new Date(Date.now() - 120_000),
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
        lastActivityAt: new Date(),
        status: overrides.status ?? 'ACTIVE',
        attemptCount: 1,
        openCount: 1,
        ...(overrides.lockReason ? { lockReason: overrides.lockReason } : {}),
        ...(overrides.lockedAt ? { lockedAt: overrides.lockedAt } : {}),
      },
    });
    await db.examSessionEvent.create({
      data: {
        sessionId: session.id,
        accountId: studentAccountId,
        assessmentId,
        eventType: 'EXAM_STARTED',
        metadata: {},
      },
    });
    if (overrides.status === 'LOCKED' && overrides.lockReason) {
      await db.examSessionEvent.createMany({
        data: [
          {
            sessionId: session.id,
            accountId: studentAccountId,
            assessmentId,
            eventType: overrides.lockReason,
            metadata: {},
          },
          {
            sessionId: session.id,
            accountId: studentAccountId,
            assessmentId,
            eventType: 'EXAM_LOCKED',
            metadata: {},
          },
        ],
      });
    }
    const attempt = await db.assessmentAttempt.create({
      data: {
        assessmentId,
        accountId: studentAccountId,
        startedAt: new Date(Date.now() - 120_000),
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
        autosavedAnswers: { [questionId]: '1' },
        examSessionId: session.id,
      },
    });
    return { attemptId: attempt.id, sessionId: session.id };
  }

  describe('RBAC & tenant guards', () => {
    it('rejects unauthenticated admin access', async () => {
      await request(app.getHttpServer())
        .get('/admin/v1/exam-violations')
        .expect(401);
    });

    it('rejects a student account from the admin violations API', async () => {
      if (!studentCookie) return;
      await request(app.getHttpServer())
        .get('/admin/v1/exam-violations')
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .expect(403);
    });

    it('returns a valid list payload for staff', async () => {
      if (!staffCookie) return;
      const response = await request(app.getHttpServer())
        .get('/admin/v1/exam-violations?page=1&pageSize=25')
        .set('Cookie', staffCookie)
        .expect(200);
      const data = response.body.data as {
        items: unknown[];
        meta: {
          page: number;
          pageSize: number;
          total: number;
          pageCount: number;
        };
        statuses: unknown[];
        courses: unknown[];
        exams: unknown[];
        grades: unknown[];
      };
      expect(data.items).toBeInstanceOf(Array);
      expect(data.meta).toBeDefined();
      expect(data.statuses).toBeInstanceOf(Array);
      expect(data.courses).toBeInstanceOf(Array);
      expect(data.exams).toBeInstanceOf(Array);
      expect(data.grades).toBeInstanceOf(Array);
    });
  });

  describe('session lifecycle on the student API', () => {
    let attemptId: string;
    let sessionId: string;

    it('start creates an ACTIVE exam session with server expiresAt and openCount=1', async () => {
      const attempt = await startAttempt();
      expect(attempt.id).toBeTruthy();
      expect(attempt.examSessionId).toBeTruthy();
      attemptId = attempt.id;

      const session = await db.examSession.findUnique({
        where: { id: attempt.examSessionId },
      });
      expect(session).toBeDefined();
      expect(session!.status).toBe('ACTIVE');
      expect(session!.expiresAt).toBeInstanceOf(Date);
      expect(session!.openCount).toBe(1);
      expect(session!.attemptCount).toBeGreaterThanOrEqual(1);
      sessionId = session!.id;
    });

    it('a page refresh reuses the same ACTIVE session without inflating counters', async () => {
      const attempt = await startAttempt();
      expect(attempt.id).toBe(attemptId);
      const session = await db.examSession.findUnique({
        where: { id: sessionId },
      });
      expect(session!.openCount).toBe(1);
      expect(session!.status).toBe('ACTIVE');
    });

    it('GET attempt state returns the session summary', async () => {
      if (!studentCookie) return;
      const res = await request(app.getHttpServer())
        .get(`/assessments/attempt/${attemptId}/exam-session`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .expect(200);
      const data = res.body.data;
      expect(data.id).toBe(sessionId);
      expect(data.status).toBe('ACTIVE');
    });

    it('a violation with an unknown reason is rejected', async () => {
      const res = await reportViolation(attemptId, 'HACKED_DEVICE');
      expect(res.status).toBe(400);
    });

    it('a violation locks the session and records audit events', async () => {
      const res = await reportViolation(attemptId, 'FULLSCREEN_EXIT');
      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data.status).toBe('LOCKED');
      expect(data.lockReason).toBe('FULLSCREEN_EXIT');
      expect(data.violationCount).toBeGreaterThanOrEqual(1);

      const session = await db.examSession.findUnique({
        where: { id: sessionId },
      });
      expect(session!.status).toBe('LOCKED');
      expect(session!.lockedAt).toBeInstanceOf(Date);

      const events = await db.examSessionEvent.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      });
      const types = events.map((e) => e.eventType);
      expect(types).toContain('EXAM_STARTED');
      expect(types).toContain('FULLSCREEN_EXIT');
      expect(types).toContain('EXAM_LOCKED');
    });

    it('a locked session blocks starting a new attempt', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/${assessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: true })
        .expect(403);
      expect(res.body.message).toBeDefined();
    });

    it('a locked session blocks reading the attempt', async () => {
      if (!studentCookie) return;
      const res = await request(app.getHttpServer())
        .get(`/assessments/attempt/${attemptId}`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .expect(403);
      expect(res.body.message).toBeDefined();
    });

    it('a locked session blocks autosave', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/attempt/${attemptId}/autosave`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ answers: { '1': 'أ' } })
        .expect(403);
      expect(res.body.message).toBeDefined();
    });

    it('a locked session blocks submit', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/attempt/${attemptId}/submit`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({})
        .expect(403);
      expect(res.body.message).toBeDefined();
    });
  });

  describe('admin reopen flow', () => {
    let attId: string;
    let sessId: string;

    it('a student cannot reopen a session (admin-only)', async () => {
      const fresh = await dbSession({
        status: 'LOCKED',
        lockReason: 'TAB_SWITCH',
        lockedAt: new Date(),
      });
      attId = fresh.attemptId;
      sessId = fresh.sessionId;

      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const denied = await request(app.getHttpServer())
        .post(`/admin/v1/exam-violations/${sessId}/reopen`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({});
      expect([401, 403]).toContain(denied.status);
    });

    it('staff reopen clears the lock and records the event', async () => {
      if (!staffCookie) return;
      const token = await csrf(staffCookie);
      const res = await request(app.getHttpServer())
        .post(`/admin/v1/exam-violations/${sessId}/reopen`)
        .set('Cookie', staffCookie)
        .set('x-csrf-token', token)
        .expect(201);
      const data = res.body.data;
      expect(data.status).toBe('ACTIVE');
      expect(data.lockedAt).toBeNull();
      expect(typeof data.reopenedAt).toBe('string');
      expect(data.reopenedBy).toBeTruthy();

      const events = await db.examSessionEvent.findMany({
        where: { sessionId: sessId, eventType: 'EXAM_REOPENED' },
        orderBy: { timestamp: 'asc' },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
      const reopenEvent = events[events.length - 1];
      const meta = reopenEvent.metadata as Record<string, unknown>;
      expect(reopenEvent.actor).toBeTruthy();
      expect(meta.wasStatus).toBe('LOCKED');
      expect(meta.reason).toBe('TAB_SWITCH');
      expect(meta.attemptId).toBe(attId);
      expect(meta.organizationId).toBeTruthy();
    });

    it('reopening a non-locked session conflicts', async () => {
      if (!staffCookie) return;
      const token = await csrf(staffCookie);
      const res = await request(app.getHttpServer())
        .post(`/admin/v1/exam-violations/${sessId}/reopen`)
        .set('Cookie', staffCookie)
        .set('x-csrf-token', token)
        .expect(409);
      expect(res.body.code).toBe('EXAM_SESSION_NOT_LOCKED');
    });

    it('reopening an unknown session 404s', async () => {
      if (!staffCookie) return;
      const token = await csrf(staffCookie);
      await request(app.getHttpServer())
        .post('/admin/v1/exam-violations/does-not-exist/reopen')
        .set('Cookie', staffCookie)
        .set('x-csrf-token', token)
        .expect(404);
    });

    it('the admin events endpoint returns the tenant-scoped audit trail', async () => {
      if (!staffCookie) return;
      const res = await request(app.getHttpServer())
        .get(`/admin/v1/exam-violations/${sessId}/events`)
        .set('Cookie', staffCookie)
        .expect(200);
      const data = res.body.data as Array<{ eventType: string }>;
      expect(Array.isArray(data)).toBe(true);
      const types = data.map((e) => e.eventType);
      expect(types).toContain('EXAM_STARTED');
      expect(types).toContain('TAB_SWITCH');
      expect(types).toContain('EXAM_REOPENED');
    });

    it('after reopen the student can autosave and submit again', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const save = await request(app.getHttpServer())
        .post(`/assessments/attempt/${attId}/autosave`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ answers: { [questionId]: '1' } });
      expect([200, 201]).toContain(save.status);

      const submit = await request(app.getHttpServer())
        .post(`/assessments/attempt/${attId}/submit`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({});
      expect([200, 201]).toContain(submit.status);

      const session = await db.examSession.findUnique({
        where: { id: sessId },
      });
      expect(session!.status).toBe('SUBMITTED');
    });
  });

  describe('expired session behavior', () => {
    let attId: string;
    let sessId: string;

    it('an expired-timer session blocks answer reads and writes', async () => {
      const fresh = await dbSession({
        expiresAt: new Date(Date.now() - 60_000),
      });
      attId = fresh.attemptId;
      sessId = fresh.sessionId;

      if (!studentCookie) return;
      const read = await request(app.getHttpServer())
        .get(`/assessments/attempt/${attId}`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .then();
      expect([403, 409]).toContain(read.status);

      const session = await db.examSession.findUnique({
        where: { id: sessId },
      });
      expect(['EXPIRED', 'LOCKED']).toContain(session!.status);

      const token = await csrf(studentCookie);
      const save = await request(app.getHttpServer())
        .post(`/assessments/attempt/${attId}/autosave`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ answers: { [questionId]: '1' } });
      expect([403, 409]).toContain(save.status);
    });

    it('submit is rejected after expiry', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/attempt/${attId}/submit`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({});
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EXAM_SESSION_EXPIRED');
      const session = await db.examSession.findUnique({
        where: { id: sessId },
      });
      expect(session!.status).toBe('EXPIRED');
    });

    it('a fully expired session + expired attempt is NOT silently re-opened: start is rejected with EXAM_SESSION_EXPIRED and no new session is created', async () => {
      if (!studentCookie) return;

      const expired = await db.examSession.create({
        data: {
          assessmentId,
          accountId: studentAccountId,
          startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
          lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
          status: 'EXPIRED',
          attemptCount: 1,
          openCount: 1,
        },
      });
      await db.examSessionEvent.create({
        data: {
          sessionId: expired.id,
          accountId: studentAccountId,
          assessmentId,
          eventType: 'EXAM_EXPIRED',
          metadata: {},
        },
      });
      await db.assessmentAttempt.create({
        data: {
          assessmentId,
          accountId: studentAccountId,
          startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
          autosavedAnswers: {},
          examSessionId: expired.id,
        },
      });

      const attemptsInSessionBefore = await db.assessmentAttempt.count({
        where: { examSessionId: expired.id },
      });
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/${assessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: true });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EXAM_SESSION_EXPIRED');

      const attemptsInSessionAfter = await db.assessmentAttempt.count({
        where: { examSessionId: expired.id },
      });
      expect(attemptsInSessionAfter).toBe(attemptsInSessionBefore);

      await db.examSessionEvent
        .deleteMany({ where: { sessionId: expired.id } })
        .catch(() => null);
      await db.assessmentAttempt
        .deleteMany({ where: { examSessionId: expired.id } })
        .catch(() => null);
      await db.examSession
        .delete({ where: { id: expired.id } })
        .catch(() => null);
    });

    it('a consumer opening a fresh sitting gets a new session with a higher openCount', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const first = await request(app.getHttpServer())
        .post(`/assessments/${freshAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: false })
        .expect(201);
      const firstAttempt = first.body.data;
      const firstSession = await db.examSession.findUnique({
        where: { id: firstAttempt.examSessionId },
      });
      expect(firstSession!.openCount).toBe(1);
      expect(firstSession!.status).toBe('ACTIVE');

      const submitted = await request(app.getHttpServer())
        .post(`/assessments/attempt/${firstAttempt.id}/submit`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({});
      expect([200, 201]).toContain(submitted.status);

      const second = await request(app.getHttpServer())
        .post(`/assessments/${freshAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: true })
        .expect(201);
      const secondAttempt = second.body.data;
      expect(secondAttempt.id).not.toBe(firstAttempt.id);
      const secondSession = await db.examSession.findUnique({
        where: { id: secondAttempt.examSessionId },
      });
      expect(secondSession!.openCount).toBeGreaterThan(1);
      expect(secondSession!.status).toBe('ACTIVE');
    });
  });

  describe('timer & duration rules', () => {
    it('durationMinutes=30 produces expiresAt = startedAt + 30min on the server', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/${freshAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: true });
      expect([200, 201]).toContain(res.status);
      const data = res.body.data as {
        id: string;
        examSessionId: string;
        expiresAt: string;
      };
      const attempt = await db.assessmentAttempt.findUnique({
        where: { id: data.id },
      });
      const session = await db.examSession.findUnique({
        where: { id: data.examSessionId },
      });
      expect(attempt!.expiresAt).toBeInstanceOf(Date);
      expect(session!.expiresAt).toBeInstanceOf(Date);
      expect(attempt!.expiresAt!.getTime()).toBe(
        attempt!.startedAt.getTime() + 30 * 60 * 1000,
      );
      expect(session!.expiresAt!.getTime()).toBe(
        session!.startedAt.getTime() + 30 * 60 * 1000,
      );
    });

    it('admin can reopen an EXPIRED session and the student can start again (fresh window)', async () => {
      if (!staffCookie || !studentCookie) return;
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/${reopenAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: false });
      expect([200, 201]).toContain(res.status);
      const sessionId = (res.body.data as { examSessionId: string })
        .examSessionId;

      const past = new Date(Date.now() - 60_000);
      await db.examSession.update({
        where: { id: sessionId },
        data: { expiresAt: past, status: 'EXPIRED', endedAt: past },
      });
      await db.assessmentAttempt.updateMany({
        where: { examSessionId: sessionId },
        data: { expiresAt: past },
      });

      const staffToken = await csrf(staffCookie);
      const reopen = await request(app.getHttpServer())
        .post(`/admin/v1/exam-violations/${sessionId}/reopen`)
        .set('Cookie', staffCookie)
        .set('x-csrf-token', staffToken)
        .expect([200, 201]);
      const reopened = reopen.body.data as {
        status: string;
        expiresAt: string | null;
        reopenedAt: string;
        reopenedBy: string;
      };
      expect(reopened.status).toBe('ACTIVE');
      expect(reopened.reopenedAt).toBeTruthy();
      expect(reopened.reopenedBy).toBeTruthy();
      expect(new Date(reopened.expiresAt!).getTime()).toBeGreaterThan(
        Date.now(),
      );

      const start2 = await request(app.getHttpServer())
        .post(`/assessments/${reopenAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: true });
      expect([200, 201]).toContain(start2.status);
      expect(
        (start2.body.data as { examSessionId: string }).examSessionId,
      ).toBe(sessionId);
    });

    it('a single admin reopen of a LOCKED session whose timer elapsed lets the student resume', async () => {
      if (!staffCookie || !studentCookie) return;
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/${reopenAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: false });
      expect([200, 201]).toContain(res.status);
      const sessionId = (res.body.data as { examSessionId: string })
        .examSessionId;

      const past = new Date(Date.now() - 60_000);
      const lockedAt = new Date();
      await db.examSession.update({
        where: { id: sessionId },
        data: {
          status: 'LOCKED',
          lockedAt,
          lockReason: 'FULLSCREEN_EXIT',
          expiresAt: past,
        },
      });
      await db.assessmentAttempt.updateMany({
        where: { examSessionId: sessionId },
        data: { expiresAt: past },
      });

      const staffToken = await csrf(staffCookie);
      const reopen = await request(app.getHttpServer())
        .post(`/admin/v1/exam-violations/${sessionId}/reopen`)
        .set('Cookie', staffCookie)
        .set('x-csrf-token', staffToken)
        .expect([200, 201]);
      const reopened = reopen.body.data as {
        status: string;
        expiresAt: string | null;
      };
      expect(reopened.status).toBe('ACTIVE');
      expect(new Date(reopened.expiresAt!).getTime()).toBeGreaterThan(
        Date.now(),
      );

      const start2 = await request(app.getHttpServer())
        .post(`/assessments/${reopenAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: false });
      expect([200, 201]).toContain(start2.status);
      expect(
        (start2.body.data as { examSessionId: string }).examSessionId,
      ).toBe(sessionId);

      const session = await db.examSession.findUnique({
        where: { id: sessionId },
      });
      expect(session!.status).toBe('ACTIVE');
      expect(session!.lockReason).toBeNull();
      expect(session!.lockedAt).toBeNull();
      expect(session!.reopenedAt).toBeTruthy();
    });

    it('refresh/closed browser preserves remaining time (same session + same expiresAt)', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);
      const res = await request(app.getHttpServer())
        .post(`/assessments/${refreshAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: false })
        .expect(201);
      const attempt1 = res.body.data as { id: string; examSessionId: string };

      const refresh = await request(app.getHttpServer())
        .post(`/assessments/${refreshAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: false })
        .expect(201);
      const attempt2 = refresh.body.data as {
        id: string;
        examSessionId: string;
      };

      expect(attempt2.id).toBe(attempt1.id);
      expect(attempt2.examSessionId).toBe(attempt1.examSessionId);
      const session = await db.examSession.findUnique({
        where: { id: attempt1.examSessionId },
      });
      expect(session!.openCount).toBe(1);
      expect(session!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('changing durationMinutes affects only future sessions (existing active session keeps its expiresAt)', async () => {
      if (!studentCookie) return;
      const token = await csrf(studentCookie);

      const first = await request(app.getHttpServer())
        .post(`/assessments/${timerAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: false })
        .expect(201);
      const firstData = first.body.data as {
        id: string;
        examSessionId: string;
      };
      const firstSession = await db.examSession.findUnique({
        where: { id: firstData.examSessionId },
      });
      const firstExpiresAt = firstSession!.expiresAt!.getTime();
      expect(firstExpiresAt).toBe(
        firstSession!.startedAt.getTime() + 30 * 60 * 1000,
      );

      if (staffCookie) {
        const staffToken = await csrf(staffCookie);
        const detail = await request(app.getHttpServer())
          .get(`/admin/v1/assessments/${timerAssessmentId}`)
          .set('Cookie', staffCookie)
          .expect(200);
        const currVersion = (detail.body.data as { version: number }).version;
        await request(app.getHttpServer())
          .patch(`/admin/v1/assessments/${timerAssessmentId}`)
          .set('Cookie', staffCookie)
          .set('x-csrf-token', staffToken)
          .send({ durationMinutes: 60, version: currVersion })
          .expect(200);
      }

      const stillActive = await db.examSession.findUnique({
        where: { id: firstData.examSessionId },
      });
      expect(stillActive!.expiresAt!.getTime()).toBe(firstExpiresAt);

      await request(app.getHttpServer())
        .post(`/assessments/attempt/${firstData.id}/submit`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({})
        .expect([200, 201]);

      const second = await request(app.getHttpServer())
        .post(`/assessments/${timerAssessmentId}/start`)
        .set('Cookie', studentCookie)
        .set('x-device-fingerprint', 'e2e-shared-seed-device')
        .set('x-csrf-token', token)
        .send({ newAttempt: true })
        .expect(201);
      const secondData = second.body.data as { examSessionId: string };
      const secondSession = await db.examSession.findUnique({
        where: { id: secondData.examSessionId },
      });
      expect(secondSession!.openCount).toBeGreaterThan(1);
      expect(secondSession!.expiresAt!.getTime()).toBe(
        secondSession!.startedAt.getTime() + 60 * 60 * 1000,
      );
    });
  });

  describe('payload safety & filters', () => {
    it('admin payloads never leak auth secrets or answer keys', async () => {
      if (!staffCookie) return;
      const res = await request(app.getHttpServer())
        .get('/admin/v1/exam-violations?status=LOCKED')
        .set('Cookie', staffCookie)
        .expect(200);
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('tokenHash');
      expect(serialized).not.toContain('autosavedAnswers');
      expect(serialized).not.toContain('correctOptionId');
    });

    it('supports status filter and clamps page size', async () => {
      if (!staffCookie) return;
      const res = await request(app.getHttpServer())
        .get('/admin/v1/exam-violations?status=LOCKED&pageSize=100000')
        .set('Cookie', staffCookie)
        .expect(200);
      const data = res.body.data as { meta: { pageSize: number } };
      expect(data.meta.pageSize).toBeLessThanOrEqual(100);
    });

    it('the student session summary exposes no secrets', async () => {
      if (!studentCookie) return;
      const res = await request(app.getHttpServer())
        .get('/admin/v1/exam-violations?status=ACTIVE')
        .set('Cookie', staffCookie ?? '')
        .expect(staffCookie ? 200 : 401);
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('phoneHmac');
    });
  });
});
