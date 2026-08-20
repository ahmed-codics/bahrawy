import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { NotificationService } from '../notification/notification.service';
import { StudentQuestionAttachmentsService } from './student-questions-attachments.service';
import {
  CreateStudentQuestionDto,
  StudentQuestionReplyDto,
} from './student-questions.dto';

type AccountContext = { id: string; organizationId: string; kind: string };

const ATTACHMENT_BASE_PATH = '/student/questions';

@Injectable()
export class StudentQuestionsService {
  constructor(
    private readonly notifications: NotificationService,
    private readonly attachments: StudentQuestionAttachmentsService,
  ) {}

  async create(account: AccountContext, input: CreateStudentQuestionDto) {
    await this.validateContext(
      account.organizationId,
      input.courseId,
      input.lessonId,
    );
    const objects = await this.attachments.resolveAttachments(
      account.organizationId,
      account.id,
      input.attachmentIds,
      account.kind === 'STAFF',
      input.voiceDurations,
    );

    const question = await db.$transaction(async (tx) => {
      const created = await tx.studentQuestion.create({
        data: {
          organizationId: account.organizationId,
          accountId: account.id,
          courseId: input.courseId ?? null,
          lessonId: input.lessonId ?? null,
          status: 'PENDING_REVIEW',
        },
      });
      const message = await tx.studentQuestionMessage.create({
        data: {
          questionId: created.id,
          senderAccountId: account.id,
          senderType: 'STUDENT',
          message: input.message,
        },
      });
      if (objects.length > 0) {
        await this.attachments.linkToMessage(
          tx,
          message.id,
          objects.map((o) => ({
            storedObjectId: o.id,
            originalName: o.originalName,
            mimeType: o.mimeType,
            sizeBytes: o.sizeBytes,
            type: o.type,
            durationSeconds: o.durationSeconds,
          })),
        );
      }
      return created;
    });

    await this.notifications.createForStaff(
      account.organizationId,
      'سؤال جديد من طالب',
      'وصل سؤال جديد من طالب بانتظار المراجعة والرد.',
      { type: 'STUDENT_QUESTION', questionId: question.id },
      ['STUDENT_QUESTION_MANAGE'],
    );

    return question;
  }

  async list(
    account: AccountContext,
    status?: string,
    page = 1,
    pageSize = 50,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = Math.max(page - 1, 0) * take;
    const where = {
      organizationId: account.organizationId,
      accountId: account.id,
      ...(status ? { status: status as any } : {}),
    };
    const [items, total] = await Promise.all([
      db.studentQuestion.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { id: true, titleAr: true } },
          lesson: { select: { id: true, titleAr: true } },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              senderType: true,
              message: true,
              createdAt: true,
              attachments: {
                select: {
                  id: true,
                  originalName: true,
                  mimeType: true,
                  sizeBytes: true,
                  type: true,
                  durationSeconds: true,
                },
              },
            },
          },
        },
      }),
      db.studentQuestion.count({ where }),
    ]);
    const decoratedItems = items.map((item) => ({
      ...item,
      messages: (item.messages || []).map((message) => ({
        ...message,
        attachments: this.attachments.decorate(
          account.id,
          item.id,
          ATTACHMENT_BASE_PATH,
          message.attachments ?? [],
        ),
      })),
    }));
    return { items: decoratedItems, meta: { page, pageSize: take, total } };
  }

  async detail(account: AccountContext, id: string) {
    const question = await db.studentQuestion.findFirst({
      where: {
        id,
        accountId: account.id,
        organizationId: account.organizationId,
      },
      include: {
        course: { select: { id: true, titleAr: true } },
        lesson: { select: { id: true, titleAr: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            senderType: true,
            message: true,
            createdAt: true,
            attachments: {
              select: {
                id: true,
                originalName: true,
                mimeType: true,
                sizeBytes: true,
                type: true,
                durationSeconds: true,
              },
            },
            senderAccount: {
              select: {
                studentProfile: { select: { displayName: true } },
                staffProfile: { select: { displayName: true } },
              },
            },
          },
        },
      },
    });
    if (!question) throw new NotFoundException('Student question not found');
    return {
      ...question,
      messages: (question.messages || []).map((message) => ({
        ...message,
        attachments: this.attachments.decorate(
          account.id,
          question.id,
          ATTACHMENT_BASE_PATH,
          message.attachments ?? [],
        ),
      })),
    };
  }

  async reply(
    account: AccountContext,
    id: string,
    input: StudentQuestionReplyDto,
  ) {
    const question = await db.studentQuestion.findFirst({
      where: {
        id,
        accountId: account.id,
        organizationId: account.organizationId,
      },
    });
    if (!question) throw new NotFoundException('Student question not found');
    if (question.status === 'CLOSED') {
      throw new BadRequestException(
        'This question is closed and cannot receive replies',
      );
    }
    const existingVoiceCount = await db.studentQuestionAttachment.count({
      where: { message: { questionId: id }, type: 'VOICE' },
    });
    const objects = await this.attachments.resolveAttachments(
      account.organizationId,
      account.id,
      input.attachmentIds,
      account.kind === 'STAFF',
      input.voiceDurations,
      existingVoiceCount,
    );

    const [message] = await db.$transaction(async (tx) => {
      const created = await tx.studentQuestionMessage.create({
        data: {
          questionId: id,
          senderAccountId: account.id,
          senderType: 'STUDENT',
          message: input.message,
        },
      });
      if (objects.length > 0) {
        await this.attachments.linkToMessage(
          tx,
          created.id,
          objects.map((o) => ({
            storedObjectId: o.id,
            originalName: o.originalName,
            mimeType: o.mimeType,
            sizeBytes: o.sizeBytes,
            type: o.type,
            durationSeconds: o.durationSeconds,
          })),
        );
      }
      await tx.studentQuestion.update({
        where: { id },
        data: { status: 'PENDING_REVIEW' },
      });
      return [created];
    });

    await this.notifications.createForStaff(
      account.organizationId,
      'رد جديد من طالب',
      'أضاف الطالب رداً جديداً على سؤاله بانتظار المراجعة.',
      { type: 'STUDENT_QUESTION', questionId: id },
      ['STUDENT_QUESTION_MANAGE'],
    );

    return message;
  }

  private async validateContext(
    organizationId: string,
    courseId?: string,
    lessonId?: string,
  ) {
    if (courseId) {
      const course = await db.course.findFirst({
        where: { id: courseId, organizationId },
        select: { id: true },
      });
      if (!course) throw new BadRequestException('Course not found');
    }
    if (lessonId) {
      const lesson = await db.lesson.findFirst({
        where: {
          id: lessonId,
          ...(courseId
            ? { unit: { chapter: { courseId } } }
            : { unit: { chapter: { course: { organizationId } } } }),
        },
        select: { id: true },
      });
      if (!lesson) throw new BadRequestException('Lesson not found');
    }
  }
}
