import { AdminV1StudentQuestionsService } from './student-questions.service';
import { NotificationService } from '../../notification/notification.service';
import { StudentQuestionAttachmentsService } from '../../student-questions/student-questions-attachments.service';
import { db } from '@bahrawy/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    studentQuestion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    studentQuestionMessage: {
      create: jest.fn(),
    },
    storedObject: { findMany: jest.fn() },
    studentQuestionAttachment: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(),
  };
  return { db: mockDbClient };
});

describe('AdminV1StudentQuestionsService (org isolation & RBAC flows)', () => {
  let service: AdminV1StudentQuestionsService;
  const notifications = { createForStaff: jest.fn(), create: jest.fn() };
  const audit = {
    logEvent: jest.fn(),
    redactSensitive: jest.fn((v: any) => v),
  };
  const attachments = {
    resolveAttachments: jest.fn().mockResolvedValue([]),
    linkToMessage: jest.fn().mockResolvedValue(undefined),
    decorate: jest
      .fn()
      .mockImplementation((_acc, _q, _base, atts) =>
        (atts || []).map((a: any) => ({ ...a, url: `/img/${a.id}` })),
      ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminV1StudentQuestionsService(
      audit,
      notifications as unknown as NotificationService,
      attachments as unknown as StudentQuestionAttachmentsService,
    );
  });

  const actor = { id: 'staff-1', organizationId: 'org-x' };

  it('scopes the list query to the organization and applies filters', async () => {
    (db.studentQuestion.findMany as jest.Mock).mockResolvedValue([]);
    (db.studentQuestion.count as jest.Mock).mockResolvedValue(0);

    await service.list(actor, 'PENDING_REVIEW', 'محمد', 'grade-1', 2, 10);

    expect(db.studentQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-x',
          status: 'PENDING_REVIEW',
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(db.studentQuestion.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-x' }),
      }),
    );
  });

  it('returns pagination metadata', async () => {
    (db.studentQuestion.findMany as jest.Mock).mockResolvedValue([
      { id: 'q-1' },
    ]);
    (db.studentQuestion.count as jest.Mock).mockResolvedValue(21);

    const result = await service.list(
      actor,
      undefined,
      undefined,
      undefined,
      3,
      10,
    );

    expect(result.meta).toEqual({
      page: 3,
      pageSize: 10,
      total: 21,
      pageCount: 3,
    });
  });

  it('denies cross-organization detail access', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.detail(actor, 'q-other-org')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.studentQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-x' }),
      }),
    );
  });

  it('denies replying to a question outside the organization', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.reply(actor, 'q-other', { message: 'رد' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks admin replies on a closed question', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue({
      id: 'q-1',
      status: 'CLOSED',
    });

    await expect(
      service.reply(actor, 'q-1', { message: 'رد' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a staff reply, marks the question ANSWERED, notifies the student, and audits', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue({
      id: 'q-1',
      status: 'PENDING_REVIEW',
      accountId: 'student-1',
    });
    const message = { id: 'm-1' };
    (db.$transaction as jest.Mock).mockResolvedValue([message]);
    (notifications.create as jest.Mock).mockResolvedValue({});

    const result = await service.reply(actor, 'q-1', {
      message: 'رد الأكاديمية',
    });

    expect(result).toEqual(message);
    expect(db.$transaction).toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      'student-1',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ questionId: 'q-1' }),
    );
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-x',
        action: 'STUDENT_QUESTION_REPLIED',
        targetId: 'q-1',
      }),
    );
  });

  it('links image attachments to an admin reply (staff bypasses uploader check)', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue({
      id: 'q-1',
      status: 'PENDING_REVIEW',
      accountId: 'student-1',
    });
    (attachments.resolveAttachments as jest.Mock).mockResolvedValue([
      {
        id: 'obj-9',
        organizationId: 'org-x',
        uploadedBy: 'staff-1',
        status: 'APPROVED',
        mimeType: 'image/webp',
        originalName: 'staff-photo.webp',
        sizeBytes: 111,
        type: 'IMAGE',
        durationSeconds: null,
      },
    ]);
    const message = { id: 'm-9' };
    (db.$transaction as jest.Mock).mockImplementation((fn: any) =>
      fn({
        studentQuestionMessage: {
          create: jest.fn().mockResolvedValue(message),
        },
        studentQuestionAttachment: {
          createMany: jest.fn().mockResolvedValue({}),
        },
        studentQuestion: { update: jest.fn().mockResolvedValue({}) },
      }),
    );
    (notifications.create as jest.Mock).mockResolvedValue({});

    await service.reply(actor, 'q-1', {
      message: 'رد الأكاديمية مع صورة',
      attachmentIds: ['obj-9'],
    });

    expect(attachments.resolveAttachments).toHaveBeenCalledWith(
      'org-x',
      'staff-1',
      ['obj-9'],
      true,
      undefined,
      0,
    );
    expect(attachments.linkToMessage).toHaveBeenCalledWith(
      expect.anything(),
      'm-9',
      [
        {
          storedObjectId: 'obj-9',
          originalName: 'staff-photo.webp',
          mimeType: 'image/webp',
          sizeBytes: 111,
          type: 'IMAGE',
          durationSeconds: null,
        },
      ],
    );
  });

  it('changes status within the organization and audits the transition', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue({
      id: 'q-1',
      status: 'PENDING_REVIEW',
      accountId: 'student-1',
    });
    (db.studentQuestion.update as jest.Mock).mockResolvedValue({
      id: 'q-1',
      status: 'CLOSED',
    });

    const result = await service.updateStatus(actor, 'q-1', {
      status: 'CLOSED',
    });

    expect(result.status).toBe('CLOSED');
    expect(notifications.create).toHaveBeenCalledWith(
      'student-1',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ questionId: 'q-1' }),
    );
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STUDENT_QUESTION_STATUS_CHANGED',
        before: { status: 'PENDING_REVIEW' },
        after: { status: 'CLOSED' },
      }),
    );
  });
});
