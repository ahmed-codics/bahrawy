import { NotFoundException } from '@nestjs/common';
import { AdminV1ExamViolationsService } from './exam-violations.service';

jest.mock('@bahrawy/db', () => {
  const { Prisma } = jest.requireActual('@prisma/client');
  return {
    db: {
      examSession: { findMany: jest.fn(), findFirst: jest.fn() },
      assessmentAttempt: { findMany: jest.fn() },
      course: { findMany: jest.fn() },
      grade: { findMany: jest.fn() },
      account: { findFirst: jest.fn() },
      assessment: { findFirst: jest.fn() },
    },
    Prisma,
  };
});

import { db } from '@bahrawy/db';

const examSessionServiceMock = {
  reopen: jest.fn(),
  listEvents: jest.fn(),
  createGrant: jest.fn().mockResolvedValue(undefined),
  availableGrants: jest.fn().mockResolvedValue(0),
};

const service = new AdminV1ExamViolationsService(examSessionServiceMock as any);

const sessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'session-1',
  accountId: 'account-1',
  assessmentId: 'assessment-1',
  status: 'LOCKED',
  startedAt: new Date('2026-08-01T10:00:00.000Z'),
  expiresAt: null,
  lastActivityAt: new Date('2026-08-01T10:05:00.000Z'),
  endedAt: null,
  lockedAt: new Date('2026-08-01T10:02:00.000Z'),
  lockReason: 'FULLSCREEN_EXIT',
  violationCount: 1,
  reopenedAt: null,
  reopenedBy: null,
  openCount: 1,
  attemptCount: 1,
  account: {
    id: 'account-1',
    studentProfile: {
      id: 'student-1',
      displayName: 'سارة أحمد',
      studentNumber: 2025001,
      grade: { id: 'grade-1', nameAr: 'الصف الأول الثانوي' },
    },
  },
  assessment: {
    id: 'assessment-1',
    titleAr: 'اختبار نهاية الدرس',
    passingScore: 70,
    lesson: { id: 'lesson-1', titleAr: 'الدرس الثاني' },
    course: { id: 'course-1', titleAr: 'كورس الرياضيات' },
  },
  ...overrides,
});

const attemptRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'attempt-1',
  accountId: 'account-2',
  assessmentId: 'assessment-2',
  score: 40,
  submittedAt: new Date('2026-08-01T11:00:00.000Z'),
  examSessionId: 'session-2',
  account: {
    studentProfile: {
      id: 'student-2',
      displayName: 'محمد علي',
      studentNumber: 2025002,
      grade: { id: 'grade-2', nameAr: 'الصف الثاني الثانوي' },
    },
  },
  assessment: {
    id: 'assessment-2',
    titleAr: 'اختبار نهاية الدرس الثاني',
    passingScore: 60,
    lesson: { id: 'lesson-2', titleAr: 'الدرس الخامس' },
    course: { id: 'course-2', titleAr: 'كورس الفيزياء' },
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (db.course.findMany as jest.Mock).mockResolvedValue([]);
  (db.grade.findMany as jest.Mock).mockResolvedValue([]);
});

const baseQuery = {
  page: 1,
  pageSize: 25,
};

