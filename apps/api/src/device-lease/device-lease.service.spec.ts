import { Test, TestingModule } from '@nestjs/testing';
import { DeviceLeaseService } from './device-lease.service';
import { db } from '@bahrawy/db';
import { ForbiddenException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const db: any = {
    studentDevice: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    deviceBlock: {
      create: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    authSession: {
      updateMany: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    },
    activityLease: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: any) => Promise<any>) =>
      callback(db),
    ),
  };
  return { db };
});

const account = {
  id: 'acc-1',
  status: 'ACTIVE',
  organizationId: 'org-1',
};

describe('DeviceLeaseService', () => {
  let service: DeviceLeaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeviceLeaseService],
    }).compile();
    service = module.get<DeviceLeaseService>(DeviceLeaseService);
    jest.clearAllMocks();
  });

  describe('validateOrRegisterDevice', () => {
    it('passes when the device is the known primary and refreshes lastUsedAt', async () => {
      (db.studentDevice.findUnique as jest.Mock).mockResolvedValue({
        id: 'dev-1',
        isPrimary: true,
      });
      await expect(
        service.validateOrRegisterDevice(account, 'fp-1'),
      ).resolves.not.toThrow();
      expect(db.studentDevice.update).toHaveBeenCalledWith({
        where: { id: 'dev-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('registers the first device as primary for a fresh account', async () => {
      (db.studentDevice.findUnique as jest.Mock).mockResolvedValue(null);
      (db.studentDevice.findFirst as jest.Mock).mockResolvedValue(null);
      (db.studentDevice.create as jest.Mock).mockResolvedValue({
        id: 'dev-2',
      });
      await expect(
        service.validateOrRegisterDevice(account, 'fp-2'),
      ).resolves.not.toThrow();
      expect(db.studentDevice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'acc-1',
          deviceFingerprint: 'fp-2',
          isPrimary: true,
        }),
      });
    });

    it('blocks the account when a different device logs in', async () => {
      (db.studentDevice.findUnique as jest.Mock).mockResolvedValue(null);
      (db.studentDevice.findFirst as jest.Mock).mockResolvedValue({
        id: 'dev-1',
        deviceFingerprint: 'fp-primary',
        isPrimary: true,
      });
      (db.studentDevice.upsert as jest.Mock).mockResolvedValue({
        id: 'dev-3',
      });
      (db.deviceBlock.create as jest.Mock).mockResolvedValue({});
      (db.account.findUnique as jest.Mock).mockResolvedValue({
        status: 'ACTIVE',
      });
      (db.account.update as jest.Mock).mockResolvedValue({
        status: 'DEVICE_BLOCKED',
      });
      (db.authSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (db.auditEvent.create as jest.Mock).mockResolvedValue({});
      (db.securityEvent.create as jest.Mock).mockResolvedValue({});

      await expect(
        service.validateOrRegisterDevice(account, 'fp-3'),
      ).rejects.toThrow(ForbiddenException);

      expect(db.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: expect.objectContaining({ status: 'DEVICE_BLOCKED' }),
      });
      expect(db.authSession.updateMany).toHaveBeenCalledWith({
        where: { accountId: 'acc-1', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'DEVICE_BLOCKED' }),
      });
      expect(db.deviceBlock.create).toHaveBeenCalled();
      expect(db.auditEvent.create).toHaveBeenCalled();
      expect(db.securityEvent.create).toHaveBeenCalled();
    });

    it('blocks the account when a non-primary existing device is used', async () => {
      (db.studentDevice.findUnique as jest.Mock).mockResolvedValue({
        id: 'dev-legacy',
        isPrimary: false,
      });
      (db.studentDevice.upsert as jest.Mock).mockResolvedValue({
        id: 'dev-legacy',
      });
      (db.deviceBlock.create as jest.Mock).mockResolvedValue({});
      (db.account.findUnique as jest.Mock).mockResolvedValue({
        status: 'ACTIVE',
      });
      (db.account.update as jest.Mock).mockResolvedValue({});
      (db.authSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (db.auditEvent.create as jest.Mock).mockResolvedValue({});
      (db.securityEvent.create as jest.Mock).mockResolvedValue({});

      await expect(
        service.validateOrRegisterDevice(account, 'fp-legacy'),
      ).rejects.toThrow(ForbiddenException);
      expect(db.account.update).toHaveBeenCalled();
    });
  });

  describe('blockAccountForDevice', () => {
    it('is idempotent for an already-blocked account (still throws)', async () => {
      (db.studentDevice.upsert as jest.Mock).mockResolvedValue({
        id: 'dev-x',
      });
      (db.deviceBlock.create as jest.Mock).mockResolvedValue({});
      (db.account.findUnique as jest.Mock).mockResolvedValue({
        status: 'DEVICE_BLOCKED',
      });
      (db.securityEvent.create as jest.Mock).mockResolvedValue({});

      await expect(
        service.blockAccountForDevice(account, 'fp-x', 'UNKNOWN_DEVICE'),
      ).rejects.toThrow(ForbiddenException);
      expect(db.account.update).not.toHaveBeenCalled();
      expect(db.authSession.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('promoteDevice', () => {
    it('demotes other devices and promotes the allowed device as primary', async () => {
      (db.studentDevice.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (db.studentDevice.upsert as jest.Mock).mockResolvedValue({});
      await expect(
        service.promoteDevice('acc-1', 'fp-allowed', 'label'),
      ).resolves.not.toThrow();
      expect(db.studentDevice.updateMany).toHaveBeenCalledWith({
        where: { accountId: 'acc-1', isPrimary: true },
        data: { isPrimary: false },
      });
      expect(db.studentDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            accountId: 'acc-1',
            deviceFingerprint: 'fp-allowed',
            isPrimary: true,
            label: 'label',
          }),
        }),
      );
    });
  });

  describe('acquireLease', () => {
    it('should acquire lease if no active lease exists', async () => {
      (db.activityLease.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.acquireLease('acc-1', 'sess-1', 'fp-1', 'LEARNING'),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException if active lease exists for other device', async () => {
      const active = {
        sessionId: 'sess-2',
        deviceFingerprint: 'fp-2',
        expiresAt: new Date(Date.now() + 10000),
      };
      (db.activityLease.findUnique as jest.Mock).mockResolvedValue(active);
      await expect(
        service.acquireLease('acc-1', 'sess-1', 'fp-1', 'LEARNING'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});