import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { db } from '@bahrawy/db';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1AssessmentsService } from './assessments.service';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    assessment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    lesson: {
      update: jest.fn(),
    },
    unit: {
      updateMany: jest.fn(),
    },
    chapter: {
      updateMany: jest.fn(),
    },
    course: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(db)),
  };
  return { db: mockDbClient };
});

describe('AdminV1AssessmentsService', () => {
  let service: AdminV1AssessmentsService;

  beforeEach(async () => {
    const mockAudit = { logEvent: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminV1AssessmentsService,
        { provide: AdminAuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<AdminV1AssessmentsService>(AdminV1AssessmentsService);
  });

  afterEach(() => jest.clearAllMocks());

  const examLesson = {
    id: 'lesson-exam',
    contentType: 'EXAM',
    unitId: 'unit-1',
    unit: {
      id: 'unit-1',
      chapterId: 'chapter-1',
      chapter: { courseId: 'course-1' },
    },
  };

  const actor = { id: 'staff-1', organizationId: 'org-1' };

  it('publishing an EXAM assessment cascades PUBLISHED to the parent lesson chain', async () => {
    (db.assessment.findFirst as jest.Mock).mockResolvedValue({
      id: 'assess-1',
      version: 3,
      status: 'DRAFT',
      lessonId: 'lesson-exam',
      lesson: examLesson,
    });
    (db.assessment.update as jest.Mock).mockImplementation((args: any) =>
      Promise.resolve({ id: args.where.id, status: 'PUBLISHED', version: 4 }),
    );

    const result = await service.update(actor, 'assess-1', {
      titleAr: 'امتحان',
      type: 'QUIZ',
      durationMinutes: 30,
      shuffleQuestions: true,
      resultReleaseRule: 'IMMEDIATE',
      passingScore: null,
      maxAttempts: null,
      status: 'PUBLISHED',
      version: 3,
    });

    expect(result.status).toBe('PUBLISHED');
    expect(db.course.updateMany).toHaveBeenCalledWith({
      where: { id: 'course-1', status: { not: 'PUBLISHED' } },
      data: {
        status: 'PUBLISHED',
        archivedAt: null,
        version: { increment: 1 },
      },
    });
    expect(db.chapter.updateMany).toHaveBeenCalledWith({
      where: { id: 'chapter-1', status: { not: 'PUBLISHED' } },
      data: {
        status: 'PUBLISHED',
        archivedAt: null,
        version: { increment: 1 },
      },
    });
    expect(db.unit.updateMany).toHaveBeenCalledWith({
      where: { id: 'unit-1', status: { not: 'PUBLISHED' } },
      data: {
        status: 'PUBLISHED',
        archivedAt: null,
        version: { increment: 1 },
      },
    });
    expect(db.lesson.update).toHaveBeenCalledWith({
      where: { id: 'lesson-exam' },
      data: {
        status: 'PUBLISHED',
        archivedAt: null,
        version: { increment: 1 },
      },
    });
    expect(db.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assess-1' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
  });

  it('publishing a non-EXAM assessment does not touch the parent lesson', async () => {
    (db.assessment.findFirst as jest.Mock).mockResolvedValue({
      id: 'assess-2',
      version: 1,
      status: 'DRAFT',
      lessonId: 'lesson-video',
      lesson: {
        id: 'lesson-video',
        contentType: 'VIDEO',
        unit: {
          id: 'unit-2',
          chapterId: 'chapter-2',
          chapter: { courseId: 'course-2' },
        },
      },
    });
    (db.assessment.update as jest.Mock).mockImplementation((args: any) =>
      Promise.resolve({ id: args.where.id, status: 'PUBLISHED', version: 2 }),
    );

    await service.update(actor, 'assess-2', {
      titleAr: 'واجب',
      type: 'HOMEWORK',
      durationMinutes: 0,
      shuffleQuestions: false,
      resultReleaseRule: 'IMMEDIATE',
      status: 'PUBLISHED',
      version: 1,
    });

    expect(db.lesson.update).not.toHaveBeenCalled();
    expect(db.course.updateMany).not.toHaveBeenCalled();
    expect(db.chapter.updateMany).not.toHaveBeenCalled();
    expect(db.unit.updateMany).not.toHaveBeenCalled();
  });

  it('throws VERSION_CONFLICT when the version is stale', async () => {
    (db.assessment.findFirst as jest.Mock).mockResolvedValue({
      id: 'assess-1',
      version: 4,
      status: 'PUBLISHED',
      lessonId: null,
      lesson: null,
    });

    await expect(
      service.update(actor, 'assess-1', {
        titleAr: 'امتحان',
        status: 'PUBLISHED',
        version: 3,
      }),
    ).rejects.toThrow(ConflictException);
    expect(db.assessment.update).not.toHaveBeenCalled();
  });

  it('throws NotFound when the assessment does not belong to the org', async () => {
    (db.assessment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.update(actor, 'missing', {
        titleAr: 'x',
        status: 'PUBLISHED',
        version: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