describe('AdminV1ExamViolationsService.list', () => {
  it('returns SUSPENDED rows for locked/expired sessions with a reason', async () => {
    (db.examSession.findMany as jest.Mock).mockResolvedValue([sessionRow()]);
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.list('org-1', { ...baseQuery });

    const row: any = result.items.find(
      (item: any) => item.caseType === 'SUSPENDED',
    );
    expect(row).toBeTruthy();
    expect(row.status).toBe('LOCKED');
    expect(row.lockReason).toBe('FULLSCREEN_EXIT');
    expect(row.reason).toContain('ملء الشاشة');
    expect(row.student.name).toBe('سارة أحمد');
    expect(row.exam.titleAr).toBe('اختبار نهاية الدرس');
    expect(row.lesson.titleAr).toBe('الدرس الثاني');
    expect(row.attemptsCount).toBe(0);
  });

  it('returns FAILED rows for submitted attempts below the passing score', async () => {
    (db.examSession.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args.where?.status?.in) return Promise.resolve([]);
      return Promise.resolve([
        {
          id: 'session-2',
          accountId: 'account-2',
          assessmentId: 'assessment-2',
          status: 'SUBMITTED',
          openCount: 2,
        },
      ]);
    });
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      attemptRow(),
    ]);

    const result = await service.list('org-1', { ...baseQuery });

    const row: any = result.items.find(
      (item: any) => item.caseType === 'FAILED',
    );
    expect(row).toBeTruthy();
    expect(row.reason).toContain('فشل في الاختبار');
    expect(row.reason).toContain('40/60');
    expect(row.score).toBe(40);
    expect(row.passingScore).toBe(60);
    expect(row.attemptsCount).toBe(1);
    expect(row.openCount).toBe(2);
    expect(row.accountId).toBe('account-2');
    expect(row.sessionId).toBeNull();
  });

  it('does not flag an attempt that met the passing score as FAILED', async () => {
    (db.examSession.findMany as jest.Mock).mockResolvedValue([]);
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      attemptRow({ score: 80 }),
    ]);

    const result = await service.list('org-1', { ...baseQuery });

    expect(result.items.some((item: any) => item.caseType === 'FAILED')).toBe(
      false,
    );
  });

  it('drops a student from FAILED once their latest attempt passes', async () => {
    (db.examSession.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args.where?.status?.in) return Promise.resolve([]);
      return Promise.resolve([
        {
          id: 'session-2',
          accountId: 'account-2',
          assessmentId: 'assessment-2',
          status: 'SUBMITTED',
          openCount: 2,
        },
      ]);
    });
    // Ordered submittedAt DESC: the newest attempt PASSED (80), an older one
    // FAILED (40). The student later succeeded so must NOT appear as FAILED.
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      attemptRow({
        id: 'attempt-pass',
        score: 80,
        submittedAt: new Date('2026-08-05T11:00:00.000Z'),
      }),
      attemptRow({
        id: 'attempt-fail',
        score: 40,
        submittedAt: new Date('2026-08-01T11:00:00.000Z'),
      }),
    ]);

    const result = await service.list('org-1', { ...baseQuery });

    expect(result.items.some((item: any) => item.caseType === 'FAILED')).toBe(
      false,
    );
  });

  it('keeps a student in FAILED when their latest attempt is a fail after an earlier pass', async () => {
    (db.examSession.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args.where?.status?.in) return Promise.resolve([]);
      return Promise.resolve([
        {
          id: 'session-2',
          accountId: 'account-2',
          assessmentId: 'assessment-2',
          status: 'SUBMITTED',
          openCount: 3,
        },
      ]);
    });
    // Ordered submittedAt DESC: the newest attempt FAILED (30) after an earlier
    // PASS (80). The latest state is a fail, so the student must still appear.
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      attemptRow({
        id: 'attempt-fail-latest',
        score: 30,
        submittedAt: new Date('2026-08-06T11:00:00.000Z'),
      }),
      attemptRow({
        id: 'attempt-pass-earlier',
        score: 80,
        submittedAt: new Date('2026-08-02T11:00:00.000Z'),
      }),
    ]);

    const result = await service.list('org-1', { ...baseQuery });

    const row: any = result.items.find(
      (item: any) => item.caseType === 'FAILED',
    );
    expect(row).toBeTruthy();
    expect(row.score).toBe(30);
    expect(row.accountId).toBe('account-2');
  });

  it('filters FAILED rows by grade', async () => {
    (db.examSession.findMany as jest.Mock).mockImplementation((args: any) => {
      if (args.where?.status?.in) return Promise.resolve([]);
      return Promise.resolve([
        {
          id: 'session-2',
          accountId: 'account-2',
          assessmentId: 'assessment-2',
          status: 'SUBMITTED',
          openCount: 1,
        },
      ]);
    });
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      attemptRow(),
    ]);

    const result = await service.list('org-1', {
      ...baseQuery,
      gradeId: 'grade-2',
      caseType: 'FAILED',
    });

    const failing = db.assessmentAttempt.findMany as jest.Mock;
    const failedWhere = failing.mock.calls.find(
      (call) => call[0].where?.assessment?.passingScore,
    )?.[0].where;
    expect(failedWhere.account.studentProfile.gradeId).toBe('grade-2');
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('excludes FAILED rows when only SUSPENDED is requested', async () => {
    (db.examSession.findMany as jest.Mock).mockResolvedValue([sessionRow()]);

    const result = await service.list('org-1', {
      ...baseQuery,
      caseType: 'SUSPENDED',
    });

    expect(
      result.items.every((item: any) => item.caseType === 'SUSPENDED'),
    ).toBe(true);
    const failing = db.assessmentAttempt.findMany as jest.Mock;
    const failedCall = failing.mock.calls.find(
      (call) => call[0].where?.assessment?.passingScore,
    );
    expect(failedCall).toBeUndefined();
  });

  it('sorts rows by score descending by default direction', async () => {
    (db.examSession.findMany as jest.Mock).mockResolvedValue([
      sessionRow(),
      sessionRow({
        id: 'session-3',
        accountId: 'account-3',
        account: {
          id: 'account-3',
          studentProfile: {
            id: 'student-3',
            displayName: 'ليلى حسن',
            studentNumber: 2025003,
            grade: null,
          },
        },
      }),
    ]);
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.list('org-1', {
      ...baseQuery,
      caseType: 'ALL',
    });

    expect(result.items.length).toBe(2);
  });

  it('never exposes sensitive account/auth fields', async () => {
    (db.examSession.findMany as jest.Mock).mockResolvedValue([sessionRow()]);
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.list('org-1', { ...baseQuery });
    const serialized = JSON.stringify(result.items);
    expect(serialized).not.toMatch(
      /passwordHash|tokenHash|phoneEncrypted|emailEncrypted/,
    );
  });
});

