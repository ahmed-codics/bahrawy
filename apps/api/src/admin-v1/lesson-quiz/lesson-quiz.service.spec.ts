import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { db } from '@bahrawy/db';
import { AdminV1LessonQuizService } from './lesson-quiz.service';
import { AdminAuditService } from '../common/services/audit.service';

jest.mock('@bahrawy/db', () => {
  const mockDb: any = {
    lesson: { findFirst: jest.fn() },
    assessment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    question: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    assessmentQuestion: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn((callback: any) => callback(db)),
  };
  return { db: mockDb };
});

describe('AdminV1LessonQuizService', () => {
  let service: AdminV1LessonQuizService;
  const actor = { id: 'staff-1', organizationId: 'org-1' };

  const lesson = {
    id: 'lesson-1',
    unitId: 'unit-1',
    unit: { chapter: { courseId: 'course-1' } },
  };

  beforeEach(async () => {
    const audit = { logEvent: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        AdminV1LessonQuizService,
        { provide: AdminAuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(AdminV1LessonQuizService);
    (db.lesson.findFirst as jest.Mock).mockResolvedValue(lesson);
    jest.clearAllMocks();
    (db.lesson.findFirst as jest.Mock).mockResolvedValue(lesson);
  });

  it('returns the disabled empty state when no gate exists', async () => {
    (db.assessment.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.get('org-1', 'lesson-1')).resolves.toEqual({
      lessonId: 'lesson-1',
      enabled: false,
      assessmentId: null,
    });
  });

  it('stores questions scoped to the specific lesson, reusing it on re-save (no duplicates)', async () => {
    (db.assessment.findFirst as jest.Mock).mockResolvedValue(null);
    (db.assessment.create as jest.Mock).mockResolvedValue({ id: 'assess-1' });
    (db.question.create as jest.Mock).mockResolvedValue({ id: 'q-1' });
    db.$transaction = jest.fn((cb: any) => cb(db));
    const mockQuestion = {
      titleAr: 'ما هو؟',
      options: [
        { id: 'a', text: 'أ' },
        { id: 'b', text: 'ب' },
      ],
      correctOptionId: 'b',
      explanation: null,
      points: 2,
    };
    (db.assessment.findUnique as jest.Mock).mockResolvedValue({
      id: 'assess-1',
      lessonId: 'lesson-1',
      titleAr: 'اختبار نهاية الدرس',
      passingScore: 2,
      status: 'PUBLISHED',
      archivedAt: null,
      questions: [{ questionId: 'q-1', sort: 0, question: mockQuestion }],
    });

    const input: any = {
      enabled: true,
      titleAr: 'اختبار نهاية الدرس',
      passingScore: 2,
      questions: [
        {
          titleAr: 'ما هو؟',
          options: [
            { id: 'a', text: 'أ' },
            { id: 'b', text: 'ب' },
          ],
          correctOptionId: 'b',
          points: 2,
        },
      ],
    };

    const first = await service.upsert(actor, 'lesson-1', input);
    expect(db.assessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lessonId: 'lesson-1',
          type: 'END_OF_LESSON',
        }),
      }),
    );
    expect(first.questions![0].questionId).toBeDefined();

    // Second save must not create a new Question for the same logical question
    const qid = first.questions![0].questionId as string;
    (db.question.findFirst as jest.Mock).mockResolvedValue({ id: qid });
    const secondInput: any = {
      enabled: true,
      titleAr: 'اختبار نهاية الدرس',
      passingScore: 2,
      questions: [
        {
          questionId: qid,
          titleAr: 'ما هو؟ (مُعدل)',
          options: [
            { id: 'a', text: 'أ' },
            { id: 'b', text: 'ب' },
          ],
          correctOptionId: 'b',
          points: 2,
        },
      ],
    };
    await service.upsert(actor, 'lesson-1', secondInput);
    expect(db.question.create).toHaveBeenCalledTimes(1);
    expect(db.question.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: qid } }),
    );
  });

  it('rejects a quiz whose passing score exceeds the total points', async () => {
    const input: any = {
      enabled: true,
      passingScore: 10,
      questions: [
        {
          titleAr: 'q',
          options: [
            { id: 'a', text: 'أ' },
            { id: 'b', text: 'ب' },
          ],
          correctOptionId: 'b',
          points: 1,
        },
      ],
    };
    await expect(service.upsert(actor, 'lesson-1', input)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects saving a quiz with fewer than two answer choices', async () => {
    const input: any = {
      enabled: true,
      passingScore: 1,
      questions: [
        {
          titleAr: 'q',
          options: [{ id: 'a', text: 'أ' }],
          correctOptionId: 'a',
          points: 1,
        },
      ],
    };
    await expect(service.upsert(actor, 'lesson-1', input)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects saving when the correct answer is not among the choices', async () => {
    (db.assessment.findFirst as jest.Mock).mockResolvedValue(null);
    const input: any = {
      enabled: true,
      passingScore: 1,
      questions: [
        {
          titleAr: 'q',
          options: [
            { id: 'a', text: 'أ' },
            { id: 'b', text: 'ب' },
          ],
          correctOptionId: 'z',
          points: 1,
        },
      ],
    };
    await expect(service.upsert(actor, 'lesson-1', input)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('disables (archives) the gate and returns enabled false', async () => {
    (db.assessment.findFirst as jest.Mock).mockResolvedValue({
      id: 'assess-1',
    });
    (db.assessment.update as jest.Mock).mockResolvedValue({ id: 'assess-1' });
    await expect(
      service.upsert(actor, 'lesson-1', { enabled: false }),
    ).resolves.toEqual({
      lessonId: 'lesson-1',
      enabled: false,
      assessmentId: null,
    });
  });

  it('re-enables a disabled quiz by reusing the archived assessment, never creating a new one', async () => {
    const archivedGate = { id: 'assess-archived', archivedAt: new Date() };
    (db.lesson.findFirst as jest.Mock).mockResolvedValue({
      id: 'lesson-1',
      unitId: 'unit-1',
      unit: { chapter: { courseId: 'course-1' } },
    });
    (db.assessment.findFirst as jest.Mock).mockResolvedValue(archivedGate);
    (db.assessment.update as jest.Mock).mockResolvedValue({
      id: 'assess-archived',
    });
    (db.assessment.findUnique as jest.Mock).mockResolvedValue({
      questions: [],
    });
    const payload = {
      enabled: true,
      titleAr: 'اختبار',
      passingScore: 2,
      questions: [
        {
          questionId: 'q-1',
          titleAr: 'سؤال',
          options: [
            { id: 'a', text: 'أ' },
            { id: 'b', text: 'ب' },
          ],
          correctOptionId: 'b',
          points: 2,
        },
      ],
    };
    await expect(service.upsert(actor, 'lesson-1', payload)).resolves.toEqual(
      expect.objectContaining({
        lessonId: 'lesson-1',
        enabled: true,
        assessmentId: 'assess-archived',
      }),
    );
    expect(db.assessment.create).not.toHaveBeenCalled();
    expect(db.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assess-archived' },
        data: expect.objectContaining({ archivedAt: null }),
      }),
    );
  });

  it('returns 404 for a lesson not in the organization', async () => {
    (db.lesson.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.get('org-1', 'lesson-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
