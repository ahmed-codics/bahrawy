import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SecurityService } from '../security/security.service';
import { TotpService } from '../totp/totp.service';
import { DeviceLeaseService } from '../device-lease/device-lease.service';
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
      findFirst: jest.fn(),
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
      providers: [
        AuthService,
        SecurityService,
        TotpService,
        {
          provide: DeviceLeaseService,
          useValue: {
            validateOrRegisterDevice: jest.fn().mockResolvedValue(undefined),
            blockAccountForDevice: jest
              .fn()
              .mockRejectedValue(new Error('blocked')),
          },
        },
      ],
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
        parentPhone: '01112345678',
        email: 'ahmed@example.com',
        schoolName: 'مدرسة النيل',
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
                parentPhoneEncrypted: expect.any(String),
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

  describe('remember-me session policy', () => {
    const pass = 'SuperSecretPassphrase123';

    const mockAccount = (overrides: Record<string, unknown> = {}) => ({
      id: 'acc-rm',
      kind: 'STUDENT',
      phoneHmac: securityService.generatePhoneHmac('01012345678'),
      passwordHash: null,
      status: 'ACTIVE',
      organizationId: 'org-1',
      totpFactor: null,
      ...overrides,
    });

    beforeEach(async () => {
      const hash = await securityService.hashPassword(pass);
      const account = mockAccount({ passwordHash: hash });
      (db.account.findFirst as jest.Mock).mockResolvedValue(account);
      (db.authSession.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'sess-rm', ...data }),
      );
    });

    it('creates a normal 1h-idle / 7d-absolute session by default (rememberMe=false)', async () => {
      await service.login('01012345678', pass);

      expect(db.authSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rememberMe: false,
          }),
        }),
      );
      const { data } = (db.authSession.create as jest.Mock).mock.calls[0][0];
      const now = Date.now();
      expect(data.idleExpiresAt.getTime() - now).toBeLessThanOrEqual(
        1000 * 60 * 60 * 1 + 5000,
      );
      expect(data.idleExpiresAt.getTime() - now).toBeGreaterThanOrEqual(
        1000 * 60 * 60 * 1 - 5000,
      );
      expect(data.absoluteExpiresAt.getTime() - now).toBeLessThanOrEqual(
        1000 * 60 * 60 * 24 * 7 + 5000,
      );
      expect(data.absoluteExpiresAt.getTime() - now).toBeGreaterThanOrEqual(
        1000 * 60 * 60 * 24 * 7 - 5000,
      );
    });

    it('creates a persistent 30d-idle / 30d-absolute session when rememberMe=true', async () => {
      await service.login(
        '01012345678',
        pass,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      );

      const { data } = (db.authSession.create as jest.Mock).mock.calls[0][0];
      expect(data.rememberMe).toBe(true);
      const now = Date.now();
      expect(data.idleExpiresAt.getTime() - now).toBeGreaterThan(
        1000 * 60 * 60 * 24 * 7,
      );
      expect(data.absoluteExpiresAt.getTime() - now).toBeGreaterThan(
        1000 * 60 * 60 * 24 * 7,
      );
      expect(data.idleExpiresAt.getTime() - now).toBeLessThanOrEqual(
        1000 * 60 * 60 * 24 * 30 + 5000,
      );
      expect(data.absoluteExpiresAt.getTime() - now).toBeLessThanOrEqual(
        1000 * 60 * 60 * 24 * 30 + 5000,
      );
    });

    it('keeps staff sessions persistent when rememberMe=true', async () => {
      const hash = await securityService.hashPassword(pass);
      const staff = mockAccount({
        id: 'staff-rm',
        kind: 'STAFF',
        emailHmac: securityService.generateEmailHmac('admin@bahrawy.test'),
        passwordHash: hash,
        totpFactor: null,
      });
      (db.account.findFirst as jest.Mock).mockResolvedValue(staff);

      await service.staffLogin(
        'admin@bahrawy.test',
        pass,
        undefined,
        undefined,
        undefined,
        true,
      );

      const { data } = (db.authSession.create as jest.Mock).mock.calls[0][0];
      expect(data.rememberMe).toBe(true);
      expect(data.absoluteExpiresAt.getTime() - Date.now()).toBeGreaterThan(
        1000 * 60 * 60 * 24 * 7,
      );
    });

    it('slides a remember-me session idle expiry to 30 days on validateSession', async () => {
      const rememberSession = {
        id: 'sess-rm-live',
        tokenHash: 'h-rm',
        revokedAt: null,
        rememberMe: true,
        lastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        absoluteExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 29),
        account: mockAccount(),
      };
      (db.authSession.findFirst as jest.Mock).mockResolvedValue(
        rememberSession,
      );
      (db.authSession.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ ...rememberSession, ...data }),
      );

      await service.validateSession('plain-token-rm');

      expect(db.authSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idleExpiresAt: expect.any(Date),
          }),
        }),
      );
      const { data } = (db.authSession.update as jest.Mock).mock.calls[0][0];
      expect(data.idleExpiresAt.getTime() - Date.now()).toBeGreaterThan(
        1000 * 60 * 60 * 24 * 7,
      );
    });
  });
});
