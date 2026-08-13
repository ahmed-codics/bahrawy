import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { SecurityService } from '../security/security.service';
import { AdminAuditService } from '../admin-v1/common/services/audit.service';
import { OfflineCodesService } from './offline-codes.service';

jest.mock('@bahrawy/db', () => {
  const db: any = {
    course: { findFirst: jest.fn(), findUnique: jest.fn() },
    grade: { findFirst: jest.fn() },
    offlineAccessCode: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    offlineAccessCodeBatch: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    productCourse: { findFirst: jest.fn() },
    product: { create: jest.fn() },
    entitlement: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((callback: (tx: any) => Promise<any>) =>
      callback(db),
    ),
  };
  return { db };
});

describe('OfflineCodesService', () => {
  const security = new SecurityService();
  const audit = { logEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new OfflineCodesService(
    security,
    audit as unknown as AdminAuditService,
  );
  const actor = { id: 'staff-1', organizationId: 'org-1' };

  beforeEach(() => jest.clearAllMocks());

  describe('generateCodes', () => {
    it('creates a batch and the requested number of unique codes', async () => {
      (db.course.findFirst as jest.Mock).mockResolvedValue({
        id: 'course-1',
        titleAr: 'كورس',
      });
      (db.offlineAccessCodeBatch.create as jest.Mock).mockResolvedValue({
        id: 'batch-1',
        quantity: 3,
        courseId: 'course-1',
        gradeId: null,
        maxUses: 1,
        expiresAt: null,
        createdAt: new Date(),
      });
      const createdIds = ['c1', 'c2', 'c3'];
      (db.offlineAccessCode.create as jest.Mock).mockImplementation(
        (args: any) =>
          Promise.resolve({ id: createdIds.shift() ?? 'c', ...args.data }),
      );

      const result = await service.generateCodes(actor, {
        quantity: 3,
        courseId: 'course-1',
      });

      expect(result.codes).toHaveLength(3);
      expect(result.batch.id).toBe('batch-1');
      expect(new Set(result.codes.map((c) => c.code)).size).toBe(3);
      for (const item of result.codes) {
        expect(item.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      }
      expect(db.offlineAccessCodeBatch.create).toHaveBeenCalledTimes(1);
      expect(db.offlineAccessCode.create).toHaveBeenCalledTimes(3);
      expect(audit.logEvent).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when the course is outside the organization', async () => {
      (db.course.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.generateCodes(actor, { quantity: 1, courseId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
      expect(db.offlineAccessCodeBatch.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid expiry date', async () => {
      (db.course.findFirst as jest.Mock).mockResolvedValue({
        id: 'course-1',
      });
      await expect(
        service.generateCodes(actor, {
          quantity: 1,
          courseId: 'course-1',
          expiresAt: 'not-a-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listCodes', () => {
    it('returns paginated codes with masked values and derived statuses', async () => {
      (db.offlineAccessCode.count as jest.Mock).mockResolvedValue(1);
      (db.offlineAccessCode.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'c1',
          codePrefix: 'ABCD',
          status: 'ACTIVE',
          courseId: 'course-1',
          gradeId: null,
          batchId: 'batch-1',
          maxUses: 1,
          useCount: 0,
          expiresAt: null,
          activatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          accountId: null,
          createdByAccountId: 'staff-1',
          account: null,
        },
      ]);

      const result = await service.listCodes('org-1', {
        page: 1,
        pageSize: 25,
      });

      expect(result.total).toBe(1);
      expect(result.items[0].code).toContain('****');
      expect(result.items[0].status).toBe('ACTIVE');
    });

    it('derives EXPIRED for active codes past expiry', async () => {
      (db.offlineAccessCode.count as jest.Mock).mockResolvedValue(1);
      (db.offlineAccessCode.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'c1',
          codePrefix: 'ABCD',
          status: 'ACTIVE',
          courseId: 'course-1',
          gradeId: null,
          batchId: 'batch-1',
          maxUses: 1,
          useCount: 0,
          expiresAt: new Date(Date.now() - 1000),
          activatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          accountId: null,
          createdByAccountId: 'staff-1',
          account: null,
        },
      ]);

      const result = await service.listCodes('org-1', {
        page: 1,
        pageSize: 25,
      });
      expect(result.items[0].status).toBe('EXPIRED');
    });
  });

  describe('bulkSetCodeStatus', () => {
    it('throws NotFoundException if any code is missing', async () => {
      (db.offlineAccessCode.findMany as jest.Mock).mockResolvedValue([
        { id: 'c1' },
      ]);
      await expect(
        service.bulkSetCodeStatus(actor, ['c1', 'c2'], 'DISABLED'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('activateCode', () => {
    const activeCode = {
      id: 'code-1',
      organizationId: 'org-1',
      codeHash: 'hash',
      status: 'ACTIVE',
      maxUses: 1,
      useCount: 0,
      accountId: null,
      expiresAt: null,
      courseId: 'course-1',
    };

    beforeEach(() => {
      (db.offlineAccessCode.findFirst as jest.Mock).mockResolvedValue(
        activeCode,
      );
    });

    it('activates a valid code and creates the course entitlement', async () => {
      (db.offlineAccessCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (db.productCourse.findFirst as jest.Mock).mockResolvedValue({
        product: { id: 'product-1' },
      });
      (db.entitlement.findFirst as jest.Mock).mockResolvedValue(null);
      (db.entitlement.create as jest.Mock).mockResolvedValue({ id: 'ent-1' });
      (db.offlineAccessCode.update as jest.Mock).mockResolvedValue({
        ...activeCode,
        status: 'USED',
        useCount: 1,
        accountId: 'student-1',
      });

      const result = await service.activateCode('student-1', 'org-1', {
        code: 'ABCD-EFGH-JKLM',
      });

      expect(result.courseId).toBe('course-1');
      expect(result.productId).toBe('product-1');
      expect(db.entitlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'student-1',
            productId: 'product-1',
            status: 'ACTIVE',
          }),
        }),
      );
      expect(audit.logEvent).toHaveBeenCalledTimes(1);
    });

    it('rejects an unknown code with a generic error', async () => {
      (db.offlineAccessCode.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.activateCode('student-1', 'org-1', {
          code: 'WXYZ-XXXX-XXXX',
        }),
      ).rejects.toThrow('الكود غير صحيح');
    });

    it('rejects a disabled code', async () => {
      (db.offlineAccessCode.findFirst as jest.Mock).mockResolvedValue({
        ...activeCode,
        status: 'DISABLED',
      });
      await expect(
        service.activateCode('student-1', 'org-1', {
          code: 'ABCD-EFGH-JKLM',
        }),
      ).rejects.toThrow('الكود غير مفعل');
    });

    it('rejects an already-used single-use code', async () => {
      (db.offlineAccessCode.findFirst as jest.Mock).mockResolvedValue({
        ...activeCode,
        status: 'USED',
        accountId: 'other-student',
      });
      await expect(
        service.activateCode('student-1', 'org-1', {
          code: 'ABCD-EFGH-JKLM',
        }),
      ).rejects.toThrow('الكود مستخدم بالفعل');
    });

    it('rejects an expired code', async () => {
      (db.offlineAccessCode.findFirst as jest.Mock).mockResolvedValue({
        ...activeCode,
        expiresAt: new Date(Date.now() - 5000),
      });
      await expect(
        service.activateCode('student-1', 'org-1', {
          code: 'ABCD-EFGH-JKLM',
        }),
      ).rejects.toThrow('انتهت صلاحية الكود');
    });

    it('throws ConflictException when the race guard update consumes zero rows', async () => {
      (db.offlineAccessCode.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      await expect(
        service.activateCode('student-1', 'org-1', {
          code: 'ABCD-EFGH-JKLM',
        }),
      ).rejects.toThrow(ConflictException);
      expect(db.entitlement.create).not.toHaveBeenCalled();
    });

    it('reuses an existing course product instead of creating a new one', async () => {
      (db.offlineAccessCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (db.productCourse.findFirst as jest.Mock).mockResolvedValue({
        product: { id: 'product-1' },
      });
      (db.entitlement.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-ent',
      });

      await service.activateCode('student-1', 'org-1', {
        code: 'ABCD-EFGH-JKLM',
      });

      expect(db.product.create).not.toHaveBeenCalled();
      expect(db.entitlement.create).not.toHaveBeenCalled();
    });
  });

  describe('bulkDeleteCodes', () => {
    it('refuses to delete used codes', async () => {
      (db.offlineAccessCode.findMany as jest.Mock).mockResolvedValue([
        { id: 'c1', useCount: 1, accountId: 's1' },
      ]);
      await expect(service.bulkDeleteCodes(actor, ['c1'])).rejects.toThrow(
        ConflictException,
      );
      expect(db.offlineAccessCode.updateMany).not.toHaveBeenCalled();
    });

    it('soft-deletes unused codes', async () => {
      (db.offlineAccessCode.findMany as jest.Mock).mockResolvedValue([
        { id: 'c1', useCount: 0, accountId: null },
      ]);
      (db.offlineAccessCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkDeleteCodes(actor, ['c1']);
      expect(result.count).toBe(1);
      expect(db.offlineAccessCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('exportBatch', () => {
    it('decrypts and formats codes into display groups', async () => {
      const raw = 'ABCDEFGHJKLM';
      const encrypted = security.encrypt(raw);
      (db.offlineAccessCodeBatch.findFirst as jest.Mock).mockResolvedValue({
        id: 'batch-1',
        course: { titleAr: 'كورس' },
        grade: null,
        createdAt: new Date(),
        quantity: 1,
        codes: [
          {
            id: 'c1',
            codeEncrypted: encrypted,
            status: 'ACTIVE',
            accountId: null,
            useCount: 0,
            maxUses: 1,
            createdAt: new Date(),
          },
        ],
      });

      const result = await service.exportBatch('org-1', 'batch-1');
      expect(result.codes[0].code).toBe('ABCD-EFGH-JKLM');
    });

    it('throws NotFoundException for a missing batch', async () => {
      (db.offlineAccessCodeBatch.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(service.exportBatch('org-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
