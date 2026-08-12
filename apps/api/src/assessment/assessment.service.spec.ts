import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentService } from './assessment.service';
import { CatalogService } from '../catalog/catalog.service';
import { ExamSessionService } from '../exam-session/exam-session.service';
import { db } from '@bahrawy/db';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    assessment: {
      findUnique: jest.fn(),
    },
    assessmentAttempt: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lessonProgress: {
      upsert: jest.fn(),
    },
  };
  return { db: mockDbClient };
});

describe('AssessmentService', () => {
  let service: AssessmentService;
  let catalogService: CatalogService;

  beforeEach(async () => {
    const mockCatalogService = {
      hasEntitlementToCourse: jest.fn(),
      canAccessLesson: jest.fn().mockResolvedValue(true),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        { provide: CatalogService, useValue: mockCatalogService },
        {
          provide: ExamSessionService,
          useValue: {
            prepareStart: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'session-1' }),
            attachAttempt: jest.fn().mockResolvedValue({ id: 'session-1' }),
            enforceForAttempt: jest.fn().mockResolvedValue(null),
            enforceForSubmit: jest.fn().mockResolvedValue(null),
            markSubmitted: jest.fn().mockResolvedValue(undefined),
            latestSummary: jest.fn().mockResolvedValue(null),
            sessionByAttempt: jest.fn().mockResolvedValue(null),
            reportViolationForAttempt: jest.fn().mockResolvedValue({}),
            availableGrants: jest.fn().mockResolvedValue(0),
            consumeGrant: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get<AssessmentService>(AssessmentService);
    catalogService = module.get<CatalogService>(CatalogService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('startAttempt', () => {
    it('should throw NotFoundException if assessment does not exist', async () => {
      (db.assessment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.startAttempt('acc-1', 'assess-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if student has no course entitlement', async () => {
      (db.assessment.findUnique as jest.Mock).mockResolvedValue({
        id: 'assess-1',
        status: 'PUBLISHED',
        courseId: 'course-1',
      });
      (catalogService.hasEntitlementToCourse as jest.Mock).mockResolvedValue(
        false,
      );
      await expect(
        service.startAttempt('acc-1', 'assess-1', true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates an unlimited attempt when duration is zero', async () => {
      (db.assessment.findUnique as jest.Mock).mockResolvedValue({
        id: 'assess-1',
        status: 'PUBLISHED',
        courseId: 'course-1',
        unitId: null,
        durationMinutes: 0,
        passingScore: null,
        maxAttempts: null,
      });
      (catalogService.hasEntitlementToCourse as jest.Mock).mockResolvedValue(
        true,
      );
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue(null);
      (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([]);
      (db.assessmentAttempt.create as jest.Mock).mockImplementation(
        ({ data }) => data,
      );

      const attempt = await service.startAttempt('acc-1', 'assess-1');

      expect(attempt.expiresAt).toBeNull();
    });

    it('blocks a new attempt after the configured limit', async () => {
      (db.assessment.findUnique as jest.Mock).mockResolvedValue({
        id: 'assess-1',
        status: 'PUBLISHED',
        courseId: 'course-1',
        unitId: null,
        durationMinutes: 0,
        passingScore: 70,
        maxAttempts: 1,
      });
      (catalogService.hasEntitlementToCourse as jest.Mock).mockResolvedValue(
        true,
      );
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue(null);
      (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
        { id: 'old-attempt', score: 50, submittedAt: new Date() },
      ]);

      await expect(
        service.startAttempt('acc-1', 'assess-1', true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a fresh attempt when an admin grant exists beyond maxAttempts', async () => {
      (db.assessment.findUnique as jest.Mock).mockResolvedValue({
        id: 'assess-1',
        status: 'PUBLISHED',
        courseId: 'course-1',
        unitId: null,
        durationMinutes: 0,
        passingScore: 70,
        maxAttempts: 1,
      });
      (catalogService.hasEntitlementToCourse as jest.Mock).mockResolvedValue(
        true,
      );
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue(null);
      (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
        { id: 'old-attempt', score: 50, submittedAt: new Date() },
      ]);
      const examSessionService = service['examSessionService'] as any;
      examSessionService.availableGrants.mockResolvedValue(1);
      (db.assessmentAttempt.create as jest.Mock).mockImplementation(
        ({ data }) => data,
      );

      const attempt = await service.startAttempt('acc-1', 'assess-1', true);

      expect(attempt).toBeTruthy();
      expect(attempt.unlockedByAdmin).toBe(true);
      expect(examSessionService.consumeGrant).toHaveBeenCalledWith(
        'acc-1',
        'assess-1',
        attempt.id,
      );
    });

    it('consumes the grant only once and still enforces the limit afterwards', async () => {
      (db.assessment.findUnique as jest.Mock).mockResolvedValue({
        id: 'assess-1',
        status: 'PUBLISHED',
        courseId: 'course-1',
        unitId: null,
        durationMinutes: 0,
        passingScore: 70,
        maxAttempts: 1,
      });
      (catalogService.hasEntitlementToCourse as jest.Mock).mockResolvedValue(
        true,
      );
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue(null);
      (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
        { id: 'old-attempt', score: 50, submittedAt: new Date() },
      ]);
      const examSessionService = service['examSessionService'] as any;
      examSessionService.availableGrants.mockResolvedValue(0);

      await expect(
        service.startAttempt('acc-1', 'assess-1', true),
      ).rejects.toThrow(ForbiddenException);
      expect(examSessionService.consumeGrant).not.toHaveBeenCalled();
    });

    it('returns the failed attempt result on refresh without consuming a grant', async () => {
      const failedAttempt = {
        id: 'failed-attempt',
        score: 50,
        submittedAt: new Date(),
      };
      (db.assessment.findUnique as jest.Mock).mockResolvedValue({
        id: 'assess-1',
        status: 'PUBLISHED',
        courseId: 'course-1',
        unitId: null,
        durationMinutes: 0,
        passingScore: 70,
        maxAttempts: 1,
      });
      (catalogService.hasEntitlementToCourse as jest.Mock).mockResolvedValue(
        true,
      );
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue(null);
      (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
        failedAttempt,
      ]);
      const examSessionService = service['examSessionService'] as any;
      examSessionService.availableGrants.mockResolvedValue(0);

      await expect(service.startAttempt('acc-1', 'assess-1')).resolves.toBe(
        failedAttempt,
      );
      expect(db.assessmentAttempt.create).not.toHaveBeenCalled();
      expect(examSessionService.consumeGrant).not.toHaveBeenCalled();
    });

    it('returns the latest result on refresh without consuming a new attempt', async () => {
      const submittedAttempt = {
        id: 'submitted-attempt',
        score: 80,
        submittedAt: new Date(),
      };
      (db.assessment.findUnique as jest.Mock).mockResolvedValue({
        id: 'assess-1',
        status: 'PUBLISHED',
        courseId: 'course-1',
        unitId: null,
        durationMinutes: 0,
        passingScore: null,
        maxAttempts: null,
      });
      (catalogService.hasEntitlementToCourse as jest.Mock).mockResolvedValue(
        true,
      );
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue(null);
      (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
        submittedAttempt,
      ]);

      await expect(service.startAttempt('acc-1', 'assess-1')).resolves.toBe(
        submittedAttempt,
      );
      expect(db.assessmentAttempt.create).not.toHaveBeenCalled();
    });

    it('blocks starting the quiz of a lesson locked by a previous quiz', async () => {
      (db.assessment.findUnique as jest.Mock).mockResolvedValue({
        id: 'assess-1',
        status: 'PUBLISHED',
        courseId: 'course-1',
        unitId: 'unit-1',
        lessonId: 'lesson-2',
        durationMinutes: 0,
        passingScore: 60,
        maxAttempts: null,
      });
      (catalogService.canAccessLesson as jest.Mock).mockRejectedValue(
        new ForbiddenException({
          code: 'LESSON_LOCKED',
          message: 'Pass the previous lesson exam before continuing.',
        }),
      );

      await expect(service.startAttempt('acc-1', 'assess-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(catalogService.canAccessLesson).toHaveBeenCalledWith(
        'acc-1',
        'lesson-2',
      );
      expect(db.assessmentAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('autosaveAnswers', () => {
    it('should throw BadRequestException if attempt is expired', async () => {
      (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
        id: 'att-1',
        accountId: 'acc-1',
        submittedAt: null,
        expiresAt: new Date(Date.now() - 10000),
      });
      await expect(
        service.autosaveAnswers('acc-1', 'att-1', { 'q-1': 'option-a' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows autosave when the assessment has no time limit', async () => {
      (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
        id: 'att-1',
        accountId: 'acc-1',
        submittedAt: null,
        expiresAt: null,
      });
      (db.assessmentAttempt.update as jest.Mock).mockResolvedValue({
        id: 'att-1',
      });

      await expect(
        service.autosaveAnswers('acc-1', 'att-1', {
          'q-1': 'option-a',
        }),
      ).resolves.toEqual({ id: 'att-1' });
    });
    describe('submitAttempt (end-of-lesson gate)', () => {
      it('marks the lesson completed in lessonProgress when a gate quiz is passed', async () => {
        const questions = [
          {
            questionId: 'q-1',
            question: {
              id: 'q-1',
              points: 1,
              correctOptionId: 'option-a',
              options: [
                { id: 'option-a', text: 'a' },
                { id: 'option-b', text: 'b' },
              ],
            },
          },
        ];
        (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
          id: 'att-1',
          accountId: 'acc-1',
          submittedAt: null,
          autosavedAnswers: { 'q-1': 'option-a' },
          assessment: {
            id: 'assess-1',
            type: 'END_OF_LESSON',
            lessonId: 'lesson-1',
            passingScore: 60,
            resultReleaseRule: 'IMMEDIATE',
            questions,
          },
        });
        (db.assessmentAttempt.update as jest.Mock).mockResolvedValue({
          id: 'att-1',
          accountId: 'acc-1',
          submittedAt: new Date(),
          score: 100,
          resultsReleased: true,
        });
        (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);
        (db.lessonProgress.upsert as jest.Mock).mockResolvedValue({});

        const result = await service.submitAttempt('acc-1', 'att-1');

        expect(result.passed).toBe(true);
        expect(db.lessonProgress.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              accountId_lessonId: { accountId: 'acc-1', lessonId: 'lesson-1' },
            },
          }),
        );
      });

      it('does not complete the lesson when a gate quiz is failed', async () => {
        const assessment = {
          id: 'assess-2',
          type: 'END_OF_LESSON',
          lessonId: 'lesson-1',
          passingScore: 60,
          resultReleaseRule: 'IMMEDIATE',
          questions: [
            {
              questionId: 'q-1',
              question: {
                points: 1,
                correctOptionId: 'option-a',
                options: [{ id: 'option-a' }, { id: 'option-b' }],
              },
            },
          ],
        };
        (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
          id: 'att-2',
          accountId: 'acc-1',
          submittedAt: null,
          autosavedAnswers: { 'q-1': 'option-b' },
          assessment,
        });
        (db.assessmentAttempt.update as jest.Mock).mockResolvedValue({
          id: 'att-2',
          accountId: 'acc-1',
          submittedAt: new Date(),
          score: 0,
          resultsReleased: true,
        });
        (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);

        await service.submitAttempt('acc-1', 'att-2');

        expect(db.lessonProgress.upsert).not.toHaveBeenCalled();
      });

      it('hides correct options until results are released', async () => {
        const questions = [
          {
            questionId: 'q-1',
            question: {
              points: 1,
              correctOptionId: 'option-a',
              explanation: 'x',
              options: [{ id: 'option-a' }, { id: 'option-b' }],
            },
          },
        ];
        (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
          id: 'att-3',
          accountId: 'acc-1',
          submittedAt: null,
          autosavedAnswers: { 'q-1': 'option-a' },
          assessment: {
            id: 'assess-3',
            type: 'STANDALONE',
            lessonId: null,
            passingScore: null,
            resultReleaseRule: 'LATER',
            questions,
          },
        });
        (db.assessmentAttempt.update as jest.Mock).mockResolvedValue({
          id: 'att-3',
          accountId: 'acc-1',
          submittedAt: new Date(),
          score: 100,
          resultsReleased: false,
        });
        (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);

        const result = await service.submitAttempt('acc-1', 'att-3');

        expect(
          result.assessment.questions[0].question.explanation,
        ).toBeUndefined();
      });

      it('releases the answer key when resultReleaseRule is IMMEDIATE', async () => {
        const questions = [
          {
            questionId: 'q-1',
            question: {
              points: 1,
              correctOptionId: 'option-a',
              explanation: 'ex-a',
              options: [
                { id: 'option-a', text: 'a' },
                { id: 'option-b', text: 'b' },
              ],
            },
          },
        ];
        (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
          id: 'att-imm',
          accountId: 'acc-1',
          submittedAt: null,
          autosavedAnswers: { 'q-1': 'option-a' },
          assessment: {
            id: 'assess-imm',
            type: 'STANDALONE',
            lessonId: null,
            passingScore: null,
            resultReleaseRule: 'IMMEDIATE',
            questions,
          },
        });
        (db.assessmentAttempt.update as jest.Mock).mockResolvedValue({
          id: 'att-imm',
          accountId: 'acc-1',
          submittedAt: new Date(),
          score: 100,
          resultsReleased: true,
        });
        (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);

        const result = await service.submitAttempt('acc-1', 'att-imm');

        expect(result.assessment.questions[0].question.correctOptionId).toBe(
          'option-a',
        );
        expect(result.assessment.questions[0].question.explanation).toBe(
          'ex-a',
        );
      });

      it('does not release the correct option when result release is deferred', async () => {
        const questions = [
          {
            questionId: 'q-1',
            question: {
              points: 1,
              correctOptionId: 'option-a',
              explanation: 'ex-a',
              options: [
                { id: 'option-a', text: 'a' },
                { id: 'option-b', text: 'b' },
              ],
            },
          },
        ];
        (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
          id: 'att-def',
          accountId: 'acc-1',
          submittedAt: null,
          autosavedAnswers: { 'q-1': 'option-b' },
          assessment: {
            id: 'assess-def',
            type: 'STANDALONE',
            lessonId: null,
            passingScore: null,
            resultReleaseRule: 'LATER',
            questions,
          },
        });
        (db.assessmentAttempt.update as jest.Mock).mockResolvedValue({
          id: 'att-def',
          accountId: 'acc-1',
          submittedAt: new Date(),
          score: 0,
          resultsReleased: false,
        });
        (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);

        const result = await service.submitAttempt('acc-1', 'att-def');

        expect(
          result.assessment.questions[0].question.correctOptionId,
        ).toBeUndefined();
        expect(
          result.assessment.questions[0].question.explanation,
        ).toBeUndefined();
      });

      it('throws NotFound when a student submits another student attempt', async () => {
        (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
          id: 'att-owned-by-other',
          accountId: 'other-student',
          submittedAt: null,
          autosavedAnswers: {},
          assessment: { id: 'assess-x' },
        });

        await expect(
          service.submitAttempt('acc-1', 'att-owned-by-other'),
        ).rejects.toThrow(NotFoundException);
        expect(db.assessmentAttempt.update).not.toHaveBeenCalled();
      });

      it('throws NotFound when the attempt does not exist', async () => {
        (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
          service.submitAttempt('acc-1', 'does-not-exist'),
        ).rejects.toThrow(NotFoundException);
      });

      it('returns the stored outcome when the attempt was already submitted (no double credit)', async () => {
        const questions = [
          {
            questionId: 'q-1',
            question: {
              points: 1,
              correctOptionId: 'option-a',
              explanation: 'ex-a',
              options: [{ id: 'option-a' }, { id: 'option-b' }],
            },
          },
        ];
        (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue({
          id: 'att-done',
          accountId: 'acc-1',
          submittedAt: new Date(),
          score: 100,
          resultsReleased: false,
          autosavedAnswers: { 'q-1': 'option-a' },
          assessment: {
            id: 'assess-done',
            type: 'END_OF_LESSON',
            lessonId: 'lesson-1',
            passingScore: null,
            resultReleaseRule: 'LATER',
            questions,
          },
        });
        (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);

        const result = await service.submitAttempt('acc-1', 'att-done');

        expect(
          result.assessment.questions[0].question.correctOptionId,
        ).toBeUndefined();
        expect(db.assessmentAttempt.update).not.toHaveBeenCalled();
        expect(db.lessonProgress.upsert).not.toHaveBeenCalled();
      });
    });
  });

  describe('getCurrentAttempt', () => {
    const attemptRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'attempt-1',
      accountId: 'acc-1',
      assessmentId: 'assess-1',
      examSessionId: null,
      submittedAt: null,
      score: null,
      resultsReleased: true,
      autosavedAnswers: {},
      assessment: {
        id: 'assess-1',
        passingScore: 50,
        maxAttempts: 1,
        type: 'QUIZ',
        questions: [
          {
            questionId: 'q-1',
            question: {
              points: 1,
              correctOptionId: 'option-a',
              explanation: 'ex-a',
              options: [{ id: 'option-a' }, { id: 'option-b' }],
            },
          },
        ],
      },
      ...overrides,
    });

    it('throws NotFound for another student attempt', async () => {
      (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue(
        attemptRow({ accountId: 'acc-2' }),
      );

      await expect(
        service.getCurrentAttempt('acc-1', 'attempt-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when the attempt does not exist', async () => {
      (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getCurrentAttempt('acc-1', 'attempt-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('enforces the exam session for an in-progress (unsubmitted) attempt', async () => {
      (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue(
        attemptRow({ examSessionId: 'session-1' }),
      );
      (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(0);
      const examSessionService = service['examSessionService'] as any;

      const result = await service.getCurrentAttempt('acc-1', 'attempt-1');

      expect(examSessionService.enforceForAttempt).toHaveBeenCalledWith(
        'acc-1',
        expect.objectContaining({
          id: 'attempt-1',
          examSessionId: 'session-1',
        }),
      );
      expect(result.id).toBe('attempt-1');
    });

    it('does NOT enforce the exam session for an already submitted attempt (result view stays reachable)', async () => {
      (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue(
        attemptRow({
          examSessionId: 'session-submitted',
          submittedAt: new Date('2026-08-11T06:30:33Z'),
          score: 20,
        }),
      );
      (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);
      const examSessionService = service['examSessionService'] as any;

      const result = await service.getCurrentAttempt('acc-1', 'attempt-1');

      expect(examSessionService.enforceForAttempt).not.toHaveBeenCalled();
      expect(result.id).toBe('attempt-1');
      expect(result.passed).toBe(false);
      expect(result.attemptsRemaining).toBe(0);
    });

    it('exposes an unused grant as a remaining attempt on the submitted result view', async () => {
      (db.assessmentAttempt.findUnique as jest.Mock).mockResolvedValue(
        attemptRow({
          examSessionId: 'session-submitted',
          submittedAt: new Date('2026-08-11T06:30:33Z'),
          score: 20,
        }),
      );
      (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(1);
      const examSessionService = service['examSessionService'] as any;
      examSessionService.availableGrants.mockResolvedValue(1);

      const result = await service.getCurrentAttempt('acc-1', 'attempt-1');

      expect(examSessionService.enforceForAttempt).not.toHaveBeenCalled();
      expect(result.grantedAttempts).toBe(1);
      expect(result.attemptsRemaining).toBe(1);
    });
  });
});
