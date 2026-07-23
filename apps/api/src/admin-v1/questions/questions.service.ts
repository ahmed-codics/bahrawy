import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { QuestionInputDto, UpdateQuestionDto } from './questions.dto';

@Injectable()
export class AdminV1QuestionsService {
  list(
    organizationId: string,
    search?: string,
    gradeId?: string,
    archived = false,
  ) {
    return db.question.findMany({
      where: {
        organizationId,
        archivedAt: archived ? { not: null } : null,
        ...(gradeId ? { gradeId } : {}),
        ...(search
          ? {
              OR: [
                { titleAr: { contains: search, mode: 'insensitive' } },
                { titleEn: { contains: search, mode: 'insensitive' } },
                { tags: { has: search } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { assessments: true } } },
    });
  }

  create(organizationId: string, input: QuestionInputDto) {
    return db.question.create({
      data: {
        organizationId,
        ...input,
        options: input.options as never,
        tags: input.tags ?? [],
        points: input.points ?? 1,
      },
    });
  }

  async update(organizationId: string, id: string, input: UpdateQuestionDto) {
    const question = await this.assertQuestion(organizationId, id);
    if (question.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This question was changed by another staff member',
      });
    }
    const { version, ...data } = input;
    return db.question.update({
      where: { id },
      data: {
        ...data,
        options: data.options as never,
        version: { increment: 1 },
      },
    });
  }

  async setArchived(organizationId: string, id: string, archived: boolean) {
    await this.assertQuestion(organizationId, id);
    return db.question.update({
      where: { id },
      data: {
        archivedAt: archived ? new Date() : null,
        version: { increment: 1 },
      },
    });
  }

  async assign(
    organizationId: string,
    assessmentId: string,
    questionIds: string[],
  ) {
    const assessment = await db.assessment.findFirst({
      where: { id: assessmentId, course: { organizationId } },
      include: { questions: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const validCount = await db.question.count({
      where: { id: { in: questionIds }, organizationId, archivedAt: null },
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
    return db.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: { sort: 'asc' }, include: { question: true } },
      },
    });
  }

  async unassign(
    organizationId: string,
    assessmentId: string,
    questionId: string,
  ) {
    const assessment = await db.assessment.findFirst({
      where: { id: assessmentId, course: { organizationId } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    await db.assessmentQuestion.delete({
      where: { assessmentId_questionId: { assessmentId, questionId } },
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
