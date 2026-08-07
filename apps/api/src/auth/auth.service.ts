import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { db, Prisma } from '@bahrawy/db';
import { SecurityService } from '../security/security.service';
import { TotpService } from '../totp/totp.service';
import { RegisterStudentDto } from './register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly securityService: SecurityService,
    private readonly totpService: TotpService,
  ) {}

  async checkPhone(phone: string): Promise<boolean> {
    const phoneHmac = this.securityService.generatePhoneHmac(phone);
    const existing = await db.account.findFirst({
      where: { phoneHmac, deletedAt: null },
      select: { id: true },
    });
    return !!existing;
  }

  async registerStudent(input: RegisterStudentDto) {
    const grade = await db.grade.findFirst({
      where: { id: input.gradeId, status: 'ACTIVE', archivedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!grade) throw new BadRequestException('المرحلة الدراسية غير متاحة');

    const phoneHmac = this.securityService.generatePhoneHmac(input.phone);
    const parentPhoneHmac = this.securityService.generatePhoneHmac(
      input.parentPhone,
    );
    const emailHmac = this.securityService.generateEmailHmac(input.email);
    const passwordHash = await this.securityService.hashPassword(
      input.password,
    );
    const names = [
      input.firstName,
      input.secondName,
      input.thirdName,
      input.lastName,
    ].map((name) => name.trim());

    return db
      .$transaction(async (tx: any) => {
        const duplicate = await tx.account.findFirst({
          where: {
            organizationId: grade.organizationId,
            phoneHmac,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (duplicate) throw new ConflictException('رقم الهاتف مسجل بالفعل');

        const duplicateEmail = await tx.account.findFirst({
          where: {
            organizationId: grade.organizationId,
            emailHmac,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (duplicateEmail)
          throw new ConflictException('البريد الإلكتروني مسجل بالفعل');

        const account = await tx.account.create({
          data: {
            organizationId: grade.organizationId,
            kind: 'STUDENT',
            phoneEncrypted: this.securityService.encrypt(input.phone),
            phoneHmac,
            emailEncrypted: this.securityService.encrypt(input.email),
            emailHmac,
            passwordHash,
            mustChangePassword: false,
            studentProfile: {
              create: {
                gradeId: grade.id,
                displayName: names.join(' '),
                firstName: names[0],
                secondName: names[1],
                thirdName: names[2],
                lastName: names[3],
                parentPhoneEncrypted: this.securityService.encrypt(
                  input.parentPhone,
                ),
                parentPhoneHmac,
                schoolName: input.schoolName.trim(),
                gender: input.gender,
                city: input.city.trim(),
              },
            },
          },
          include: { studentProfile: true },
        });

        await tx.auditEvent.create({
          data: {
            organizationId: grade.organizationId,
            actorType: 'STUDENT',
            actorId: account.id,
            action: 'SELF_REGISTER_STUDENT',
            targetType: 'Account',
            targetId: account.id,
            after: {
              gradeId: grade.id,
              displayName: account.studentProfile.displayName,
            },
            reason: 'Public academy registration',
          },
        });

        await tx.securityEvent.create({
          data: {
            accountId: account.id,
            phoneHmac,
            eventType: 'REGISTRATION',
            outcome: 'SUCCESS',
          },
        });

        const session = await this.createSessionInternal(account.id, tx);
        return { account, session };
      })
      .catch((error) => {
        if (error instanceof ConflictException) throw error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const meta = error.meta;
          const target = Array.isArray(meta?.target)
            ? meta.target.join(',')
            : typeof meta?.target === 'string'
              ? meta.target
              : '';
          if (target.includes('emailHmac')) {
            throw new ConflictException('البريد الإلكتروني مسجل بالفعل');
          }
          throw new ConflictException('رقم الهاتف مسجل بالفعل');
        }
        throw error;
      });
  }

  // 1. Activation
  async activate(phone: string, credentialCode: string, newPassword: string) {
    const phoneHmac = this.securityService.generatePhoneHmac(phone);
    const account = await db.account.findFirst({
      where: { phoneHmac, deletedAt: null },
      include: { activation: true },
    });

    if (!account || !account.activation) {
      await this.logSecurityEvent(
        null,
        phoneHmac,
        'ACTIVATION',
        'FAILED_ACCOUNT_NOT_FOUND',
      );
      throw new BadRequestException('Invalid activation code or phone number');
    }

    const act = account.activation;
    if (act.consumedAt || act.revokedAt || act.expiresAt < new Date()) {
      await this.logSecurityEvent(
        account.id,
        phoneHmac,
        'ACTIVATION',
        'FAILED_EXPIRED_OR_CONSUMED',
      );
      throw new BadRequestException(
        'Activation code is expired or already consumed',
      );
    }

    if (act.attemptCount >= 5) {
      await this.logSecurityEvent(
        account.id,
        phoneHmac,
        'ACTIVATION',
        'FAILED_MAX_ATTEMPTS',
      );
      throw new BadRequestException(
        'Too many activation attempts. Contact support.',
      );
    }

    // Verify credentialCode (hashed compared to clean credentialCode string)
    const isMatch = await this.securityService.verifyPassword(
      act.credentialHash,
      credentialCode,
    );
    if (!isMatch) {
      await db.accountActivation.update({
        where: { id: act.id },
        data: { attemptCount: { increment: 1 } },
      });
      await this.logSecurityEvent(
        account.id,
        phoneHmac,
        'ACTIVATION',
        'FAILED_INVALID_CREDENTIAL',
      );
      throw new BadRequestException('Invalid activation code or phone number');
    }

    // Hash permanent password (enforces constraints)
    const passwordHash = await this.securityService.hashPassword(newPassword);

    // Atomically update account password, consume activation, and create audit/outbox events in transaction
    return await db.$transaction(async (tx: any) => {
      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          status: 'ACTIVE',
          version: { increment: 1 },
        },
      });

      const { count } = await tx.accountActivation.updateMany({
        where: { id: act.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (count === 0) {
        throw new ConflictException('Activation code already consumed');
      }

      // Write audit log
      await tx.auditEvent.create({
        data: {
          organizationId: account.organizationId,
          actorType: 'STUDENT',
          actorId: account.id,
          action: 'ACTIVATE_ACCOUNT',
          targetType: 'Account',
          targetId: account.id,
          before: { status: account.status } as any,
          after: { status: updatedAccount.status } as any,
          reason: 'Initial account activation',
        },
      });

      // Create provider-neutral outbox event
      const eventId = this.securityService.generateRandomToken();
      await tx.outboxEvent.create({
        data: {
          eventType: 'account.activated',
          aggregateType: 'Account',
          aggregateId: account.id,
          payload: {
            accountId: account.id,
            timestamp: new Date().toISOString(),
          } as any,
          idempotencyKey: `activate_${account.id}_${eventId}`,
        },
      });

      await tx.securityEvent.create({
        data: {
          accountId: account.id,
          phoneHmac,
          eventType: 'ACTIVATION',
          outcome: 'SUCCESS',
        },
      });

      // Create new application session
      const session = await this.createSessionInternal(account.id, tx);
      return { account: updatedAccount, session };
    });
  }

  // 2. Authentication (Login)
  async login(
    phone: string,
    password: string,
    totpToken?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const phoneHmac = this.securityService.generatePhoneHmac(phone);
    const account = await db.account.findFirst({
      where: { phoneHmac, kind: { not: 'STAFF' }, deletedAt: null },
      include: { totpFactor: true },
    });

    if (!account) {
      await this.logSecurityEvent(
        null,
        phoneHmac,
        'LOGIN',
        'FAILED_INVALID_CREDENTIALS',
      );
      throw new UnauthorizedException('Invalid phone number or password');
    }

    return this.authenticateAccount(
      account,
      password,
      totpToken,
      ipAddress,
      userAgent,
      phoneHmac,
      'Invalid phone number or password',
    );
  }

  async staffLogin(
    email: string,
    password: string,
    totpToken?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const emailHmac = this.securityService.generateEmailHmac(email);
    const account = await db.account.findFirst({
      where: { emailHmac, kind: 'STAFF', deletedAt: null },
      include: { totpFactor: true },
    });

    if (!account) {
      await this.logSecurityEvent(
        null,
        null,
        'STAFF_LOGIN',
        'FAILED_INVALID_CREDENTIALS',
      );
      throw new UnauthorizedException('Invalid email address or password');
    }

    return this.authenticateAccount(
      account,
      password,
      totpToken,
      ipAddress,
      userAgent,
      null,
      'Invalid email address or password',
    );
  }

  private async authenticateAccount(
    account: any,
    password: string,
    totpToken: string | undefined,
    ipAddress: string | undefined,
    userAgent: string | undefined,
    phoneHmac: string | null,
    invalidCredentialsMessage: string,
  ) {
    const isPassMatch = await this.securityService.verifyPassword(
      account.passwordHash,
      password,
    );
    if (!isPassMatch) {
      await this.logSecurityEvent(
        account.id,
        phoneHmac,
        'LOGIN',
        'FAILED_INVALID_CREDENTIALS',
      );
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    // Enforce account status: suspended/inactive/pending accounts must not
    // be able to authenticate or obtain a new session. Verified password first
    // (above) so the response is indistinguishable from a bad credential.
    if (account.status !== 'ACTIVE') {
      await this.logSecurityEvent(
        account.id,
        phoneHmac,
        'LOGIN',
        'FAILED_ACCOUNT_INACTIVE',
      );
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    // Staff TOTP verification if active
    if (account.kind === 'STAFF') {
      const factor = account.totpFactor;
      if (factor && factor.status === 'ACTIVE') {
        if (!totpToken) {
          throw new UnauthorizedException('TOTP token required');
        }
        const secret = this.totpService.decryptSecret(factor.secretEncrypted);
        const isValidTotp = this.totpService.verifyToken(secret, totpToken);
        if (!isValidTotp) {
          await this.logSecurityEvent(
            account.id,
            phoneHmac,
            'TOTP_VERIFICATION',
            'FAILED_INVALID_TOKEN',
          );
          throw new UnauthorizedException('Invalid TOTP token');
        }

        const currentStep = BigInt(this.totpService.getCurrentStep());
        if (currentStep <= factor.lastUsedStep) {
          await this.logSecurityEvent(
            account.id,
            phoneHmac,
            'TOTP_VERIFICATION',
            'FAILED_REPLAY_ATTEMPT',
          );
          throw new UnauthorizedException(
            'Token already used. Please wait 30 seconds.',
          );
        }

        // Save last used time step to prevent replays
        await db.totpFactor.update({
          where: { id: factor.id },
          data: { lastUsedStep: currentStep },
        });
      }
    }

    // Create session
    const session = await this.createSession(account.id, ipAddress, userAgent);
    await this.logSecurityEvent(account.id, phoneHmac, 'LOGIN', 'SUCCESS');

    return { account, session };
  }

  // 3. Session Management
  async createSession(
    accountId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return await db.$transaction(async (tx: any) => {
      return await this.createSessionInternal(
        accountId,
        tx,
        ipAddress,
        userAgent,
      );
    });
  }

  private async createSessionInternal(
    accountId: string,
    tx: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const plainToken = this.securityService.generateRandomToken();
    const tokenHash = this.securityService.hashOpaqueToken(plainToken);

    // Sessions absolute expire in 7 days, idle expire in 1 hour
    const now = new Date();
    const idleExpiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 1); // 1 hour
    const absoluteExpiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7); // 7 days

    const session = await tx.authSession.create({
      data: {
        accountId,
        tokenHash,
        idleExpiresAt,
        absoluteExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    return { plainToken, session };
  }

  async validateSession(plainToken: string) {
    if (typeof plainToken !== 'string' || plainToken.trim().length === 0) {
      throw new UnauthorizedException('Session token missing');
    }
    const tokenHash = this.securityService.hashOpaqueToken(plainToken);
    const session = await db.authSession.findFirst({
      where: { tokenHash },
      include: { account: true },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Session not found or revoked');
    }

    const now = new Date();
    if (session.absoluteExpiresAt < now || session.idleExpiresAt < now) {
      // Auto-revoke expired session
      await db.authSession.update({
        where: { id: session.id },
        data: { revokedAt: now, revokedReason: 'EXPIRED' },
      });
      throw new UnauthorizedException('Session has expired');
    }

    // Suspended/inactive accounts must not be able to keep using existing
    // sessions. Their sessions are revoked so a later re-activation cannot
    // resurrect a stale authenticated context.
    if (session.account.status !== 'ACTIVE') {
      await db.authSession.update({
        where: { id: session.id },
        data: { revokedAt: now, revokedReason: 'ACCOUNT_INACTIVE' },
      });
      throw new UnauthorizedException('Account is not active');
    }

    // Sliding expiry does not need a database write on every API request.
    // Touch active sessions at most once every five minutes.
    if (now.getTime() - session.lastSeenAt.getTime() < 5 * 60 * 1000) {
      return session;
    }

    const newIdleExpiry = new Date(now.getTime() + 1000 * 60 * 60 * 1);
    const updated = await db.authSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: now,
        idleExpiresAt: newIdleExpiry,
      },
      include: { account: true },
    });

    return updated;
  }

  async rotateSession(sessionId: string) {
    const plainToken = this.securityService.generateRandomToken();
    const tokenHash = this.securityService.hashOpaqueToken(plainToken);
    const now = new Date();
    const newIdleExpiry = new Date(now.getTime() + 1000 * 60 * 60 * 1);

    await db.authSession.update({
      where: { id: sessionId },
      data: {
        tokenHash,
        lastSeenAt: now,
        idleExpiresAt: newIdleExpiry,
      },
    });

    return plainToken;
  }

  async revokeSession(sessionId: string, reason: string) {
    await db.authSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  async revokeAllSessions(accountId: string, reason: string) {
    await db.authSession.updateMany({
      where: { accountId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  // 4. Authenticated Password Change
  async changePassword(accountId: string, oldPass: string, newPass: string) {
    const account = await db.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new BadRequestException('Account not found');
    }

    const isMatch = await this.securityService.verifyPassword(
      account.passwordHash,
      oldPass,
    );
    if (!isMatch) {
      throw new BadRequestException('Invalid old password');
    }

    const passwordHash = await this.securityService.hashPassword(newPass);

    await db.$transaction(async (tx: any) => {
      await tx.account.update({
        where: { id: accountId },
        data: {
          passwordHash,
          mustChangePassword: false,
          version: { increment: 1 },
        },
      });

      // Revoke all existing sessions for this account (forced logout everywhere after change)
      await tx.authSession.updateMany({
        where: { accountId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: 'PASSWORD_CHANGED',
        },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: account.organizationId,
          actorType: account.kind,
          actorId: accountId,
          action: 'CHANGE_PASSWORD',
          targetType: 'Account',
          targetId: accountId,
          reason: 'User self password change',
        },
      });
    });
  }

  // 5. Staff Recovery: Reset Case Creation
  async createPasswordResetCase(
    initiatorStaffId: string,
    targetAccountId: string,
    reason: string,
    checklist: any,
  ) {
    const initiator = await db.account.findUnique({
      where: { id: initiatorStaffId },
      select: { organizationId: true },
    });
    if (!initiator) {
      throw new BadRequestException('Initiating staff account not found');
    }

    const target = await db.account.findUnique({
      where: { id: targetAccountId },
    });
    if (!target) {
      throw new BadRequestException('Target account not found');
    }

    // Tenant isolation: a staff member may only reset passwords for accounts
    // within their own organization. Without this, a privileged staff member
    // could take over accounts in any other organization.
    if (target.organizationId !== initiator.organizationId) {
      throw new ForbiddenException(
        'Cannot reset password for an account in another organization',
      );
    }

    const plainCredential = this.securityService
      .generateRandomToken()
      .substring(0, 16);
    const credentialHash =
      await this.securityService.hashPassword(plainCredential);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes reset code window

    const resetCase = await db.passwordResetCase.create({
      data: {
        targetAccountId,
        initiatorStaffId,
        identityChecklist: checklist,
        reason,
        credentialHash,
        expiresAt,
      },
    });

    return { resetCase, plainCredential };
  }

  // 6. Staff Recovery: Consume Reset Case
  async consumePasswordResetCase(
    resetCaseId: string,
    credentialCode: string,
    newPassword: string,
  ) {
    const resetCase = await db.passwordResetCase.findUnique({
      where: { id: resetCaseId },
      include: { targetAccount: true },
    });

    if (
      !resetCase ||
      resetCase.status !== 'PENDING' ||
      resetCase.expiresAt < new Date()
    ) {
      throw new BadRequestException('Reset case is invalid or expired');
    }

    const isMatch = await this.securityService.verifyPassword(
      resetCase.credentialHash,
      credentialCode,
    );
    if (!isMatch) {
      throw new BadRequestException('Invalid reset code');
    }

    const passwordHash = await this.securityService.hashPassword(newPassword);

    await db.$transaction(async (tx: any) => {
      await tx.passwordResetCase.update({
        where: { id: resetCaseId },
        data: {
          consumedAt: new Date(),
          status: 'CONSUMED',
        },
      });

      await tx.account.update({
        where: { id: resetCase.targetAccountId },
        data: {
          passwordHash,
          mustChangePassword: true, // Forces password change on first login!
          version: { increment: 1 },
        },
      });

      // Revoke all sessions for target account
      await tx.authSession.updateMany({
        where: { accountId: resetCase.targetAccountId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: 'RECOVERY_RESET',
        },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: resetCase.targetAccount.organizationId,
          actorType: 'STAFF',
          actorId: resetCase.initiatorStaffId,
          action: 'STAFF_RESET_PASSWORD',
          targetType: 'Account',
          targetId: resetCase.targetAccountId,
          reason: resetCase.reason,
        },
      });
    });
  }

  private async logSecurityEvent(
    accountId: string | null,
    phoneHmac: string | null,
    eventType: string,
    outcome: string,
  ) {
    try {
      await db.securityEvent.create({
        data: { accountId, phoneHmac, eventType, outcome },
      });
    } catch {
      // Don't fail the request if logging security event fails
    }
  }
}
