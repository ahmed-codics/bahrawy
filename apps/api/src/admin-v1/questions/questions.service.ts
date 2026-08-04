import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { QuestionInputDto, UpdateQuestionDto } from './questions.dto';
import { AdminAuditService } from '../common/services/audit.service';
import { LifecycleMutationDto } from '../common/dto/lifecycle.dto';

type Actor = { id: string; organizationId: string };

@Injectable()
export class AdminV1QuestionsService {
  constructor(private readonly audit: AdminAuditService) {}

  async list(
    organizationId: string,
    search?: string,
    gradeId?: string,
    archived = false,
    page = 1,
    pageSize = 25,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = Math.max(page - 1, 0) * take;
    const where = {
      organizationId,
      archivedAt: archived ? { not: null } : null,
      ...(gradeId ? { gradeId } : {}),
      ...(search
        ? {
            OR: [
              { titleAr: { contains: search, mode: 'insensitive' as const } },
              { titleEn: { contains: search, mode: 'insensitive' as const } },
              { tags: { has: search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.question.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { assessments: true } } },
      }),
      db.question.count({ where }),
    ]);
    return {
      items,
      meta: {
        page,
        pageSize: take,
        total,
        pageCount: Math.ceil(total / take),
      },
    };
  }

  async create(actor: Actor, input: QuestionInputDto) {
    if (input.gradeId) {
      const grade = await db.grade.findFirst({
        where: {
          id: input.gradeId,
          organizationId: actor.organizationId,
          archivedAt: null,
        },
      });
      if (!grade) throw new BadRequestException('Grade not found');
    }
    const created = await db.question.create({
      data: {
        organizationId: actor.organizationId,
        ...input,
        options: input.options as never,
        tags: input.tags ?? [],
        points: input.points ?? 1,
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'QUESTION_CREATED',
      targetType: 'QUESTION',
      targetId: created.id,
      after: created,
    });
    return created;
  }

  async update(actor: Actor, id: string, input: UpdateQuestionDto) {
    const question = await this.assertQuestion(actor.organizationId, id);
    if (question.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This question was changed by another staff member',
        currentVersion: question.version,
      });
    }
    const { version, ...data } = input;
    void version;
    const updated = await db.question.update({
      where: { id },
      data: {
        ...data,
        options: data.options as never,
        version: { increment: 1 },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'QUESTION_UPDATED',
      targetType: 'QUESTION',
      targetId: id,
      before: question,
      after: updated,
    });
    return updated;
  }

  async setArchived(
    actor: Actor,
    id: string,
    archived: boolean,
    input: LifecycleMutationDto,
  ) {
    const question = await this.assertQuestion(actor.organizationId, id);
    if (question.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This question was changed by another staff member',
        currentVersion: question.version,
      });
    }
    const updated = await db.question.update({
      where: { id },
      data: {
        archivedAt: archived ? new Date() : null,
        version: { increment: 1 },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: archived ? 'QUESTION_ARCHIVED' : 'QUESTION_RESTORED',
      targetType: 'QUESTION',
      targetId: id,
      before: question,
      after: updated,
      reason: input.reason,
    });
    return updated;
  }

  async assign(actor: Actor, assessmentId: string, questionIds: string[]) {
    const assessment = await db.assessment.findFirst({
      where: {
        id: assessmentId,
        course: { organizationId: actor.organizationId },
      },
      include: { questions: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const validCount = await db.question.count({
      where: {
        id: { in: questionIds },
        organizationId: actor.organizationId,
        archivedAt: null,
      },
    });
    if (validCount !== new Set(questionIds).size) {
      throw new BadRequestException('One or more questions are invalid');
    }
    const existing = new Set(
      assessment.questions.map((item: any) => item.questionId),
    );
    const additions = [...new Set(questionIds)].filter(
      (id) => !existing.has(id),
    );
    await db.$transaction(
      additions.map((questionId, offset) =>
        db.assessmentQuestion.create({
          data: {
            assessmentId,
            questionId,
            sort: assessment.questions.length + offset,
          },
        }),
      ),
    );
    const updated = await db.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: { sort: 'asc' }, include: { question: true } },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ASSESSMENT_QUESTIONS_ASSIGNED',
      targetType: 'ASSESSMENT',
      targetId: assessmentId,
      before: { questionIds: [...existing] },
      after: {
        questionIds: updated?.questions.map((entry: any) => entry.questionId),
      },
    });
    return updated;
  }

  async unassign(
    actor: Actor,
    assessmentId: string,
    questionId: string,
    reason: string,
  ) {
    const assessment = await db.assessment.findFirst({
      where: {
        id: assessmentId,
        course: { organizationId: actor.organizationId },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await db.assessmentQuestion.delete({
      where: { assessmentId_questionId: { assessmentId, questionId } },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ASSESSMENT_QUESTION_UNASSIGNED',
      targetType: 'ASSESSMENT',
      targetId: assessmentId,
      before: { questionId },
      reason,
    });
    return { assessmentId, questionId };
  }

  private async assertQuestion(organizationId: string, id: string) {
    const question = await db.question.findFirst({
      where: { id, organizationId },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }
}
