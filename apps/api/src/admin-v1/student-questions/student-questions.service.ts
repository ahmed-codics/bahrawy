import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { NotificationService } from '../../notification/notification.service';
import { AdminAuditService } from '../common/services/audit.service';
import { StudentQuestionAttachmentsService } from '../../student-questions/student-questions-attachments.service';
import {
  AdminStudentQuestionReplyDto,
  UpdateStudentQuestionStatusDto,
} from './student-questions.dto';

type Actor = { id: string; organizationId: string };

const ATTACHMENT_BASE_PATH = '/admin/v1/student-questions';

@Injectable()
export class AdminV1StudentQuestionsService {
  constructor(
    private readonly audit: AdminAuditService,
    private readonly notifications: NotificationService,
    private readonly attachments: StudentQuestionAttachmentsService,
  ) {}

  async list(
    actor: Actor,
    status?: string,
    search?: string,
    gradeId?: string,
    page = 1,
    pageSize = 25,
  ) {
    const organizationId = actor.organizationId;
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = Math.max(page - 1, 0) * take;
    const where = {
      organizationId,
      ...(status ? { status: status as any } : {}),
      ...(gradeId ? { account: { studentProfile: { gradeId } } } : {}),
      ...(search
        ? {
            OR: [
              {
                account: {
                  studentProfile: {
                    displayName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
              {
                course: {
                  titleAr: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                lesson: {
                  titleAr: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                messages: {
                  some: {
                    message: { contains: search, mode: 'insensitive' as const },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.studentQuestion.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: {
              id: true,
              studentProfile: {
                select: {
                  id: true,
                  displayName: true,
                  gradeId: true,
                  grade: { select: { id: true, nameAr: true } },
                },
              },
            },
          },
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
          actor.id,
          item.id,
          ATTACHMENT_BASE_PATH,
          message.attachments ?? [],
        ),
      })),
    }));
    return {
      items: decoratedItems,
      meta: {
        page,
        pageSize: take,
        total,
        pageCount: Math.ceil(total / take),
      },
    };
  }

  async detail(actor: Actor, id: string) {
    const question = await db.studentQuestion.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        account: {
          select: {
            id: true,
            studentProfile: {
              select: {
                id: true,
                displayName: true,
                gradeId: true,
                grade: { select: { id: true, nameAr: true } },
              },
            },
          },
        },
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
                id: true,
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
          actor.id,
          question.id,
          ATTACHMENT_BASE_PATH,
          message.attachments ?? [],
        ),
      })),
    };
  }

  async reply(actor: Actor, id: string, input: AdminStudentQuestionReplyDto) {
    const question = await db.studentQuestion.findFirst({
      where: { id, organizationId: actor.organizationId },
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
      actor.organizationId,
      actor.id,
      input.attachmentIds,
      true,
      input.voiceDurations,
      existingVoiceCount,
    );

    const [message] = await db.$transaction(async (tx) => {
      const created = await tx.studentQuestionMessage.create({
        data: {
          questionId: id,
          senderAccountId: actor.id,
          senderType: 'STAFF',
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
        data: { status: 'ANSWERED' },
      });
      return [created];
    });

    await this.notifications.create(
      question.accountId,
      'تم الرد على سؤالك',
      'قام فريق الأكاديمية بالرد على سؤالك.',
      { type: 'STUDENT_QUESTION', questionId: id },
    );

    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_QUESTION_REPLIED',
      targetType: 'STUDENT_QUESTION',
      targetId: id,
      after: { messageId: message.id },
    });

    return message;
  }

  async updateStatus(
    actor: Actor,
    id: string,
    input: UpdateStudentQuestionStatusDto,
  ) {
    const question = await db.studentQuestion.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!question) throw new NotFoundException('Student question not found');

    const updated = await db.studentQuestion.update({
      where: { id },
      data: { status: input.status },
    });

    if (input.status === 'CLOSED' && question.status !== 'CLOSED') {
      await this.notifications.create(
        question.accountId,
        'تم إغلاق سؤالك',
        'تم إغلاق هذا السؤال. إذا احتجت مساعدة أخرى يمكنك فتح سؤال جديد.',
        { type: 'STUDENT_QUESTION', questionId: id },
      );
    }

    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_QUESTION_STATUS_CHANGED',
      targetType: 'STUDENT_QUESTION',
      targetId: id,
      before: { status: question.status },
      after: { status: updated.status },
    });

    return updated;
  }
}
