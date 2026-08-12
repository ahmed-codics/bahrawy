import { Injectable, NotFoundException } from '@nestjs/common';
import { db, Prisma, type ExamSessionStatus } from '@bahrawy/db';
import {
  ExamSessionService,
  lockMessage,
} from '../../exam-session/exam-session.service';
import {
  EXAM_SESSION_STATUSES,
  EXAM_VIOLATION_CASE_TYPES,
} from './exam-violations.dto';

export type ExamViolationsQuery = {
  search?: string;
  gradeId?: string;
  courseId?: string;
  assessmentId?: string;
  status?: ExamSessionStatus;
  caseType?: (typeof EXAM_VIOLATION_CASE_TYPES)[number];
  sortBy?: 'lastAttemptAt' | 'score' | 'attemptsCount' | 'openCount';
  direction?: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;
const MAX_FETCH_ROWS = 2000;

const studentNumberFromSearch = (search: string): number | null => {
  const trimmed = search.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const SAFE_STATUSES = new Set<ExamSessionStatus>(EXAM_SESSION_STATUSES);

const FAILED_REASON = (score: number, passingScore: number) =>
  `فشل في الاختبار — الدرجة ${score}/${passingScore} — درجة النجاح ${passingScore}.`;

@Injectable()
export class AdminV1ExamViolationsService {
  constructor(private readonly examSessionService: ExamSessionService) {}

  async list(
    organizationId: string,
    query: ExamViolationsQuery,
  ): Promise<{
    items: unknown[];
    meta: { page: number; pageSize: number; total: number; pageCount: number };
    caseTypes: { caseType: string; label: string }[];
    statuses: { status: ExamSessionStatus; label: string }[];
    courses: { id: string; titleAr: string }[];
    exams: { id: string; titleAr: string }[];
    grades: { id: string; nameAr: string }[];
  }> {
    const page = Math.max(query.page, 1);
    const pageSize = Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE);
    const search = (query.search ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
    const studentNumber =
      search.length > 0 ? studentNumberFromSearch(search) : null;
    const status =
      query.status && SAFE_STATUSES.has(query.status)
        ? query.status
        : undefined;
    const includeSuspended =
      query.caseType === undefined ||
      query.caseType === 'ALL' ||
      query.caseType === 'SUSPENDED';
    const includeFailed =
      query.caseType === undefined ||
      query.caseType === 'ALL' ||
      query.caseType === 'FAILED';

    const accountWhere: Prisma.AccountWhereInput = {
      kind: 'STUDENT',
      deletedAt: null,
      organizationId,
      ...(query.gradeId ? { studentProfile: { gradeId: query.gradeId } } : {}),
      ...(search
        ? {
            OR: [
              {
                studentProfile: {
                  displayName: { contains: search, mode: 'insensitive' },
                },
              },
              ...(studentNumber !== null
                ? [{ studentProfile: { studentNumber } }]
                : []),
            ],
          }
        : {}),
    };

    const assessmentWhere: Prisma.AssessmentWhereInput = {
      archivedAt: null,
      ...(query.courseId ? { courseId: query.courseId } : {}),
    };

    const [suspendedRows, failedRows, courses, exams, statuses, grades] =
      await Promise.all([
        includeSuspended
          ? this.fetchSuspended(
              organizationId,
              accountWhere,
              assessmentWhere,
              query,
              status,
            )
          : Promise.resolve([]),
        includeFailed
          ? this.fetchFailed(
              organizationId,
              accountWhere,
              assessmentWhere,
              query,
            )
          : Promise.resolve([]),
        db.course.findMany({
          where: { organizationId, archivedAt: null },
          select: { id: true, titleAr: true },
          orderBy: { titleAr: 'asc' },
        }),
        this.fetchExamOptions(organizationId, accountWhere),
        Promise.resolve(
          EXAM_SESSION_STATUSES.map((status: ExamSessionStatus) => ({
            status,
            label: status,
          })),
        ),
        db.grade.findMany({
          where: { organizationId, archivedAt: null },
          select: { id: true, nameAr: true },
          orderBy: { nameAr: 'asc' },
        }),
      ]);

    const merged = [...suspendedRows, ...failedRows];
    const sorted = this.sortRows(merged, query.sortBy, query.direction);
    const total = sorted.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const items = sorted.slice((page - 1) * pageSize, page * pageSize);

    return {
      items,
      meta: { page, pageSize, total, pageCount },
      caseTypes: [
        { caseType: 'ALL', label: 'الكل' },
        { caseType: 'SUSPENDED', label: 'موقوفون' },
        { caseType: 'FAILED', label: 'راسبون' },
      ],
      statuses,
      courses,
      exams,
      grades,
    };
  }

  private async fetchSuspended(
    organizationId: string,
    accountWhere: Prisma.AccountWhereInput,
    assessmentWhere: Prisma.AssessmentWhereInput,
    query: ExamViolationsQuery,
    status: ExamSessionStatus | undefined,
  ): Promise<any[]> {
    const where: Prisma.ExamSessionWhereInput = {
      account: accountWhere,
      assessment: assessmentWhere,
      ...(query.assessmentId ? { assessmentId: query.assessmentId } : {}),
      ...(status ? { status } : {}),
    };

    const suspendedStatuses = status
      ? [status]
      : (['LOCKED', 'EXPIRED'] as ExamSessionStatus[]);
    const rows = await db.examSession.findMany({
      where: {
        ...where,
        status: { in: suspendedStatuses },
      },
      orderBy: [
        { lockedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: MAX_FETCH_ROWS,
      select: {
        id: true,
        accountId: true,
        assessmentId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        lastActivityAt: true,
        endedAt: true,
        lockedAt: true,
        lockReason: true,
        violationCount: true,
        reopenedAt: true,
        reopenedBy: true,
        openCount: true,
        attemptCount: true,
        account: {
          select: {
            id: true,
            studentProfile: {
              select: {
                id: true,
                displayName: true,
                studentNumber: true,
                grade: { select: { id: true, nameAr: true } },
              },
            },
          },
        },
        assessment: {
          select: {
            id: true,
            titleAr: true,
            passingScore: true,
            lesson: { select: { id: true, titleAr: true } },
            course: {
              select: { id: true, titleAr: true },
            },
          },
        },
      },
    });
    const attempts = await this.attemptSummaries(rows.map((row) => row.id));
    return rows.map((item) => {
      const profile = item.account.studentProfile;
      const attemptsFor = attempts.get(
        `${item.account.id}:${item.assessmentId}`,
      ) ?? { submittedCount: 0, lastSubmittedAt: null, scores: [] };
      return {
        caseType: 'SUSPENDED',
        reason: lockMessage(item.lockReason),
        sessionId: item.id,
        accountId: item.account.id,
        assessmentId: item.assessmentId,
        status: item.status,
        student: profile
          ? {
              id: profile.id,
              name: profile.displayName,
              code: profile.studentNumber,
            }
          : null,
        grade: profile?.grade ?? null,
        course: item.assessment.course,
        lesson: item.assessment.lesson ?? null,
        exam: { id: item.assessment.id, titleAr: item.assessment.titleAr },
        score: attemptsFor.scores[0] ?? null,
        passingScore: item.assessment.passingScore,
        attemptsCount: attemptsFor.submittedCount,
        openCount: item.openCount,
        lastAttemptAt:
          attemptsFor.lastSubmittedAt ?? item.lastActivityAt ?? item.startedAt,
        startedAt: item.startedAt,
        expiresAt: item.expiresAt,
        lastActivityAt: item.lastActivityAt,
        endedAt: item.endedAt,
        lockedAt: item.lockedAt,
        lockReason: item.lockReason,
        violationCount: item.violationCount,
        reopenedAt: item.reopenedAt,
        reopenedBy: item.reopenedBy,
        attemptCount: item.attemptCount,
      };
    });
  }

  private async fetchFailed(
    organizationId: string,
    accountWhere: Prisma.AccountWhereInput,
    assessmentWhere: Prisma.AssessmentWhereInput,
    query: ExamViolationsQuery,
  ): Promise<any[]> {
    const attempts = await db.assessmentAttempt.findMany({
      where: {
        account: accountWhere,
        assessment: {
          ...assessmentWhere,
          ...(query.assessmentId ? { id: query.assessmentId } : {}),
          passingScore: { not: null },
        },
        submittedAt: { not: null },
        score: { not: null },
      },
      orderBy: { submittedAt: 'desc' },
      take: MAX_FETCH_ROWS,
      select: {
        id: true,
        accountId: true,
        assessmentId: true,
        score: true,
        submittedAt: true,
        examSessionId: true,
        account: {
          select: {
            studentProfile: {
              select: {
                id: true,
                displayName: true,
                studentNumber: true,
                grade: { select: { id: true, nameAr: true } },
              },
            },
          },
        },
        assessment: {
          select: {
            id: true,
            titleAr: true,
            passingScore: true,
            lesson: { select: { id: true, titleAr: true } },
            course: {
              select: { id: true, titleAr: true },
            },
          },
        },
      },
    });
    if (attempts.length === 0) return [];

    // Only keep attempts that actually failed (score < passingScore), and keep
    // one row per (account, assessment) representing the LATEST failed attempt.
    const sessions = await db.examSession.findMany({
      where: {
        accountId: { in: [...new Set(attempts.map((a) => a.accountId))] },
        assessmentId: { in: [...new Set(attempts.map((a) => a.assessmentId))] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        accountId: true,
        assessmentId: true,
        status: true,
        openCount: true,
      },
    });
    const latestSession = new Map<string, any>();
    for (const s of sessions) {
      const key = `${s.accountId}:${s.assessmentId}`;
      if (!latestSession.has(key)) latestSession.set(key, s);
    }

    const counts = new Map<string, number>();
    const latestAt = new Map<string, Date | null>();
    for (const a of attempts) {
      const key = `${a.accountId}:${a.assessmentId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const prev = latestAt.get(key);
      if (!prev || (a.submittedAt && a.submittedAt > prev)) {
        latestAt.set(key, a.submittedAt);
      }
    }

    const rows: any[] = [];
    const seen = new Set<string>();
    for (const a of attempts) {
      // `attempts` is ordered by submittedAt DESC, so the first attempt we see
      // for a key is that student's LATEST attempt on the assessment. We resolve
      // the FAILED state from that latest attempt only: if the student later
      // PASSED (their most recent attempt met the passing score) they are no
      // longer in a failed state and must drop off this list — even though an
      // older failed attempt still exists in history.
      const key = `${a.accountId}:${a.assessmentId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const passing = a.assessment.passingScore;
      const score = a.score === null ? null : Number(a.score);
      if (passing === null || score === null || score >= passing) continue;
      const profile = a.account.studentProfile;
      const session = latestSession.get(key);
      rows.push({
        caseType: 'FAILED',
        reason: FAILED_REASON(score, passing),
        sessionId: null,
        accountId: a.accountId,
        assessmentId: a.assessmentId,
        status: session?.status ?? null,
        student: profile
          ? {
              id: profile.id,
              name: profile.displayName,
              code: profile.studentNumber,
            }
          : null,
        grade: profile?.grade ?? null,
        course: a.assessment.course,
        lesson: a.assessment.lesson ?? null,
        exam: { id: a.assessment.id, titleAr: a.assessment.titleAr },
        score,
        passingScore: passing,
        attemptsCount: counts.get(key) ?? 0,
        openCount: session?.openCount ?? 0,
        lastAttemptAt: latestAt.get(key) ?? a.submittedAt,
        startedAt: null,
        expiresAt: null,
        lastActivityAt: a.submittedAt,
        endedAt: null,
        lockedAt: null,
        lockReason: null,
        violationCount: 0,
        reopenedAt: null,
        reopenedBy: null,
        attemptCount: counts.get(key) ?? 0,
      });
    }
    return rows;
  }

  private async attemptSummaries(
    sessionIds: string[],
  ): Promise<Map<string, any>> {
    if (sessionIds.length === 0) return new Map();
    const attempts = await db.assessmentAttempt.findMany({
      where: {
        examSessionId: { in: sessionIds },
        submittedAt: { not: null },
        score: { not: null },
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        examSessionId: true,
        accountId: true,
        assessmentId: true,
        score: true,
        submittedAt: true,
      },
    });
    const map = new Map<string, any>();
    for (const a of attempts) {
      const key = `${a.accountId}:${a.assessmentId}`;
      const entry = map.get(key) ?? {
        submittedCount: 0,
        lastSubmittedAt: null,
        scores: [] as number[],
      };
      entry.submittedCount += 1;
      entry.scores.push(Number(a.score));
      if (
        !entry.lastSubmittedAt ||
        (a.submittedAt && a.submittedAt > entry.lastSubmittedAt)
      ) {
        entry.lastSubmittedAt = a.submittedAt;
      }
      map.set(key, entry);
    }
    return map;
  }

  private sortRows(
    rows: any[],
    sortBy: ExamViolationsQuery['sortBy'],
    direction: ExamViolationsQuery['direction'] = 'desc',
  ): any[] {
    const dir = direction === 'asc' ? 1 : -1;
    const getVal = (row: any): number | Date | null => {
      switch (sortBy) {
        case 'score':
          return row.score ?? null;
        case 'attemptsCount':
          return row.attemptsCount ?? 0;
        case 'openCount':
          return row.openCount ?? 0;
        case 'lastAttemptAt':
        default:
          return row.lastAttemptAt ?? null;
      }
    };
    return [...rows].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return cmp * dir;
    });
  }

  private async fetchExamOptions(
    organizationId: string,
    accountWhere: Prisma.AccountWhereInput,
  ) {
    return db.examSession
      .findMany({
        where: {
          account: accountWhere,
          assessment: { archivedAt: null },
        },
        select: {
          assessmentId: true,
          assessment: {
            select: { id: true, titleAr: true },
          },
        },
        distinct: ['assessmentId'],
      })
      .then((rows) => rows.map((row) => row.assessment));
  }

  reopen(
    actor: { id: string; organizationId: string; kind: string },
    sessionId: string,
  ) {
    return this.examSessionService.reopen(actor, sessionId);
  }

  events(organizationId: string, sessionId: string) {
    return this.examSessionService.listEvents(organizationId, sessionId);
  }

  async unlock(
    actor: { id: string; organizationId: string; kind: string },
    accountId: string,
    assessmentId: string,
  ) {
    const account = await db.account.findFirst({
      where: {
        id: accountId,
        kind: 'STUDENT',
        deletedAt: null,
        organizationId: actor.organizationId,
      },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException('Student not found');
    }
    const assessment = await db.assessment.findFirst({
      where: { id: assessmentId, archivedAt: null },
      select: { id: true, course: { select: { organizationId: true } } },
    });
    if (
      !assessment ||
      assessment.course.organizationId !== actor.organizationId
    ) {
      throw new NotFoundException('Assessment not found');
    }
    const grant = await this.examSessionService.createGrant(
      actor,
      accountId,
      assessmentId,
    );
    const remainingGrantedAttempts =
      await this.examSessionService.availableGrants(accountId, assessmentId);
    return {
      grantId: grant.id,
      accountId,
      assessmentId,
      remainingGrantedAttempts,
      unlocked: true,
    };
  }
}
