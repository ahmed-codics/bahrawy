import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '@bahrawy/db';
import { CatalogService } from '../../catalog/catalog.service';

export type LessonStatus =
  | 'LOCKED'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'QUIZ_PENDING'
  | 'FAILED'
  | 'PASSED';

type Gate = {
  requiredAssessmentId: string;
  requiredScore: number | null;
  lessonId: string;
};

type QuizState = {
  assessmentId: string | null;
  requiredScore: number | null;
  lastScore: number | null;
  passed: boolean;
} | null;

@Injectable()
export class AdminV1StudentProgressService {
  constructor(private readonly catalogService: CatalogService) {}

  async progress(organizationId: string, accountId: string) {
    const account = await db.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        kind: true,
        deletedAt: true,
        organizationId: true,
        studentProfile: {
          select: {
            displayName: true,
            studentNumber: true,
            grade: { select: { id: true, nameAr: true } },
          },
        },
      },
    });
    if (
      !account ||
      account.kind !== 'STUDENT' ||
      account.deletedAt !== null ||
      account.organizationId !== organizationId
    ) {
      throw new NotFoundException('Student not found');
    }

    const courses = await db.course.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        titleAr: true,
        chapters: {
          where: { status: 'PUBLISHED' },
          orderBy: { sort: 'asc' },
          select: {
            id: true,
            titleAr: true,
            units: {
              where: { status: 'PUBLISHED' },
              orderBy: { sort: 'asc' },
              select: {
                id: true,
                titleAr: true,
                lessons: {
                  where: { status: 'PUBLISHED' },
                  orderBy: { sort: 'asc' },
                  select: {
                    id: true,
                    titleAr: true,
                    contentType: true,
                    durationSeconds: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const lessonIds = courses.flatMap((course: any) =>
      course.chapters.flatMap((chapter: any) =>
        chapter.units.flatMap((unit: any) =>
          unit.lessons.map((lesson: any) => lesson.id),
        ),
      ),
    );

    const [progressRows, gates] = await Promise.all([
      lessonIds.length
        ? db.lessonProgress.findMany({
            where: { accountId, lessonId: { in: lessonIds } },
          })
        : Promise.resolve([]),
      lessonIds.length
        ? db.assessment.findMany({
            where: {
              lessonId: { in: lessonIds },
              status: 'PUBLISHED',
              archivedAt: null,
              passingScore: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, lessonId: true, passingScore: true },
          })
        : Promise.resolve([]),
    ]);

    const progressByLesson = new Map<string, any>(
      progressRows.map((row: any) => [row.lessonId, row]),
    );
    const gateByLesson = new Map<string, any>();
    for (const gate of gates) {
      if (gate.lessonId) gateByLesson.set(gate.lessonId, gate);
    }
    const gateIds = [...new Set(gates.map((gate: any) => gate.id))];
    const attempts = gateIds.length
      ? await db.assessmentAttempt.findMany({
          where: {
            accountId,
            assessmentId: { in: gateIds },
            submittedAt: { not: null },
          },
          orderBy: { submittedAt: 'desc' },
          select: { assessmentId: true, score: true },
        })
      : [];
    const bestByGate = new Map<string, number>();
    for (const attempt of attempts) {
      const score = attempt.score === null ? -1 : Number(attempt.score);
      const current = bestByGate.get(attempt.assessmentId) ?? -1;
      if (score > current) bestByGate.set(attempt.assessmentId, score);
    }

    const lockByLesson = new Map<string, Gate>();
    for (const course of courses) {
      const locks = await this.catalogService.computeLessonLocks(
        accountId,
        course.id,
      );
      for (const [lessonId, lock] of locks) {
        if (lock?.locked) {
          lockByLesson.set(lessonId, {
            requiredAssessmentId: lock.requiredAssessmentId,
            requiredScore: lock.requiredScore ?? null,
            lessonId,
          });
        }
      }
    }

    const summary = {
      totalLessons: 0,
      notStarted: 0,
      inProgress: 0,
      quizPending: 0,
      failed: 0,
      passed: 0,
      locked: 0,
    };
    const summaryKey: Record<LessonStatus, keyof typeof summary> = {
      LOCKED: 'locked',
      NOT_STARTED: 'notStarted',
      IN_PROGRESS: 'inProgress',
      QUIZ_PENDING: 'quizPending',
      FAILED: 'failed',
      PASSED: 'passed',
    };

    const mappedCourses = courses.map((course: any) => ({
      ...course,
      chapters: course.chapters.map((chapter: any) => ({
        ...chapter,
        units: chapter.units.map((unit: any) => ({
          ...unit,
          lessons: unit.lessons.map((lesson: any) => {
            const lessonStatus = this.buildLessonStatus(
              lesson.id,
              progressByLesson,
              gateByLesson,
              bestByGate,
              lockByLesson,
            );
            summary.totalLessons += 1;
            summary[summaryKey[lessonStatus]] += 1;
            const progress = progressByLesson.get(lesson.id);
            const gate = gateByLesson.get(lesson.id);
            return {
              id: lesson.id,
              titleAr: lesson.titleAr,
              contentType: lesson.contentType,
              durationSeconds: lesson.durationSeconds,
              status: lessonStatus,
              watchedSeconds: progress?.watchedSeconds ?? 0,
              completedAt: progress?.completedAt ?? null,
              quiz: this.buildQuizState(lesson.id, gate, bestByGate),
              gate: lockByLesson.get(lesson.id) ?? null,
            };
          }),
        })),
      })),
    }));

    return {
      student: {
        id: account.id,
        displayName: account.studentProfile?.displayName ?? null,
        studentNumber: account.studentProfile?.studentNumber ?? null,
        grade: account.studentProfile?.grade ?? null,
      },
      courses: mappedCourses,
      summary,
    };
  }

  private buildLessonStatus(
    lessonId: string,
    progressByLesson: Map<string, any>,
    gateByLesson: Map<string, any>,
    bestByGate: Map<string, number>,
    lockByLesson: Map<string, Gate>,
  ): LessonStatus {
    if (lockByLesson.has(lessonId)) return 'LOCKED';
    const gate = gateByLesson.get(lessonId);
    if (gate) {
      const best = bestByGate.get(gate.id) ?? -1;
      if (best >= 0) {
        return best >= Number(gate.passingScore) ? 'PASSED' : 'FAILED';
      }
    }
    const progress = progressByLesson.get(lessonId);
    if (!progress) return 'NOT_STARTED';
    if (!progress.completedAt) return 'IN_PROGRESS';
    return gate ? 'QUIZ_PENDING' : 'PASSED';
  }

  private buildQuizState(
    lessonId: string,
    gate: any,
    bestByGate: Map<string, number>,
  ): QuizState {
    if (!gate) return null;
    const best = bestByGate.get(gate.id) ?? -1;
    const hasScore = best >= 0;
    return {
      assessmentId: gate.id,
      requiredScore: gate.passingScore,
      lastScore: hasScore ? best : null,
      passed: hasScore && best >= Number(gate.passingScore),
    };
  }
}
