import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { CatalogService } from '../catalog/catalog.service';

type VisibleQuestionOption = {
  id: string;
  text: string;
};

type AttemptQuestionEntry = Record<string, unknown> & {
  question: Record<string, unknown> & {
    options: unknown;
  };
};

function normalizeVisibleQuestionOptions(
  options: unknown,
): VisibleQuestionOption[] {
  if (Array.isArray(options)) {
    return options.flatMap((option, index) => {
      if (typeof option === 'string') {
        return [{ id: String(index + 1), text: option }];
      }
      if (!option || typeof option !== 'object') return [];

      const item = option as Record<string, unknown>;
      const text =
        item.text ?? item.textAr ?? item.titleAr ?? item.label ?? item.value;
      if (typeof text !== 'string') return [];

      return [
        {
          id: typeof item.id === 'string' ? item.id : String(index + 1),
          text,
        },
      ];
    });
  }

  if (options && typeof options === 'object') {
    return Object.entries(options as Record<string, unknown>).flatMap(
      ([id, text]) => (typeof text === 'string' ? [{ id, text }] : []),
    );
  }

  return [];
}

function buildAttemptOutcome(
  assessment: {
    passingScore: number | null;
    maxAttempts: number | null;
  },
  attempt: Record<string, any>,
  attemptsUsed: number,
) {
  const score = attempt.score === null ? null : Number(attempt.score);
  const passed =
    assessment.passingScore === null || score === null
      ? null
      : score >= assessment.passingScore;

  return {
    ...attempt,
    passingScore: assessment.passingScore,
    maxAttempts: assessment.maxAttempts,
    passed,
    attemptsUsed,
    attemptsRemaining:
      assessment.maxAttempts === null
        ? null
        : Math.max(0, assessment.maxAttempts - attemptsUsed),
  };
}

@Injectable()
export class AssessmentService {
  constructor(private readonly catalogService: CatalogService) {}

