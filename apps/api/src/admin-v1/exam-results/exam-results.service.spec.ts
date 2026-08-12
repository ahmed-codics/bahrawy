import { AdminV1ExamResultsService } from './exam-results.service';

jest.mock('@bahrawy/db', () => {
  const { Prisma } = jest.requireActual('@prisma/client');
  return {
    db: {
      assessmentAttempt: { count: jest.fn(), findMany: jest.fn() },
      grade: { findMany: jest.fn() },
      assessment: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    },
    Prisma,
  };
});

import { db } from '@bahrawy/db';

const service = new AdminV1ExamResultsService();

const attemptRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'attempt-1',
  score: '90.00',
  submittedAt: new Date('2026-08-01T10:00:00.000Z'),
  resultsReleased: true,
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
    titleAr: 'امتحان الفصل الأول',
    passingScore: 50,
    course: { id: 'course-1', titleAr: 'كورس الرياضيات' },
    questions: [{ question: { points: 10 } }, { question: { points: 10 } }],
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);
  (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
    attemptRow(),
  ]);
  (db.grade.findMany as jest.Mock).mockResolvedValue([
    { id: 'grade-1', nameAr: 'الصف الأول الثانوي' },
  ]);
  (db.assessment.findMany as jest.Mock).mockResolvedValue([
    { id: 'assessment-1', titleAr: 'امتحان الفصل الأول', course: null },
  ]);
  (db.$queryRaw as jest.Mock).mockResolvedValue([
    { examined: 1, highest: 90, average: 90, passed: 1 },
  ]);
});

describe('AdminV1ExamResultsService', () => {
  it('sorts results highest score first with deterministic tie-breakers', async () => {
    await service.list('org-1', {
      page: 1,
      pageSize: 25,
    });
    expect(
      (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0].orderBy,
    ).toEqual([
      { score: 'desc' },
      { submittedAt: 'asc' },
      { accountId: 'asc' },
    ]);
  });

  it('only queries submitted attempts and student accounts of the session organization', async () => {
    await service.list('org-1', { page: 1, pageSize: 25 });
    const where = (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.submittedAt).toEqual({ not: null });
    expect(where.account).toMatchObject({
      kind: 'STUDENT',
      organizationId: 'org-1',
      deletedAt: null,
    });

    const sql = (db.$queryRaw as jest.Mock).mock.calls[0][0];
    expect(sql).toBeDefined();
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('applies the grade filter from the database gradeIds', async () => {
    await service.list('org-1', { page: 1, pageSize: 25, gradeId: 'grade-2' });
    const where = (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.account.studentProfile).toEqual({ gradeId: 'grade-2' });
  });

  it('applies the exam filter', async () => {
    await service.list('org-1', {
      page: 1,
      pageSize: 25,
      assessmentId: 'assessment-9',
    });
    const where = (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.assessmentId).toBe('assessment-9');
  });

  it('searches by student display name', async () => {
    await service.list('org-1', { page: 1, pageSize: 25, search: 'سارة' });
    const where = (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.account.OR).toHaveLength(1);
    expect(where.account.OR[0].studentProfile.displayName).toEqual({
      contains: 'سارة',
      mode: 'insensitive',
    });
  });

  it('searches by numeric student code', async () => {
    await service.list('org-1', { page: 1, pageSize: 25, search: '2025001' });
    const where = (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(where.account.OR).toHaveLength(2);
    expect(where.account.OR[1].studentProfile.studentNumber).toBe(2025001);
  });

  it('paginates server-side and computes global ranks across pages', async () => {
    (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(60);
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      attemptRow({ id: 'attempt-26' }),
    ]);

    const result = await service.list('org-1', { page: 2, pageSize: 25 });
    expect(
      (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0],
    ).toMatchObject({
      skip: 25,
      take: 25,
    });
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 25,
      total: 60,
      pageCount: 3,
    });
    expect(result.items[0]).toMatchObject({ rank: 26 });
  });

  it('clamps pagination and search inputs', async () => {
    await service.list('org-1', {
      page: 0,
      pageSize: 500,
      search: 'x'.repeat(500),
    });
    expect(
      (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0],
    ).toMatchObject({
      skip: 0,
      take: 100,
    });
    const where = (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(
      where.account.OR[0].studentProfile.displayName.contains,
    ).toHaveLength(100);
  });

  it('returns summary (examined, highest, average, passed) from the aggregate query', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { examined: 4, highest: 98.5, average: 72.3333, passed: 3 },
    ]);
    const result = await service.list('org-1', { page: 1, pageSize: 25 });
    expect(result.summary).toEqual({
      examined: 4,
      highest: 98.5,
      average: 72.33,
      passed: 3,
    });
  });

  it('computes score presentation from stored percentage and total points', async () => {
    const result = await service.list('org-1', { page: 1, pageSize: 25 });
    const item = result.items[0] as Record<string, unknown>;
    expect(item).toMatchObject({
      score: 90,
      percentage: 90,
      totalPoints: 20,
      earnedPoints: 18,
      passed: true,
    });
    expect(item.student).toEqual({
      id: 'student-1',
      name: 'سارة أحمد',
      code: 2025001,
    });
    expect(item.grade).toEqual({ id: 'grade-1', nameAr: 'الصف الأول الثانوي' });
  });

  it('scores an attempt as failed when below the passing score', async () => {
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      attemptRow({ score: '30.00' }),
    ]);
    const result = await service.list('org-1', { page: 1, pageSize: 25 });
    expect((result.items[0] as Record<string, unknown>).passed).toBe(false);
  });

  it('does not expose student account/session/answer-key fields', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { examined: 0, highest: 0, average: 0, passed: 0 },
    ]);
    const result = await service.list('org-1', { page: 1, pageSize: 25 });
    const raw = JSON.stringify(result);
    for (const forbidden of [
      'passwordHash',
      'authSessions',
      'tokenHash',
      'autosavedAnswers',
      'correctOptionId',
      'explanation',
      'emailEncrypted',
      'phoneEncrypted',
    ]) {
      expect(raw).not.toContain(forbidden);
    }

    const select = (db.assessmentAttempt.findMany as jest.Mock).mock.calls[0][0]
      .select;
    expect(select.account.select).not.toHaveProperty('passwordHash');
    expect(select.assessment.select).not.toHaveProperty(
      'questions.0.question.select.correctOptionId',
    );
  });

  it('returns grade and exam filter options from the database', async () => {
    const result = await service.list('org-1', { page: 1, pageSize: 25 });
    expect(result.grades).toEqual([
      { id: 'grade-1', nameAr: 'الصف الأول الثانوي' },
    ]);
    expect(result.exams).toEqual([
      { id: 'assessment-1', titleAr: 'امتحان الفصل الأول', course: null },
    ]);
  });

  it('does not trust a client-provided organization because the query is scoped by the session org', async () => {
    await service.list('org-9', { page: 1, pageSize: 25 });
    const findWhere = (db.assessmentAttempt.findMany as jest.Mock).mock
      .calls[0][0].where;
    expect(findWhere.account.organizationId).toBe('org-9');
    const gradeWhere = (db.grade.findMany as jest.Mock).mock.calls[0][0].where;
    expect(gradeWhere.organizationId).toBe('org-9');
    const examWhere = (db.assessment.findMany as jest.Mock).mock.calls[0][0]
      .where;
    expect(examWhere.course.organizationId).toBe('org-9');
  });
});
