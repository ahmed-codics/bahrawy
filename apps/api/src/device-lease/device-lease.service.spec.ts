import { Test, TestingModule } from '@nestjs/testing';
import { DeviceLeaseService } from './device-lease.service';
import { db } from '@bahrawy/db';
import { ForbiddenException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    studentDevice: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    activityLease: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  return {
    db: mockDbClient,
  };
});

describe('DeviceLeaseService', () => {
  let service: DeviceLeaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeviceLeaseService],
    }).compile();
    service = module.get<DeviceLeaseService>(DeviceLeaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateOrRegisterDevice', () => {
    it('should pass if device already registered', async () => {
      (db.studentDevice.findUnique as jest.Mock).mockResolvedValue({
        id: 'dev-1',
      });
      await expect(
        service.validateOrRegisterDevice('acc-1', 'fingerprint-1'),
      ).resolves.not.toThrow();
    });

    it('should register new device if count < 2', async () => {
      (db.studentDevice.findUnique as jest.Mock).mockResolvedValue(null);
      (db.studentDevice.count as jest.Mock).mockResolvedValue(1);
      (db.studentDevice.create as jest.Mock).mockResolvedValue({ id: 'dev-2' });
      await expect(
        service.validateOrRegisterDevice('acc-1', 'fingerprint-2'),
      ).resolves.not.toThrow();
      expect(db.studentDevice.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if count >= 2', async () => {
      (db.studentDevice.findUnique as jest.Mock).mockResolvedValue(null);
      (db.studentDevice.count as jest.Mock).mockResolvedValue(2);
      await expect(
        service.validateOrRegisterDevice('acc-1', 'fingerprint-3'),
      ).rejects.toThrow(ForbiddenException);
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
