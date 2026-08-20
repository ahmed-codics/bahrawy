import { StudentQuestionsService } from './student-questions.service';
import { NotificationService } from '../notification/notification.service';
import { StudentQuestionAttachmentsService } from './student-questions-attachments.service';
import { db } from '@bahrawy/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    studentQuestion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    studentQuestionMessage: {
      create: jest.fn(),
    },
    storedObject: { findMany: jest.fn() },
    studentQuestionAttachment: { count: jest.fn().mockResolvedValue(0) },
    course: { findFirst: jest.fn() },
    lesson: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  return { db: mockDbClient };
});

describe('StudentQuestionsService (ownership & isolation)', () => {
  let service: StudentQuestionsService;
  const notifications = { createForStaff: jest.fn(), create: jest.fn() };
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
    service = new StudentQuestionsService(
      notifications as unknown as NotificationService,
      attachments as unknown as StudentQuestionAttachmentsService,
    );
  });

  const account = { id: 'student-1', organizationId: 'org-x', kind: 'STUDENT' };

  it('creates a question and an initial student message in one transaction', async () => {
    (db.course.findFirst as jest.Mock).mockResolvedValue(null);
    const created = {
      id: 'q-1',
      organizationId: 'org-x',
      accountId: 'student-1',
    };
    (db.$transaction as jest.Mock).mockImplementation((fn: any) =>
      fn({
        studentQuestion: {
          create: jest.fn().mockResolvedValue(created),
        },
        studentQuestionMessage: { create: jest.fn().mockResolvedValue({}) },
      }),
    );
    (notifications.createForStaff as jest.Mock).mockResolvedValue(1);

    const result = await service.create(account, {
      message: 'ممكن توضح الدرس الثاني',
      courseId: undefined,
      lessonId: undefined,
    });

    expect(result).toEqual(created);
    expect(db.$transaction).toHaveBeenCalled();
    expect(notifications.createForStaff).toHaveBeenCalledWith(
      'org-x',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ questionId: 'q-1' }),
      ['STUDENT_QUESTION_MANAGE'],
    );
  });

  it('links validated image attachments to the initial message when creating', async () => {
    (db.course.findFirst as jest.Mock).mockResolvedValue(null);
    (attachments.resolveAttachments as jest.Mock).mockResolvedValue([
      {
        id: 'obj-1',
        organizationId: 'org-x',
        uploadedBy: 'student-1',
        status: 'APPROVED',
        mimeType: 'image/webp',
        originalName: 'photo.webp',
        sizeBytes: 12345,
        type: 'IMAGE',
        durationSeconds: null,
      },
    ]);
    const created = {
      id: 'q-1',
      organizationId: 'org-x',
      accountId: 'student-1',
    };
    const message = { id: 'm-1' };
    (db.$transaction as jest.Mock).mockImplementation((fn: any) =>
      fn({
        studentQuestion: {
          create: jest.fn().mockResolvedValue(created),
        },
        studentQuestionMessage: {
          create: jest.fn().mockResolvedValue(message),
        },
        studentQuestionAttachment: {
          createMany: jest.fn().mockResolvedValue({}),
        },
      }),
    );
    (notifications.createForStaff as jest.Mock).mockResolvedValue(1);

    await service.create(account, {
      message: 'سؤال مع صورة',
      attachmentIds: ['obj-1'],
    });

    expect(attachments.resolveAttachments).toHaveBeenCalledWith(
      'org-x',
      'student-1',
      ['obj-1'],
      false,
      undefined,
    );
    expect(attachments.linkToMessage).toHaveBeenCalledWith(
      expect.anything(),
      'm-1',
      [
        {
          storedObjectId: 'obj-1',
          originalName: 'photo.webp',
          mimeType: 'image/webp',
          sizeBytes: 12345,
          type: 'IMAGE',
          durationSeconds: null,
        },
      ],
    );
  });

  it('attaches images to a student reply that reopens the question', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue({
      id: 'q-1',
      status: 'ANSWERED',
      organizationId: 'org-x',
      accountId: 'student-1',
    });
    (attachments.resolveAttachments as jest.Mock).mockResolvedValue([
      {
        id: 'obj-2',
        organizationId: 'org-x',
        uploadedBy: 'student-1',
        status: 'APPROVED',
        mimeType: 'image/jpeg',
        originalName: 'reply.jpg',
        sizeBytes: 999,
        type: 'IMAGE',
        durationSeconds: null,
      },
    ]);
    const message = { id: 'm-2' };
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
    (notifications.createForStaff as jest.Mock).mockResolvedValue(1);

    const result = await service.reply(account, 'q-1', {
      message: 'رد مع صورة',
      attachmentIds: ['obj-2'],
    });

    expect(result).toEqual(message);
    expect(attachments.linkToMessage).toHaveBeenCalledWith(
      expect.anything(),
      'm-2',
      [
        {
          storedObjectId: 'obj-2',
          originalName: 'reply.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 999,
          type: 'IMAGE',
          durationSeconds: null,
        },
      ],
    );
  });

  it('rejects a course that does not belong to the organization', async () => {
    (db.course.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create(account, { message: 'سؤال', courseId: 'course-other' }),
    ).rejects.toThrow(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a lesson that is not under the given course', async () => {
    (db.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1' });
    (db.lesson.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.create(account, {
        message: 'سؤال',
        courseId: 'course-1',
        lessonId: 'lesson-other',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('only lists questions owned by the authenticated student in their org', async () => {
    (db.studentQuestion.findMany as jest.Mock).mockResolvedValue([]);
    (db.studentQuestion.count as jest.Mock).mockResolvedValue(0);

    await service.list(account, 'PENDING_REVIEW', 1, 50);

    expect(db.studentQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: 'student-1',
          organizationId: 'org-x',
          status: 'PENDING_REVIEW',
        }),
      }),
    );
  });

  it('denies reading a question owned by another student', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.detail(account, 'q-other')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.studentQuestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'q-other',
          accountId: 'student-1',
          organizationId: 'org-x',
        }),
      }),
    );
  });

  it('denies replying to a question owned by another student', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.reply(account, 'q-other', { message: 'رد' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks student replies on a closed question', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue({
      id: 'q-1',
      status: 'CLOSED',
    });

    await expect(
      service.reply(account, 'q-1', { message: 'رد' }),
    ).rejects.toThrow(BadRequestException);
    expect(db.studentQuestionMessage.create).not.toHaveBeenCalled();
  });

  it('reopens a question when the student replies and notifies staff', async () => {
    (db.studentQuestion.findFirst as jest.Mock).mockResolvedValue({
      id: 'q-1',
      status: 'ANSWERED',
      organizationId: 'org-x',
      accountId: 'student-1',
    });
    const message = { id: 'm-1' };
    (db.$transaction as jest.Mock).mockResolvedValue([message]);
    (notifications.createForStaff as jest.Mock).mockResolvedValue(1);

    const result = await service.reply(account, 'q-1', { message: 'رد' });

    expect(result).toEqual(message);
    expect(db.$transaction).toHaveBeenCalled();
    expect(notifications.createForStaff).toHaveBeenCalledWith(
      'org-x',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ questionId: 'q-1' }),
      ['STUDENT_QUESTION_MANAGE'],
    );
  });
});