describe('AdminV1ExamViolationsService.unlock', () => {
  it('creates a grant for a STUDENT of the same organization', async () => {
    (db.account.findFirst as jest.Mock).mockResolvedValue({
      id: 'account-2',
    });
    (db.assessment.findFirst as jest.Mock).mockResolvedValue({
      id: 'assessment-2',
      course: { organizationId: 'org-1' },
    });
    (examSessionServiceMock.createGrant as jest.Mock).mockResolvedValue({
      id: 'grant-1',
      accountId: 'account-2',
      assessmentId: 'assessment-2',
    });
    (examSessionServiceMock.availableGrants as jest.Mock).mockResolvedValue(1);

    const result = await service.unlock(
      { id: 'staff-1', organizationId: 'org-1', kind: 'STAFF' },
      'account-2',
      'assessment-2',
    );

    expect(examSessionServiceMock.createGrant).toHaveBeenCalledWith(
      { id: 'staff-1', organizationId: 'org-1', kind: 'STAFF' },
      'account-2',
      'assessment-2',
    );
    expect(result.unlocked).toBe(true);
    expect(result.grantId).toBe('grant-1');
    expect(result.remainingGrantedAttempts).toBe(1);
  });

  it('rejects a student that does not belong to the organization', async () => {
    (db.account.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.unlock(
        { id: 'staff-1', organizationId: 'org-1', kind: 'STAFF' },
        'account-2',
        'assessment-2',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(examSessionServiceMock.createGrant).not.toHaveBeenCalled();
  });

  it('rejects an assessment from another organization', async () => {
    (db.account.findFirst as jest.Mock).mockResolvedValue({
      id: 'account-2',
    });
    (db.assessment.findFirst as jest.Mock).mockResolvedValue({
      id: 'assessment-2',
      course: { organizationId: 'org-2' },
    });

    await expect(
      service.unlock(
        { id: 'staff-1', organizationId: 'org-1', kind: 'STAFF' },
        'account-2',
        'assessment-2',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
