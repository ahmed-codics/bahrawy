import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { db } from '@bahrawy/db';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    entitlement: {
      findFirst: jest.fn(),
    },
    productCourse: {
      findMany: jest.fn(),
    },
    coursePrerequisite: {
      findMany: jest.fn(),
    },
    lesson: {
      findUnique: jest.fn(),
    },
    unit: {
      findUnique: jest.fn(),
    },
    lessonProgress: {
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
  };
  return {
    db: mockDbClient,
  };
});

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService],
    }).compile();
    service = module.get<CatalogService>(CatalogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasEntitlementToCourse', () => {
    it('should return false if course has no products linking to it', async () => {
      (db.productCourse.findMany as jest.Mock).mockResolvedValue([]);
      const has = await service.hasEntitlementToCourse('acc-1', 'course-1');
      expect(has).toBe(false);
    });

    it('should return true if active entitlement exists', async () => {
      (db.productCourse.findMany as jest.Mock).mockResolvedValue([
        { productId: 'prod-1' },
      ]);
      (db.entitlement.findFirst as jest.Mock).mockResolvedValue({
        id: 'ent-1',
      });
      const has = await service.hasEntitlementToCourse('acc-1', 'course-1');
      expect(has).toBe(true);
    });
  });

  describe('canAccessLesson', () => {
    it('should allow staff access unconditionally', async () => {
      await expect(
        service.canAccessLesson('acc-1', 'lesson-1', true),
      ).resolves.toBe(true);
    });

    it('should throw NotFoundException if lesson does not exist', async () => {
      (db.lesson.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.canAccessLesson('acc-1', 'lesson-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if lesson is in DRAFT status', async () => {
      (db.lesson.findUnique as jest.Mock).mockResolvedValue({
        id: 'lesson-1',
        status: 'DRAFT',
      });
      await expect(
        service.canAccessLesson('acc-1', 'lesson-1', false),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUnitDetail', () => {
    it('opens every item in a purchased lesson without forcing video completion', async () => {
      (db.unit.findUnique as jest.Mock).mockResolvedValue({
        id: 'unit-1',
        chapter: { course: { id: 'course-1' } },
        lessons: [
          { id: 'video-1', contentType: 'VIDEO', titleAr: 'Video' },
          { id: 'pdf-1', contentType: 'PDF', titleAr: 'PDF' },
        ],
        assessments: [
          {
            id: 'homework-1',
            titleAr: 'Homework',
            questions: [],
            attempts: [],
          },
        ],
        productEntries: [],
      });
      (db.lessonProgress.findMany as jest.Mock).mockResolvedValue([]);
      jest
        .spyOn(service, 'getUnitAccess')
        .mockResolvedValue({ hasAccess: true, reason: 'LESSON' } as never);

      const result = await service.getUnitDetail('unit-1', 'acc-1');

      expect(result.contentItems).toHaveLength(3);
      expect(result.contentItems.every((item: any) => item.available)).toBe(
        true,
      );
    });
  });

  describe('getBundleDetail', () => {
    it('returns an assigned published course even when it has no published units', async () => {
      (db.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'bundle-1',
        type: 'BUNDLE',
        prices: [],
        courses: [
          {
            course: {
              id: 'course-1',
              titleAr: 'English | Units 1 - 6',
              status: 'PUBLISHED',
              chapters: [],
            },
          },
        ],
        unitEntries: [],
      });
      jest.spyOn(service, 'hasEntitlementToProduct').mockResolvedValue(false);

      const result = await service.getBundleDetail(
        'bundle-1',
        'account-1',
        false,
      );

      expect(result.courses).toEqual([
        expect.objectContaining({
          id: 'course-1',
          titleAr: 'English | Units 1 - 6',
          unitCount: 0,
        }),
      ]);
      expect(result.units).toEqual([]);
    });
  });
});
