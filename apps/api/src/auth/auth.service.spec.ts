import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SecurityService } from '../security/security.service';
import { TotpService } from '../totp/totp.service';
import { UnauthorizedException } from '@nestjs/common';
import { db } from '@bahrawy/db';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    account: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    grade: {
      findFirst: jest.fn(),
    },
    accountActivation: {
      update: jest.fn(),
    },
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    totpFactor: {
      update: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    outboxEvent: {
      create: jest.fn(),
    },
    passwordResetCase: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockDbClient)),
  };
  return {
    db: mockDbClient,
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let securityService: SecurityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, SecurityService, TotpService],
    }).compile();
    service = module.get<AuthService>(AuthService);
    securityService = module.get<SecurityService>(SecurityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerStudent', () => {
    it('creates a complete student profile and an authenticated session', async () => {
      (db.grade.findFirst as jest.Mock).mockResolvedValue({
        id: 'grade-1',
        organizationId: 'org-1',
      });
      (db.account.findFirst as jest.Mock).mockResolvedValue(null);
      (db.account.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'account-1',
          kind: 'STUDENT',
          studentProfile: data.studentProfile.create,
        }),
      );
      (db.authSession.create as jest.Mock).mockResolvedValue({
        id: 'session-1',
      });

      const result = await service.registerStudent({
        firstName: 'أحمد',
        secondName: 'محمد',
        thirdName: 'علي',
        lastName: 'حسن',
        phone: '01012345678',
        fatherPhone: '01112345678',
        motherPhone: '01212345678',
        schoolName: 'مدرسة النيل',
        guardianOccupation: 'مهندس',
        gender: 'MALE',
        city: 'القاهرة',
        gradeId: 'grade-1',
        password: 'StrongPassphrase2026',
      });

      expect(result.account.id).toBe('account-1');
      expect(db.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'STUDENT',
            studentProfile: {
              create: expect.objectContaining({
                displayName: 'أحمد محمد علي حسن',
                schoolName: 'مدرسة النيل',
                gender: 'MALE',
              }),
            },
          }),
        }),
      );
      expect(result.session.plainToken).toBeTruthy();
    });
  });

  describe('login', () => {
    it('should login student successfully with valid credentials', async () => {
      const pass = 'SuperSecretPassphrase123';
      const hash = await securityService.hashPassword(pass);
      const mockAccount = {
        id: 'acc-1',
        kind: 'STUDENT',
        phoneHmac: securityService.generatePhoneHmac('01012345678'),
        passwordHash: hash,
        status: 'ACTIVE',
        organizationId: 'org-1',
        totpFactor: null,
      };
      (db.account.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (db.authSession.create as jest.Mock).mockResolvedValue({ id: 'sess-1' });

      const result = await service.login('01012345678', pass);
      expect(result.account.id).toBe('acc-1');
      expect(result.session).toBeDefined();
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const pass = 'SuperSecretPassphrase123';
      const hash = await securityService.hashPassword(pass);
      const mockAccount = {
        id: 'acc-1',
        kind: 'STUDENT',
        phoneHmac: securityService.generatePhoneHmac('01012345678'),
        passwordHash: hash,
        status: 'ACTIVE',
        totpFactor: null,
      };
      (db.account.findFirst as jest.Mock).mockResolvedValue(mockAccount);

      await expect(service.login('01012345678', 'wrong-pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should login staff with an email address', async () => {
      const pass = 'SuperSecretPassphrase123';
      const hash = await securityService.hashPassword(pass);
      const mockAccount = {
        id: 'staff-1',
        kind: 'STAFF',
        emailHmac: securityService.generateEmailHmac('admin@bahrawy.test'),
        passwordHash: hash,
        status: 'ACTIVE',
        organizationId: 'org-1',
        totpFactor: null,
      };
      (db.account.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (db.authSession.create as jest.Mock).mockResolvedValue({ id: 'sess-2' });

      const result = await service.staffLogin('ADMIN@BAHRAWY.TEST', pass);

      expect(db.account.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            emailHmac: mockAccount.emailHmac,
            kind: 'STAFF',
          }),
        }),
      );
      expect(result.account.id).toBe('staff-1');
    });

    it('should not allow staff through the phone login endpoint', async () => {
      (db.account.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login('+201000000000', 'SuperSecretPassphrase123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(db.account.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ kind: { not: 'STAFF' } }),
        }),
      );
    });
  });
});
