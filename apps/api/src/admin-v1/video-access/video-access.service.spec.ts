import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { db } from '@bahrawy/db';
import { AdminAuditService } from '../common/services/audit.service';
import { VideoAccessService } from '../../video-access/video-access.grants.service';
import { NotificationService } from '../../notification/notification.service';
import { VideoAccessMailerService } from '../../video-access/video-access.mailer';
import { SecurityService } from '../../security/security.service';
import { AdminV1VideoAccessService } from './video-access.service';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    videoAccessRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    grade: { findMany: jest.fn() },
    studentProfile: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  return { db: mockDbClient };
});

describe('AdminV1VideoAccessService', () => {
  let service: AdminV1VideoAccessService;
  let grants: VideoAccessService;
  let audit: AdminAuditService;

  const actor = { id: 'admin-1', organizationId: 'org-1', kind: 'STAFF' };
  const pendingRequest = {
    id: 'req-1',
    status: 'PENDING',
    organizationId: 'org-1',
    accountId: 'acc-1',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    videoId: 'video-1',
    sessionId: null,
    requestedEmail: 'student@bahrawy.test',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminV1VideoAccessService,
        {
          provide: AdminAuditService,
          useValue: { logEvent: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: VideoAccessService,
          useValue: {
            resolveDuration: jest.fn(),
            revoke: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: { create: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: VideoAccessMailerService,
          useValue: {
            notifyStudentOfApproval: jest.fn().mockResolvedValue(undefined),
            notifyStudentOfRejection: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SecurityService,
          useValue: { decrypt: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AdminV1VideoAccessService>(AdminV1VideoAccessService);
    grants = module.get<VideoAccessService>(VideoAccessService);
    audit = module.get<AdminAuditService>(AdminAuditService);
  });

  describe('approve', () => {
    it('throws NotFoundException when the request is missing', async () => {
      (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.approve(actor, 'missing', { durationType: 'ONE_DAY' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the request is not pending', async () => {
      (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue({
        ...pendingRequest,
        status: 'APPROVED',
      });
      await expect(
        service.approve(actor, 'req-1', { durationType: 'ONE_DAY' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a grant, approves the request, audits and notifies', async () => {
      (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue(
        pendingRequest,
      );
      (grants.resolveDuration as jest.Mock).mockResolvedValue({
        expiresAt: new Date('2026-01-02T00:00:00Z'),
        durationType: 'ONE_DAY',
      });
      (db.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        const tx = {
          videoAccessGrant: {
            create: jest.fn().mockResolvedValue({ id: 'grant-1' }),
          },
          videoAccessRequest: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      (db.studentProfile.findUnique as jest.Mock).mockResolvedValue({
        displayName: 'طالب تجريبي',
      });
      (db.lesson.findUnique as jest.Mock).mockResolvedValue({
        titleAr: 'درس تجريبي',
      });

      const result = await service.approve(actor, 'req-1', {
        durationType: 'ONE_DAY',
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'req-1',
          status: 'APPROVED',
          grantId: 'grant-1',
          durationType: 'ONE_DAY',
        }),
      );
      expect(audit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ADMIN_VIDEO_ACCESS_APPROVE' }),
      );
    });

    it('defaults the duration to SESSION when none provided', async () => {
      (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue(
        pendingRequest,
      );
      (grants.resolveDuration as jest.Mock).mockResolvedValue({
        expiresAt: null,
        durationType: 'SESSION',
      });
      (db.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        const tx = {
          videoAccessGrant: {
            create: jest.fn().mockResolvedValue({ id: 'grant-1' }),
          },
          videoAccessRequest: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      await service.approve(actor, 'req-1', {});
      expect(grants.resolveDuration).toHaveBeenCalledWith('SESSION', null);
    });
  });

  describe('reject', () => {
    it('throws ConflictException when the request is not pending', async () => {
      (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue({
        ...pendingRequest,
        status: 'REJECTED',
      });
      await expect(
        service.reject(actor, 'req-1', { reason: 'ن' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates the request to REJECTED and audits', async () => {
      (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue(
        pendingRequest,
      );
      (db.videoAccessRequest.update as jest.Mock).mockResolvedValue({});
      (db.studentProfile.findUnique as jest.Mock).mockResolvedValue({
        displayName: 'طالب تجريبي',
      });
      (db.lesson.findUnique as jest.Mock).mockResolvedValue({
        titleAr: 'درس تجريبي',
      });

      const result = await service.reject(actor, 'req-1', {
        reason: 'سبب الرفض',
      });
      expect(result).toEqual({ id: 'req-1', status: 'REJECTED' });
      expect(db.videoAccessRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: expect.objectContaining({ status: 'REJECTED' }),
      });
      expect(audit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ADMIN_VIDEO_ACCESS_REJECT' }),
      );
    });
  });

  describe('revoke', () => {
    it('delegates to the grants service and audits', async () => {
      (grants.revoke as jest.Mock).mockResolvedValue({
        id: 'grant-1',
        revokedAt: new Date(),
      });
      const result = await service.revoke(actor, 'grant-1', 'cause');
      expect(result).toEqual({ id: 'grant-1', status: 'REVOKED' });
      expect(grants.revoke).toHaveBeenCalledWith(actor, 'grant-1', 'cause');
      expect(audit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ADMIN_VIDEO_ACCESS_REVOKE' }),
      );
    });
  });

  describe('list', () => {
    it('paginates and maps student info with grade names', async () => {
      (db.videoAccessRequest.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'req-1',
          status: 'PENDING',
          requestedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: null,
          grantExpiresAt: null,
          requestedEmail: 'student@bahrawy.test',
          accountId: 'acc-1',
          courseId: 'course-1',
          lessonId: 'lesson-1',
          videoId: 'video-1',
          account: {
            id: 'acc-1',
            studentProfile: {
              displayName: 'طالب',
              studentNumber: 7,
              gradeId: 'grade-1',
            },
          },
        },
      ]);
      (db.grade.findMany as jest.Mock).mockResolvedValue([
        { id: 'grade-1', nameAr: 'الصف الأول' },
      ]);
      const result = await service.list('org-1', { page: 1, pageSize: 10 });
      expect(result.meta.total).toBe(1);
      expect(result.items[0].student.gradeName).toBe('الصف الأول');
      expect(result.grades).toHaveLength(1);
    });

    it('filters by status', async () => {
      await service.list('org-1', { status: 'PENDING' });
      expect(db.videoAccessRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            status: 'PENDING',
          }),
        }),
      );
    });
  });

  describe('stats', () => {
    it('counts pending, approved and rejected', async () => {
      (db.videoAccessRequest.count as jest.Mock).mockResolvedValue(3);
      const stats = await service.stats('org-1');
      expect(stats).toEqual({ pending: 3, approved: 3, rejected: 3 });
    });
  });
});
