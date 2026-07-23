import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentService } from './assessment.service';
import { CatalogService } from '../catalog/catalog.service';
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
  };
  return { db: mockDbClient };
});

describe('AssessmentService', () => {
  let service: AssessmentService;
  let catalogService: CatalogService;

  beforeEach(async () => {
    const mockCatalogService = {
      hasEntitlementToCourse: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        { provide: CatalogService, useValue: mockCatalogService },
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
  });
});
