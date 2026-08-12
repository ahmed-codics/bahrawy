import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { db } from '@bahrawy/db';
import { CatalogService } from '../../catalog/catalog.service';
import { AdminV1StudentProgressService } from './student-progress.service';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    account: { findUnique: jest.fn() },
    course: { findMany: jest.fn() },
    lessonProgress: { findMany: jest.fn() },
    assessment: { findMany: jest.fn() },
    assessmentAttempt: { findMany: jest.fn() },
  };
  return { db: mockDbClient };
});

describe('AdminV1StudentProgressService', () => {
  let service: AdminV1StudentProgressService;
  let catalogService: CatalogService;

  beforeEach(async () => {
    const mockCatalogService = {
      computeLessonLocks: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminV1StudentProgressService,
        { provide: CatalogService, useValue: mockCatalogService },
      ],
    }).compile();
    service = module.get<AdminV1StudentProgressService>(
      AdminV1StudentProgressService,
    );
    catalogService = module.get<CatalogService>(CatalogService);
  });

  afterEach(() => jest.clearAllMocks());

  const account = {
    id: 'acc-1',
    kind: 'STUDENT',
    deletedAt: null,
    organizationId: 'org-1',
    studentProfile: {
      displayName: 'طالب',
      studentNumber: 1,
      grade: { id: 'g-1', nameAr: 'صف' },
    },
  };

  const course = [
    {
      id: 'course-1',
      titleAr: 'English',
      chapters: [
        {
          id: 'chapter-1',
          titleAr: 'فصل',
          units: [
            {
              id: 'unit-1',
              titleAr: 'وحدة',
              lessons: [
                {
                  id: 'lesson-1',
                  titleAr: 'الأول',
                  contentType: 'VIDEO',
                  durationSeconds: 100,
                },
                {
                  id: 'lesson-2',
                  titleAr: 'الثاني',
                  contentType: 'VIDEO',
                  durationSeconds: 200,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  it('throws NotFoundException when the student does not belong to the organization', async () => {
    (db.account.findUnique as jest.Mock).mockResolvedValue({
      ...account,
      organizationId: 'other-org',
    });
    await expect(service.progress('org-1', 'acc-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('computes LOCKED / NOT_STARTED / IN_PROGRESS / QUIZ_PENDING / PASSED statuses', async () => {
    (db.account.findUnique as jest.Mock).mockResolvedValue(account);
    (db.course.findMany as jest.Mock).mockResolvedValue(course);
    (db.lessonProgress.findMany as jest.Mock).mockResolvedValue([
      {
        lessonId: 'lesson-1',
        watchedSeconds: 50,
        durationSeconds: 100,
        completedAt: null,
      },
    ]);
    (db.assessment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'gate-1',
        lessonId: 'lesson-1',
        passingScore: 60,
      },
    ]);
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      { assessmentId: 'gate-1', score: 80 },
    ]);
    (catalogService.computeLessonLocks as jest.Mock).mockResolvedValue(
      new Map([
        ['lesson-1', { locked: false }],
        [
          'lesson-2',
          { locked: true, requiredAssessmentId: 'gate-1', requiredScore: 60 },
        ],
      ]),
    );

    const result = await service.progress('org-1', 'acc-1');

    const lessons = result.courses[0].chapters[0].units[0].lessons;
    expect(lessons[0].status).toBe('PASSED');
    expect(lessons[0].quiz).toEqual({
      assessmentId: 'gate-1',
      requiredScore: 60,
      lastScore: 80,
      passed: true,
    });
    expect(lessons[1].status).toBe('LOCKED');
    expect(lessons[1].gate).toEqual(
      expect.objectContaining({ requiredAssessmentId: 'gate-1' }),
    );
    expect(result.summary).toEqual({
      totalLessons: 2,
      notStarted: 0,
      inProgress: 0,
      quizPending: 0,
      failed: 0,
      passed: 1,
      locked: 1,
    });
  });

  it('marks a submitted below-passing quiz as FAILED', async () => {
    (db.account.findUnique as jest.Mock).mockResolvedValue(account);
    (db.course.findMany as jest.Mock).mockResolvedValue(course);
    (db.lessonProgress.findMany as jest.Mock).mockResolvedValue([]);
    (db.assessment.findMany as jest.Mock).mockResolvedValue([
      { id: 'gate-1', lessonId: 'lesson-1', passingScore: 60 },
    ]);
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      { assessmentId: 'gate-1', score: 40 },
    ]);
    (catalogService.computeLessonLocks as jest.Mock).mockResolvedValue(
      new Map([
        ['lesson-1', { locked: false }],
        ['lesson-2', { locked: false }],
      ]),
    );

    const result = await service.progress('org-1', 'acc-1');
    const lessons = result.courses[0].chapters[0].units[0].lessons;
    expect(lessons[0].status).toBe('FAILED');
    expect(result.summary.failed).toBe(1);
  });
});
