import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { db } from '@bahrawy/db';
import { NotFoundException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    studentProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    grade: {
      findFirst: jest.fn(),
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
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    assessmentAttempt: {
      findMany: jest.fn(),
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
      (db.paymentOrder.findMany as jest.Mock).mockResolvedValue([]);
      (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getStudentDashboard('acc-1');
      expect(result.profile.displayName).toBe('Ali');
      expect(result.enrolledCourses).toHaveLength(0);
    });
  });

  describe('student profile', () => {
    it('updates editable academic details within the student organization', async () => {
      (db.studentProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          account: { organizationId: 'org-1' },
        })
        .mockResolvedValueOnce({
          displayName: 'Ali',
          gradeId: 'grade-1',
          schoolName: 'مدرسة النيل',
          city: 'الإسكندرية',
          gender: 'MALE',
          updatedAt: new Date(),
          account: {
            phoneEncrypted: null,
            status: 'ACTIVE',
            createdAt: new Date(),
          },
        });
      (db.grade.findFirst as jest.Mock).mockResolvedValue({ id: 'grade-1' });
      (db.studentProfile.update as jest.Mock).mockResolvedValue({});

      const result = await service.updateStudentProfile('acc-1', {
        gradeId: 'grade-1',
        schoolName: ' مدرسة النيل ',
        city: ' الإسكندرية ',
        gender: 'MALE',
      });

      expect(db.grade.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'grade-1',
          organizationId: 'org-1',
          status: 'ACTIVE',
          archivedAt: null,
        },
        select: { id: true },
      });
      expect(db.studentProfile.update).toHaveBeenCalledWith({
        where: { accountId: 'acc-1' },
        data: {
          gradeId: 'grade-1',
          schoolName: 'مدرسة النيل',
          city: 'الإسكندرية',
          gender: 'MALE',
        },
      });
      expect(result.profile.schoolName).toBe('مدرسة النيل');
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