  async startAttempt(
    accountId: string,
    assessmentId: string,
    newAttempt = false,
  ): Promise<any> {
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      include: { course: true },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    if (assessment.status !== 'PUBLISHED') {
      throw new ForbiddenException('Assessment is not published');
    }
    const unitAccess = assessment.unitId
      ? await this.catalogService.getUnitAccess(accountId, assessment.unitId)
      : null;
    const hasAccess = unitAccess
      ? unitAccess.hasAccess
      : await this.catalogService.hasEntitlementToCourse(
          accountId,
          assessment.courseId,
        );
    if (!hasAccess) {
      const access = unitAccess;
      if (access?.reason === 'PREREQUISITE') {
        throw new ForbiddenException({
          code: 'LESSON_PREREQUISITE_NOT_MET',
          message: 'Complete the required homework or quiz first.',
          prerequisite: access.prerequisite,
        });
      }
      throw new ForbiddenException({
        code: 'MISSING_ENTITLEMENT',
        message: 'You are not enrolled in the course for this assessment.',
      });
    }
    const now = new Date();
    const activeAttempt = await db.assessmentAttempt.findFirst({
      where: {
        accountId,
        assessmentId,
        submittedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (activeAttempt) {
      return activeAttempt;
    }

    const submittedAttempts = await db.assessmentAttempt.findMany({
      where: {
        accountId,
        assessmentId,
        submittedAt: { not: null },
      },
      orderBy: { submittedAt: 'desc' },
    });
    const passedAttempt =
      assessment.passingScore === null
        ? null
        : submittedAttempts.find(
            (attempt: any) =>
              attempt.score !== null &&
              Number(attempt.score) >= assessment.passingScore!,
          );
    if (passedAttempt && !newAttempt) {
      return passedAttempt;
    }
    if (!newAttempt && submittedAttempts[0]) {
      return submittedAttempts[0];
    }
    if (
      assessment.maxAttempts !== null &&
      submittedAttempts.length >= assessment.maxAttempts
    ) {
      throw new ForbiddenException({
        code: 'ASSESSMENT_ATTEMPT_LIMIT_REACHED',
        message:
          'You have used all available attempts. Please contact customer service.',
        maxAttempts: assessment.maxAttempts,
        attemptsUsed: submittedAttempts.length,
      });
    }

    const startedAt = now;
    const expiresAt =
      assessment.durationMinutes > 0
        ? new Date(startedAt.getTime() + assessment.durationMinutes * 60 * 1000)
        : null;
    return db.assessmentAttempt.create({
      data: {
        assessmentId,
        accountId,
        startedAt,
        expiresAt,
        autosavedAnswers: {},
      },
    });
  }

  async autosaveAnswers(
    accountId: string,
    attemptId: string,
    answers: Record<string, string>,
  ): Promise<any> {
    const attempt = await db.assessmentAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt || attempt.accountId !== accountId) {
      throw new NotFoundException('Attempt not found');
    }
    if (attempt.submittedAt) {
      throw new BadRequestException({
        code: 'ATTEMPT_SUBMITTED',
        message: 'Cannot autosave answers for a submitted attempt.',
      });
    }
    if (attempt.expiresAt && new Date() > attempt.expiresAt) {
      throw new BadRequestException({
        code: 'ATTEMPT_EXPIRED',
        message: 'Assessment time limit has expired.',
      });
    }
    return db.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        autosavedAnswers: answers,
      },
    });
  }

  async submitAttempt(accountId: string, attemptId: string): Promise<any> {
    const attempt = await db.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          include: {
            questions: {
              include: { question: true },
            },
          },
        },
      },
    });
    if (!attempt || attempt.accountId !== accountId) {
      throw new NotFoundException('Attempt not found');
    }
    if (attempt.submittedAt) {
      const attemptsUsed = await db.assessmentAttempt.count({
        where: {
          accountId,
          assessmentId: attempt.assessmentId,
          submittedAt: { not: null },
        },
      });
      const outcome = buildAttemptOutcome(
        attempt.assessment,
        attempt as Record<string, any>,
        attemptsUsed,
      );
      return {
        ...outcome,
        assessment: {
          ...attempt.assessment,
          questions: attempt.assessment.questions.map(
            (entry: AttemptQuestionEntry) => ({
              ...entry,
              question: {
                ...entry.question,
                options: normalizeVisibleQuestionOptions(entry.question.options),
                correctOptionId: attempt.resultsReleased ? entry.question.correctOptionId : undefined,
                explanation: attempt.resultsReleased ? entry.question.explanation : undefined,
              },
            }),
          ),
        },
      };
    }
    let totalPoints = 0;
    let earnedPoints = 0;
    const answers = (attempt.autosavedAnswers as Record<string, string>) || {};
    for (const aq of attempt.assessment.questions) {
      totalPoints += aq.question.points;
      const studentAnswer = answers[aq.questionId];
      if (studentAnswer === aq.question.correctOptionId) {
        earnedPoints += aq.question.points;
      }
    }
    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const now = new Date();
    const resultsReleased =
      attempt.assessment.resultReleaseRule === 'IMMEDIATE';
    const submitted = await db.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: now,
        score,
        resultsReleased,
      },
    });
    const attemptsUsed = await db.assessmentAttempt.count({
      where: {
        accountId,
        assessmentId: attempt.assessmentId,
        submittedAt: { not: null },
      },
    });
    const outcome = buildAttemptOutcome(
      attempt.assessment,
      submitted as Record<string, any>,
      attemptsUsed,
    );
    return {
      ...outcome,
      assessment: {
        ...attempt.assessment,
        questions: attempt.assessment.questions.map(
          (entry: AttemptQuestionEntry) => ({
            ...entry,
            question: {
              ...entry.question,
              options: normalizeVisibleQuestionOptions(entry.question.options),
              correctOptionId: resultsReleased ? entry.question.correctOptionId : undefined,
              explanation: resultsReleased ? entry.question.explanation : undefined,
            },
          }),
        ),
      },
    };
  }

  async listAssessments(accountId: string, courseId: string): Promise<any[]> {
    const assessments = await db.assessment.findMany({
      where: { courseId, status: 'PUBLISHED' },
      include: {
        unit: {
          include: {
            prerequisiteAssessment: {
              select: { id: true, titleAr: true, type: true },
            },
          },
        },
        attempts: {
          where: {
            accountId,
            submittedAt: { not: null },
          },
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: {
            score: true,
            submittedAt: true,
            resultsReleased: true,
          },
        },
      },
    });
    return Promise.all(
      assessments.map(async (assessment: any) => {
        const access = assessment.unitId
          ? await this.catalogService.getUnitAccess(
              accountId,
              assessment.unitId,
            )
          : { hasAccess: true, reason: 'COURSE' };
        return {
          ...assessment,
          latestAttempt: assessment.attempts[0] ?? null,
          attempts: undefined,
          available: access.hasAccess,
          access,
        };
      }),
    );
  }

  async getCurrentAttempt(accountId: string, attemptId: string): Promise<any> {
    const attempt = await db.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          include: {
            questions: {
              include: {
                question: {
                  select: {
                    id: true,
                    titleAr: true,
                    options: true,
                    points: true,
                    correctOptionId: true,
                    explanation: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt || attempt.accountId !== accountId) {
      throw new NotFoundException('Attempt not found');
    }
    const attemptsUsed = await db.assessmentAttempt.count({
      where: {
        accountId,
        assessmentId: attempt.assessmentId,
        submittedAt: { not: null },
      },
    });
    const outcome = buildAttemptOutcome(
      attempt.assessment,
      attempt as Record<string, any>,
      attemptsUsed,
    );
    return {
      ...outcome,
      assessment: {
        ...attempt.assessment,
        questions: attempt.assessment.questions.map(
          (entry: AttemptQuestionEntry) => ({
            ...entry,
            question: {
              ...entry.question,
              options: normalizeVisibleQuestionOptions(entry.question.options),
              correctOptionId: attempt.resultsReleased ? entry.question.correctOptionId : undefined,
              explanation: attempt.resultsReleased ? entry.question.explanation : undefined,
            },
          }),
        ),
      },
    };
  }
}
