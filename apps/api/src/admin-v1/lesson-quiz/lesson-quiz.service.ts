import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { LessonQuizQuestionDto, UpsertLessonQuizDto } from './lesson-quiz.dto';
import { AdminAuditService } from '../common/services/audit.service';

type Actor = { id: string; organizationId: string };

const END_OF_LESSON = 'END_OF_LESSON';

@Injectable()
export class AdminV1LessonQuizService {
  constructor(private readonly audit: AdminAuditService) {}

  async get(organizationId: string, lessonId: string) {
    const lesson = await this.assertLesson(organizationId, lessonId);
    const gate = await db.assessment.findFirst({
      where: { lessonId, type: END_OF_LESSON },
      orderBy: { createdAt: 'desc' },
      include: {
        questions: {
          orderBy: { sort: 'asc' },
          include: { question: true },
        },
      },
    });
    if (!gate) {
      return { lessonId: lesson.id, enabled: false, assessmentId: null };
    }
    return {
      lessonId: lesson.id,
      enabled: gate.archivedAt === null,
      assessmentId: gate.id,
      titleAr: gate.titleAr,
      passingScore: gate.passingScore,
      status: gate.status,
      questions:
        gate.questions.map((entry: any) => ({
          questionId: entry.questionId,
          order: entry.sort,
          version: entry.question.version,
          titleAr: entry.question.titleAr,
          options: entry.question.options,
          correctOptionId: entry.question.correctOptionId,
          explanation: entry.question.explanation,
          points: entry.question.points,
        })) ?? [],
    };
  }

  async upsert(actor: Actor, lessonId: string, input: UpsertLessonQuizDto) {
    const lesson = await this.assertLesson(actor.organizationId, lessonId);
    if (!input.enabled) {
      const existing = await db.assessment.findFirst({
        where: { lessonId, type: END_OF_LESSON, archivedAt: null },
      });
      if (existing) {
        await db.assessment.update({
          where: { id: existing.id },
          data: { archivedAt: new Date(), status: 'DRAFT' },
        });
        await this.audit.logEvent({
          organizationId: actor.organizationId,
          actorType: 'STAFF',
          actorId: actor.id,
          action: 'LESSON_QUIZ_DISABLED',
          targetType: 'ASSESSMENT',
          targetId: existing.id,
          after: { lessonId },
        });
      }
      return { lessonId: lesson.id, enabled: false, assessmentId: null };
    }

    if (!input.questions || input.questions.length === 0) {
      throw new BadRequestException('Quiz must have at least one question');
    }

    const totalPoints = input.questions.reduce(
      (sum, question) => sum + (question.points ?? 1),
      0,
    );
    const passing = input.passingScore ?? 0;
    if (passing > totalPoints) {
      throw new BadRequestException(
        `Passing score (${passing}) cannot exceed total possible score (${totalPoints})`,
      );
    }

    const courseId = lesson.unit.chapter.courseId;
    let gate = await db.assessment.findFirst({
      where: { lessonId, type: END_OF_LESSON },
      orderBy: { createdAt: 'desc' },
    });

    if (!gate) {
      gate = await db.assessment.create({
        data: {
          courseId,
          unitId: lesson.unitId,
          lessonId,
          type: END_OF_LESSON,
          titleAr: input.titleAr ?? 'اختبار نهاية الدرس',
          durationMinutes: 0,
          passingScore: input.passingScore ?? 0,
          shuffleQuestions: false,
          resultReleaseRule: 'IMMEDIATE',
          status: 'PUBLISHED',
        },
      });
    } else {
      gate = await db.assessment.update({
        where: { id: gate.id },
        data: {
          titleAr: input.titleAr ?? gate.titleAr,
          passingScore: input.passingScore ?? gate.passingScore,
          archivedAt: null,
          status: 'PUBLISHED',
        },
      });
    }

    await this.replaceQuestions(actor, gate.id, input.questions);

    const updated = await db.assessment.findUnique({
      where: { id: gate.id },
      include: {
        questions: {
          orderBy: { sort: 'asc' },
          include: { question: true },
        },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'LESSON_QUIZ_UPSERTED',
      targetType: 'ASSESSMENT',
      targetId: gate.id,
      after: { lessonId, enabled: true },
    });
    return {
      lessonId: lesson.id,
      enabled: true,
      assessmentId: gate.id,
      passingScore: input.passingScore,
      questions:
        updated?.questions.map((entry: any) => ({
          questionId: entry.questionId,
          order: entry.sort,
          titleAr: entry.question.titleAr,
          options: entry.question.options,
          correctOptionId: entry.question.correctOptionId,
          explanation: entry.question.explanation,
          points: entry.question.points,
        })) ?? [],
    };
  }

  private async replaceQuestions(
    actor: Actor,
    assessmentId: string,
    questions: LessonQuizQuestionDto[],
  ) {
    const existing: { questionId: string; sort: number }[] = [];
    for (let sort = 0; sort < questions.length; sort += 1) {
      const item = questions[sort];
      this.validateQuestion(item);
      const options = item.options;
      const optionIds = options.map((option) => option.id);
      if (!optionIds.includes(item.correctOptionId)) {
        throw new BadRequestException(
          'Correct answer must match one of the answer choices',
        );
      }
      const data: any = {
        titleAr: item.titleAr.trim(),
        options: options as never,
        correctOptionId: item.correctOptionId,
        explanation: item.explanation,
        points: item.points ?? 1,
      };
      const persistedId = item.questionId || item.id;
      let questionId: string;
      if (persistedId) {
        const existingQuestion = await db.question.findFirst({
          where: { id: persistedId, organizationId: actor.organizationId },
        });
        if (existingQuestion) {
          await db.question.update({
            where: { id: persistedId },
            data,
          });
          questionId = persistedId;
        } else {
          const created = await db.question.create({
            data: { organizationId: actor.organizationId, ...data },
          });
          questionId = created.id;
        }
      } else {
        const created = await db.question.create({
          data: { organizationId: actor.organizationId, ...data },
        });
        questionId = created.id;
      }
      existing.push({ questionId, sort });
    }

    await db.$transaction(async (tx: any) => {
      await tx.assessmentQuestion.deleteMany({ where: { assessmentId } });
      if (existing.length) {
        await tx.assessmentQuestion.createMany({
          data: existing.map((entry) => ({
            assessmentId,
            questionId: entry.questionId,
            sort: entry.sort,
          })),
        });
      }
    });
  }

  private validateQuestion(item: LessonQuizQuestionDto) {
    if (!item.titleAr || !item.titleAr.trim()) {
      throw new BadRequestException('Question text is required');
    }
    const options = item.options || [];
    const filled = options.filter((option) => option.text.trim().length > 0);
    if (filled.length < 2) {
      throw new BadRequestException(
        'Each question must have at least 2 answer choices',
      );
    }
    const optionIds = options.map((option) => option.id);
    if (!item.correctOptionId || !optionIds.includes(item.correctOptionId)) {
      throw new BadRequestException(
        'Exactly one correct answer must be selected from the choices',
      );
    }
    const points = item.points ?? 1;
    if (!Number.isInteger(points) || points <= 0) {
      throw new BadRequestException('Question points must be greater than 0');
    }
  }

  private async assertLesson(organizationId: string, lessonId: string) {
    const lesson = await db.lesson.findFirst({
      where: {
        id: lessonId,
        unit: { chapter: { course: { organizationId } } },
      },
      include: { unit: { include: { chapter: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }
}
