import { Injectable } from '@nestjs/common';
import { db, Prisma } from '@bahrawy/db';

export type ExamResultsQuery = {
  search?: string;
  gradeId?: string;
  assessmentId?: string;
  page: number;
  pageSize: number;
};

type SummaryAggregate = {
  examined: number;
  highest: number;
  average: number;
  passed: number;
};

const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

const studentNumberFromSearch = (search: string): number | null => {
  const trimmed = search.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

@Injectable()
export class AdminV1ExamResultsService {
  async list(
    organizationId: string,
    query: ExamResultsQuery,
  ): Promise<{
    items: unknown[];
    meta: { page: number; pageSize: number; total: number; pageCount: number };
    summary: SummaryAggregate;
    grades: { id: string; nameAr: string }[];
    exams: {
      id: string;
      titleAr: string;
      course: { titleAr: string } | null;
    }[];
  }> {
    const page = Math.max(query.page, 1);
    const pageSize = Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE);
    const search = (query.search ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
    const studentNumber =
      search.length > 0 ? studentNumberFromSearch(search) : null;

    const attemptWhere: Prisma.AssessmentAttemptWhereInput = {
      submittedAt: { not: null },
      ...(query.assessmentId
        ? { assessmentId: query.assessmentId }
        : undefined),
      account: {
        kind: 'STUDENT',
        deletedAt: null,
        organizationId,
        ...(query.gradeId
          ? { studentProfile: { gradeId: query.gradeId } }
          : {}),
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
      },
    };

    const [total, items, summary, grades, exams] = await Promise.all([
      db.assessmentAttempt.count({ where: attemptWhere }),
      db.assessmentAttempt.findMany({
        where: attemptWhere,
        orderBy: [
          { score: 'desc' },
          { submittedAt: 'asc' },
          { accountId: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          score: true,
          submittedAt: true,
          resultsReleased: true,
          account: {
            select: {
              id: true,
              studentProfile: {
                select: {
                  id: true,
                  displayName: true,
                  studentNumber: true,
                  grade: {
                    select: { id: true, nameAr: true },
                  },
                },
              },
            },
          },
          assessment: {
            select: {
              id: true,
              titleAr: true,
              passingScore: true,
              course: {
                select: { id: true, titleAr: true },
              },
              questions: {
                select: {
                  question: { select: { points: true } },
                },
              },
            },
          },
        },
      }),
      this.computeSummary(organizationId, query, studentNumber),
      db.grade.findMany({
        where: { organizationId, archivedAt: null },
        select: { id: true, nameAr: true },
        orderBy: { sort: 'asc' },
      }),
      db.assessment.findMany({
        where: {
          course: { organizationId },
          archivedAt: null,
          attempts: {
            some: {
              submittedAt: { not: null },
              account: { kind: 'STUDENT', deletedAt: null, organizationId },
            },
          },
        },
        select: {
          id: true,
          titleAr: true,
          course: { select: { titleAr: true } },
        },
        orderBy: { titleAr: 'asc' },
      }),
    ]);

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const rankOffset = (page - 1) * pageSize;

    return {
      items: items.map((item, index) => {
        const score = item.score === null ? 0 : Number(item.score);
        const totalPoints = item.assessment.questions.reduce(
          (sum, entry) => sum + entry.question.points,
          0,
        );
        const earnedPoints =
          totalPoints > 0 ? Math.round((score / 100) * totalPoints) : 0;
        const profile = item.account.studentProfile;
        const passed =
          item.assessment.passingScore === null || item.score === null
            ? null
            : score >= item.assessment.passingScore;
        return {
          rank: rankOffset + index + 1,
          attemptId: item.id,
          student: profile
            ? {
                id: profile.id,
                name: profile.displayName,
                code: profile.studentNumber,
              }
            : null,
          grade: profile?.grade ?? null,
          exam: {
            id: item.assessment.id,
            titleAr: item.assessment.titleAr,
            course: item.assessment.course,
          },
          score: roundedTwo(score),
          earnedPoints,
          totalPoints,
          percentage: roundedTwo(score),
          passed,
          submittedAt: item.submittedAt,
          resultsReleased: item.resultsReleased,
        };
      }),
      meta: { page, pageSize, total, pageCount },
      summary,
      grades,
      exams,
    };
  }

  private async computeSummary(
    organizationId: string,
    query: ExamResultsQuery,
    studentNumber: number | null,
  ): Promise<SummaryAggregate> {
    const search = (query.search ?? '').trim();
    const sql = Prisma.sql`
      SELECT
        COUNT(DISTINCT aa."accountId")::int AS examined,
        COALESCE(MAX(aa."score")::float8, 0) AS highest,
        COALESCE(AVG(aa."score")::float8, 0) AS average,
        COUNT(DISTINCT aa."accountId") FILTER (
          WHERE a."passingScore" IS NOT NULL
            AND aa."score" IS NOT NULL
            AND aa."score" >= a."passingScore"
        )::int AS passed
      FROM "AssessmentAttempt" aa
      JOIN "Assessment" a ON a.id = aa."assessmentId"
      JOIN "Course" c ON c.id = a."courseId"
      JOIN "Account" acc ON acc.id = aa."accountId"
      LEFT JOIN "StudentProfile" sp ON sp."accountId" = acc.id
      WHERE aa."submittedAt" IS NOT NULL
        AND c."organizationId" = ${organizationId}
        AND acc."kind" = 'STUDENT'
        AND acc."deletedAt" IS NULL
        ${
          query.gradeId
            ? Prisma.sql`AND sp."gradeId" = ${query.gradeId}`
            : Prisma.empty
        }
        ${
          query.assessmentId
            ? Prisma.sql`AND aa."assessmentId" = ${query.assessmentId}`
            : Prisma.empty
        }
        ${
          search
            ? Prisma.sql`AND (
                sp."displayName" ILIKE ${'%' + search + '%'}${
                  studentNumber !== null
                    ? Prisma.sql` OR sp."studentNumber" = ${studentNumber}`
                    : Prisma.empty
                }
              )`
            : Prisma.empty
        }
    `;
    const [row] = await db.$queryRaw<SummaryAggregate[]>(sql);
    return {
      examined: row.examined,
      highest: roundedTwo(row.highest),
      average: roundedTwo(row.average),
      passed: row.passed,
    };
  }
}

const roundedTwo = (value: number): number => Math.round(value * 100) / 100;
