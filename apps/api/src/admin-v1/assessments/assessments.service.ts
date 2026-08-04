import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { CreateAssessmentDto, UpdateAssessmentDto } from './assessments.dto';
import { AdminAuditService } from '../common/services/audit.service';

type Actor = { id: string; organizationId: string };

@Injectable()
export class AdminV1AssessmentsService {
  constructor(private readonly audit: AdminAuditService) {}

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
    actor: Actor,
    lessonId: string,
    input: CreateAssessmentDto,
  ) {
    const lesson = await db.lesson.findFirst({
      where: {
        id: lessonId,
        unit: {
          chapter: { course: { organizationId: actor.organizationId } },
        },
      },
      include: { unit: { include: { chapter: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const created = await db.assessment.create({
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
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ASSESSMENT_CREATED',
      targetType: 'ASSESSMENT',
      targetId: created.id,
      after: created,
    });
    return created;
  }

  async update(actor: Actor, id: string, input: UpdateAssessmentDto) {
    const assessment = await db.assessment.findFirst({
      where: { id, course: { organizationId: actor.organizationId } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This assessment was changed by another staff member',
        currentVersion: assessment.version,
      });
    }
    const { version, ...data } = input;
    void version;
    const updated = await db.assessment.update({
      where: { id },
      data: {
        ...data,
        archivedAt:
          input.status === 'ARCHIVED'
            ? new Date()
            : input.status === 'DRAFT' || input.status === 'PUBLISHED'
              ? null
              : undefined,
        version: { increment: 1 },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ASSESSMENT_UPDATED',
      targetType: 'ASSESSMENT',
      targetId: id,
      before: assessment,
      after: updated,
    });
    return updated;
  }
}
