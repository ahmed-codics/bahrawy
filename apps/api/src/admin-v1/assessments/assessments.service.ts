import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { db } from '@bahrawy/db';
import { CreateAssessmentDto, UpdateAssessmentDto } from './assessments.dto';

@Injectable()
export class AdminV1AssessmentsService {
  async detail(organizationId: string, id: string) {
    const assessment = await db.assessment.findFirst({
      where: { id, course: { organizationId } },
      include: {
        questions: {
          orderBy: { sort: 'asc' },
          include: { question: true },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async createForLesson(
    organizationId: string,
    lessonId: string,
    input: CreateAssessmentDto,
  ) {
    const lesson = await db.lesson.findFirst({
      where: { id: lessonId, unit: { chapter: { course: { organizationId } } } },
      include: { unit: { include: { chapter: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return db.assessment.create({
      data: {
        courseId: lesson.unit.chapter.courseId,
        unitId: lesson.unitId,
        lessonId,
        titleAr: input.titleAr,
        type: input.type ?? 'HOMEWORK',
        durationMinutes: input.durationMinutes ?? 0,
        shuffleQuestions: input.shuffleQuestions ?? false,
        resultReleaseRule: input.resultReleaseRule ?? 'IMMEDIATE',
        status: 'DRAFT',
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateAssessmentDto,
  ) {
    const assessment = await db.assessment.findFirst({
      where: { id, course: { organizationId } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This assessment was changed by another staff member',
      });
    }
    const { version, ...data } = input;
    return db.assessment.update({
      where: { id },
      data: {
        ...data,
        archivedAt: input.status === 'ARCHIVED' ? new Date() : undefined,
        version: { increment: 1 },
      },
    });
  }
}
