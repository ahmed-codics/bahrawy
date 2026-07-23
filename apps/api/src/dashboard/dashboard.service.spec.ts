import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { db } from '@bahrawy/db';
import { NotFoundException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    studentProfile: {
      findUnique: jest.fn(),
    },
    guardianProfile: {
      findUnique: jest.fn(),
    },
    studentGuardian: {
      findMany: jest.fn(),
    },
    entitlement: {
      findMany: jest.fn(),
    },
    lessonProgress: {
      count: jest.fn(),
    },
    inAppNotification: {
      findMany: jest.fn(),
    },
    account: {
      count: jest.fn(),
    },
    paymentOrder: {
      count: jest.fn(),
    },
    supportTicket: {
      count: jest.fn(),
    },
  };
  return { db: mockDbClient };
});

import { SecurityService } from '../security/security.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: SecurityService,
          useValue: {
            generatePhoneHmac: jest.fn(),
            hashPassword: jest.fn(),
            encrypt: jest.fn(),
            decrypt: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getStudentDashboard', () => {
    it('should throw NotFoundException if student profile not found', async () => {
      (db.studentProfile.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getStudentDashboard('acc-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return profile and entitlements if profile exists', async () => {
      (db.studentProfile.findUnique as jest.Mock).mockResolvedValue({
        displayName: 'Ali',
      });
      (db.entitlement.findMany as jest.Mock).mockResolvedValue([]);
      (db.inAppNotification.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getStudentDashboard('acc-1');
      expect(result.profile.displayName).toBe('Ali');
      expect(result.enrolledCourses).toHaveLength(0);
    });
  });

  describe('getStaffDashboard', () => {
    it('should retrieve metrics counts from DB', async () => {
      (db.account.count as jest.Mock).mockResolvedValue(100);
      (db.paymentOrder.count as jest.Mock).mockResolvedValue(5);
      (db.supportTicket.count as jest.Mock).mockResolvedValue(3);
      const dashboard = await service.getStaffDashboard();
      expect(dashboard.metrics.activeStudents).toBe(100);
      expect(dashboard.metrics.pendingPayments).toBe(5);
      expect(dashboard.metrics.openTickets).toBe(3);
    });
  });
});
