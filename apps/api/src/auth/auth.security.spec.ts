import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SecurityService } from '../security/security.service';
import { TotpService } from '../totp/totp.service';
import { db } from '@bahrawy/db';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    account: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    accountActivation: {
      update: jest.fn(),
      updateMany: jest.fn(),
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
  return { db: mockDbClient };
});

describe('AuthService security behavior', () => {
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

  const validAccount = (overrides: Record<string, unknown> = {}) => ({
    id: 'acc-1',
    kind: 'STUDENT',
    phoneHmac: securityService.generatePhoneHmac('01012345678'),
    passwordHash: '',
    status: 'ACTIVE',
    organizationId: 'org-1',
    totpFactor: null,
    ...overrides,
  });

  describe('account status enforcement at login', () => {
    it('rejects a suspended account even with a correct password', async () => {
      const pass = 'SuperSecretPassphrase123';
      const hash = await securityService.hashPassword(pass);
      (db.account.findFirst as jest.Mock).mockResolvedValue(
        validAccount({ passwordHash: hash, status: 'SUSPENDED' }),
      );

      await expect(service.login('01012345678', pass)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(db.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: 'FAILED_ACCOUNT_INACTIVE' }),
        }),
      );
    });

    it('rejects a pending-activation account at login', async () => {
      const pass = 'SuperSecretPassphrase123';
      const hash = await securityService.hashPassword(pass);
      (db.account.findFirst as jest.Mock).mockResolvedValue(
        validAccount({ passwordHash: hash, status: 'PENDING_ACTIVATION' }),
      );

      await expect(service.login('01012345678', pass)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('still allows an ACTIVE account to log in', async () => {
      const pass = 'SuperSecretPassphrase123';
      const hash = await securityService.hashPassword(pass);
      (db.account.findFirst as jest.Mock).mockResolvedValue(
        validAccount({ passwordHash: hash, status: 'ACTIVE' }),
      );
      (db.authSession.create as jest.Mock).mockResolvedValue({ id: 'sess-1' });

      const result = await service.login('01012345678', pass);
      expect(result.account.id).toBe('acc-1');
      expect(result.session).toBeDefined();
    });
  });

  describe('activation marks the account active', () => {
    it('sets status ACTIVE when the activation credential is consumed', async () => {
      const code = 'ACTIVATION-CODE-123';
      const codeHash = await securityService.hashPassword(code);
      const account = validAccount({
        status: 'PENDING_ACTIVATION',
        activation: {
          id: 'act-1',
          credentialHash: codeHash,
          consumedAt: null,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          attemptCount: 0,
        },
      });
      (db.account.findFirst as jest.Mock).mockResolvedValue(account);
      (db.accountActivation.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (db.account.update as jest.Mock).mockResolvedValue({
        ...account,
        status: 'ACTIVE',
      });
      (db.authSession.create as jest.Mock).mockResolvedValue({ id: 'sess-1' });
      (db.auditEvent.create as jest.Mock).mockResolvedValue({});
      (db.outboxEvent.create as jest.Mock).mockResolvedValue({});
      (db.securityEvent.create as jest.Mock).mockResolvedValue({});

      await service.activate('01012345678', code, 'NewStrongPassword1');

      expect(db.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });
  });

  describe('session validation', () => {
    const session = (overrides: Record<string, unknown> = {}) => ({
      id: 'sess-1',
      tokenHash: 'h',
      revokedAt: null,
      absoluteExpiresAt: new Date(Date.now() + 24 * 3600_000),
      idleExpiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(),
      account: validAccount(),
      ...overrides,
    });

    it('rejects a revoked session', async () => {
      (db.authSession.findFirst as jest.Mock).mockResolvedValue(
        session({ revokedAt: new Date() }),
      );
      await expect(service.validateSession('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired session and revokes it', async () => {
      (db.authSession.findFirst as jest.Mock).mockResolvedValue(
        session({
          absoluteExpiresAt: new Date(Date.now() - 1000),
        }),
      );
      await expect(service.validateSession('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(db.authSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedReason: 'EXPIRED' }),
        }),
      );
    });

    it('rejects a session whose account is suspended and revokes it', async () => {
      (db.authSession.findFirst as jest.Mock).mockResolvedValue(
        session({
          account: validAccount({ status: 'SUSPENDED' }),
        }),
      );
      await expect(service.validateSession('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(db.authSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedReason: 'ACCOUNT_INACTIVE' }),
        }),
      );
    });

    it('accepts a live ACTIVE session', async () => {
      (db.authSession.findFirst as jest.Mock).mockResolvedValue(session());
      const result = await service.validateSession('some-token');
      expect(result.id).toBe('sess-1');
    });
  });

  describe('password reset tenant isolation', () => {
    it('forbids resetting the password of an account in another organization', async () => {
      (db.account.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === 'staff-org-a') {
          return Promise.resolve({
            id: 'staff-org-a',
            organizationId: 'org-a',
          });
        }
        if (args.where.id === 'student-org-b') {
          return Promise.resolve({
            id: 'student-org-b',
            organizationId: 'org-b',
            passwordHash: 'x',
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.createPasswordResetCase(
          'staff-org-a',
          'student-org-b',
          'test',
          null,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(db.passwordResetCase.create).not.toHaveBeenCalled();
    });

    it('allows resetting an account within the same organization', async () => {
      (db.account.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === 'staff-org-a') {
          return Promise.resolve({
            id: 'staff-org-a',
            organizationId: 'org-a',
          });
        }
        if (args.where.id === 'student-org-a') {
          return Promise.resolve({
            id: 'student-org-a',
            organizationId: 'org-a',
            passwordHash: 'x',
          });
        }
        return Promise.resolve(null);
      });
      (db.passwordResetCase.create as jest.Mock).mockResolvedValue({
        id: 'case-1',
      });

      const result = await service.createPasswordResetCase(
        'staff-org-a',
        'student-org-a',
        'test',
        null,
      );
      expect(result.resetCase.id).toBe('case-1');
      expect(result.plainCredential).toBeTruthy();
    });
  });
});
