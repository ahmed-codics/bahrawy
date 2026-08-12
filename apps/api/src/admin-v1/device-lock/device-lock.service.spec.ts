import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { DeviceLeaseService } from '../../device-lease/device-lease.service';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1DeviceLockService } from './device-lock.service';

jest.mock('@bahrawy/db', () => {
  const db: any = {
    studentProfile: { findMany: jest.fn() },
    grade: { findMany: jest.fn() },
    studentDevice: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    deviceBlock: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: any) => Promise<any>) =>
      callback(db),
    ),
  };
  return { db };
});

describe('AdminV1DeviceLockService', () => {
  const audit = { logEvent: jest.fn() };
  const deviceLease = {
    promoteDevice: jest.fn().mockResolvedValue(undefined),
    resetStudentDevices: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AdminV1DeviceLockService(
    deviceLease as unknown as DeviceLeaseService,
    audit as unknown as AdminAuditService,
  );
  const actor = { id: 'staff-1', organizationId: 'org-1' };

  const blockedAccount = {
    id: 'student-1',
    organizationId: 'org-1',
    kind: 'STUDENT',
    status: 'DEVICE_BLOCKED',
    deletedAt: null,
    version: 2,
    studentProfile: {
      id: 'sp-1',
      displayName: 'أحمد محمد',
      studentNumber: 10200,
    },
  };

  beforeEach(() => jest.clearAllMocks());

  describe('list', () => {
    it('returns blocked students with masked fingerprints and meta', async () => {
      (db.studentProfile.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'sp-1',
          studentNumber: 10200,
          displayName: 'أحمد محمد',
          gradeId: 'grade-1',
          account: {
            id: 'student-1',
            status: 'DEVICE_BLOCKED',
            version: 2,
            createdAt: new Date('2026-08-01T10:00:00Z'),
            updatedAt: new Date('2026-08-01T10:00:00Z'),
          },
        },
      ]);
      (db.grade.findMany as jest.Mock).mockResolvedValue([
        { id: 'grade-1', nameAr: 'الصف الثالث الثانوي' },
      ]);
      (db.studentDevice.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'dev-primary',
          accountId: 'student-1',
          deviceFingerprint: 'primary-fingerprint-123456',
          label: 'Chrome / Mac',
          lastUsedAt: new Date('2026-08-01T09:00:00Z'),
        },
      ]);
      (db.deviceBlock.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'block-1',
          accountId: 'student-1',
          deviceFingerprint: 'unknown-fingerprint-abcdef',
          reason: 'UNKNOWN_DEVICE',
          blockedAt: new Date('2026-08-01T10:00:00Z'),
          resolvedAt: null,
          resolution: null,
        },
      ]);

      const result = await service.list('org-1', {
        search: '',
        page: 1,
        pageSize: 25,
      });

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.accountId).toBe('student-1');
      expect(item.primaryDevice.fingerprint).toBe('primary-fi…3456');
      expect(item.attemptedDevice.fingerprint).toBe('unknown-f…bcdef');
      expect(item.blockReason).toBe('UNKNOWN_DEVICE');
      expect(result.meta.total).toBe(1);
      expect(result.grades).toEqual([
        { id: 'grade-1', nameAr: 'الصف الثالث الثانوي' },
      ]);
    });
  });

  describe('unlock', () => {
    it('sets ACTIVE, resolves open blocks and audits', async () => {
      (db.account.findFirst as jest.Mock).mockResolvedValue(blockedAccount);
      (db.account.update as jest.Mock).mockResolvedValue({
        id: 'student-1',
        status: 'ACTIVE',
        version: 3,
      });
      (db.deviceBlock.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.unlock(actor, 'student-1');

      expect(result.status).toBe('ACTIVE');
      expect(db.account.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      });
      expect(db.deviceBlock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resolvedAt: null }),
        }),
      );
      expect(audit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STUDENT_DEVICE_UNLOCK',
          actorId: 'staff-1',
        }),
      );
    });

    it('rejects a student that is not DEVICE_BLOCKED', async () => {
      (db.account.findFirst as jest.Mock).mockResolvedValue({
        ...blockedAccount,
        status: 'ACTIVE',
      });
      await expect(service.unlock(actor, 'student-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(db.account.update).not.toHaveBeenCalled();
    });

    it('rejects an account in another organization', async () => {
      (db.account.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.unlock(actor, 'student-other')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.account.update).not.toHaveBeenCalled();
    });
  });

  describe('allowDevice', () => {
    it('promotes the attempted device, activates the account and audits', async () => {
      (db.account.findFirst as jest.Mock).mockResolvedValue(blockedAccount);
      (db.deviceBlock.findFirst as jest.Mock).mockResolvedValue({
        id: 'block-1',
        deviceFingerprint: 'fp-attempted',
        reason: 'UNKNOWN_DEVICE',
        blockedAt: new Date(),
        resolvedAt: null,
      });
      (db.account.update as jest.Mock).mockResolvedValue({
        id: 'student-1',
        status: 'ACTIVE',
        version: 3,
      });
      (db.deviceBlock.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.allowDevice(actor, 'student-1');

      expect(deviceLease.promoteDevice).toHaveBeenCalledWith(
        'student-1',
        'fp-attempted',
      );
      expect(result.status).toBe('ACTIVE');
      expect(audit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STUDENT_DEVICE_ALLOW' }),
      );
    });

    it('fails when there is no pending device block to allow', async () => {
      (db.account.findFirst as jest.Mock).mockResolvedValue(blockedAccount);
      (db.deviceBlock.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.allowDevice(actor, 'student-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(deviceLease.promoteDevice).not.toHaveBeenCalled();
    });
  });

  describe('resetPrimary', () => {
    it('clears devices, activates the account and audits', async () => {
      (db.account.findFirst as jest.Mock).mockResolvedValue(blockedAccount);
      (db.studentDevice.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (db.account.update as jest.Mock).mockResolvedValue({
        id: 'student-1',
        status: 'ACTIVE',
        version: 3,
      });
      (db.deviceBlock.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.resetPrimary(actor, 'student-1');

      expect(db.studentDevice.deleteMany).toHaveBeenCalledWith({
        where: { accountId: 'student-1' },
      });
      expect(result.status).toBe('ACTIVE');
      expect(audit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STUDENT_DEVICE_RESET_PRIMARY' }),
      );
    });
  });
});