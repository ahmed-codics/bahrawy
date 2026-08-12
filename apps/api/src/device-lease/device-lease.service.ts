import { Injectable, ForbiddenException } from '@nestjs/common';
import { db, Prisma } from '@bahrawy/db';

type DeviceAccount = {
  id: string;
  status: string;
  organizationId: string;
};

@Injectable()
export class DeviceLeaseService {
  /**
   * Strict one-device-per-student enforcement.
   * - Fresh account with no device: the first device becomes the primary.
   * - Known primary device: pass (refreshes lastUsedAt).
   * - Any other device: the account is immediately DEVICE_BLOCKED, all active
   *   sessions are revoked, a DeviceBlock record + SecurityEvent + audit are
   *   written, and a ForbiddenException is thrown (admin must intervene).
   */
  async validateOrRegisterDevice(
    account: DeviceAccount,
    deviceFingerprint: string,
    userAgent?: string,
  ): Promise<void> {
    const fingerprint = this.normalizeFingerprint(deviceFingerprint);
    const existing = await db.studentDevice.findUnique({
      where: {
        accountId_deviceFingerprint: {
          accountId: account.id,
          deviceFingerprint: fingerprint,
        },
      },
    });

    if (existing) {
      if (!existing.isPrimary) {
        // Legacy secondary device (e.g. pre-migration rows) — not allowed.
        await this.blockAccountForDevice(
          account,
          fingerprint,
          'NON_PRIMARY_DEVICE',
          userAgent,
        );
        return;
      }
      await db.studentDevice.update({
        where: { id: existing.id },
        data: { lastUsedAt: new Date() },
      });
      return;
    }

    try {
      await db.$transaction(async (tx: any) => {
        const primary = await tx.studentDevice.findFirst({
          where: { accountId: account.id, isPrimary: true },
        });
        if (primary) {
          if (primary.deviceFingerprint !== fingerprint) {
            throw new BlockDeviceSignal(fingerprint, userAgent);
          }
          await tx.studentDevice.update({
            where: { id: primary.id },
            data: { lastUsedAt: new Date() },
          });
          return;
        }
        await tx.studentDevice.create({
          data: {
            accountId: account.id,
            deviceFingerprint: fingerprint,
            isPrimary: true,
            label: userAgent
              ? String(userAgent).substring(0, 100)
              : 'Registered Device',
          },
        });
      });
    } catch (error) {
      if (error instanceof BlockDeviceSignal) {
        await this.blockAccountForDevice(
          account,
          error.deviceFingerprint,
          'UNKNOWN_DEVICE',
          error.userAgent,
        );
        return;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const primary = await db.studentDevice.findFirst({
          where: { accountId: account.id, isPrimary: true },
        });
        const row = await db.studentDevice.findUnique({
          where: {
            accountId_deviceFingerprint: {
              accountId: account.id,
              deviceFingerprint: fingerprint,
            },
          },
        });
        if (row) {
          if (primary && primary.deviceFingerprint !== fingerprint) {
            await this.blockAccountForDevice(
              account,
              fingerprint,
              'UNKNOWN_DEVICE',
              userAgent,
            );
            return;
          }
          await db.studentDevice.update({
            where: { id: row.id },
            data: { lastUsedAt: new Date(), isPrimary: true },
          });
          return;
        }
      }
      throw error;
    }
  }

  /**
   * Blocks the account for an unknown/foreign device. Marks the account
   * DEVICE_BLOCKED, revokes all active sessions, records a DeviceBlock row,
   * a SecurityEvent and an audit event, then throws a DEVICE_BLOCKED
   * ForbiddenException. Idempotent for already-blocked accounts.
   */
  async blockAccountForDevice(
    account: DeviceAccount,
    deviceFingerprint: string,
    reason: string,
    userAgent?: string,
  ): Promise<never> {
    const fingerprint = this.normalizeFingerprint(deviceFingerprint);
    const label = userAgent ? String(userAgent).substring(0, 100) : null;

    await db.$transaction(async (tx: any) => {
      const resolved = await tx.studentDevice.upsert({
        where: {
          accountId_deviceFingerprint: {
            accountId: account.id,
            deviceFingerprint: fingerprint,
          },
        },
        create: {
          accountId: account.id,
          deviceFingerprint: fingerprint,
          isPrimary: false,
          label,
        },
        update: { lastUsedAt: new Date() },
      });

      await tx.deviceBlock.create({
        data: {
          accountId: account.id,
          deviceFingerprint: fingerprint,
          reason,
        },
      });

      const current = await tx.account.findUnique({
        where: { id: account.id },
        select: { status: true },
      });
      if (current?.status !== 'DEVICE_BLOCKED') {
        await tx.account.update({
          where: { id: account.id },
          data: { status: 'DEVICE_BLOCKED', version: { increment: 1 } },
        });
        await tx.authSession.updateMany({
          where: { accountId: account.id, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokedReason: 'DEVICE_BLOCKED',
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: account.organizationId,
            actorType: 'SYSTEM',
            actorId: account.id,
            action: 'ACCOUNT_DEVICE_BLOCKED',
            targetType: 'ACCOUNT',
            targetId: account.id,
            before: { status: current?.status ?? 'ACTIVE' },
            after: { status: 'DEVICE_BLOCKED' },
            reason: `Unknown device blocked: ${reason}`,
          },
        });
      }

      await tx.securityEvent.create({
        data: {
          accountId: account.id,
          eventType: 'DEVICE_BLOCK',
          outcome: 'FAILED_UNKNOWN_DEVICE',
          metadata: {
            reason,
            attemptedDeviceId: resolved.id,
          } as Prisma.InputJsonValue,
        },
      });
    });

    throw new ForbiddenException({
      code: 'DEVICE_BLOCKED',
      message:
        'لقد تم اكتشاف جهاز غير معروف. تم إيقاف الحساب — تواصل مع الأكاديمية لاستعادة الوصول.',
    });
  }

  /** Admin action: registers/promotes a device as the allowed primary one. */
  async promoteDevice(
    accountId: string,
    deviceFingerprint: string,
    label: string | null = null,
  ): Promise<void> {
    const fingerprint = this.normalizeFingerprint(deviceFingerprint);
    await db.$transaction(async (tx: any) => {
      await tx.studentDevice.updateMany({
        where: { accountId, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.studentDevice.upsert({
        where: {
          accountId_deviceFingerprint: {
            accountId,
            deviceFingerprint: fingerprint,
          },
        },
        create: {
          accountId,
          deviceFingerprint: fingerprint,
          isPrimary: true,
          label,
        },
        update: { isPrimary: true, lastUsedAt: new Date(), ...(label ? { label } : {}) },
      });
    });
  }

  async resetStudentDevices(accountId: string): Promise<void> {
    await db.studentDevice.deleteMany({
      where: { accountId },
    });
  }

  async getPrimaryDevice(accountId: string) {
    return db.studentDevice.findFirst({
      where: { accountId, isPrimary: true },
    });
  }

  async acquireLease(
    accountId: string,
    sessionId: string,
    deviceFingerprint: string,
    activityType: string,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60);
    const activeLease = await db.activityLease.findUnique({
      where: { accountId },
    });
    if (activeLease && activeLease.expiresAt > now) {
      if (
        activeLease.sessionId !== sessionId ||
        activeLease.deviceFingerprint !== deviceFingerprint
      ) {
        throw new ForbiddenException({
          code: 'LEASE_CONCURRENCY_VIOLATION',
          message: 'Account is active on another device or session.',
        });
      }
    }
    await db.activityLease.upsert({
      where: { accountId },
      create: {
        accountId,
        sessionId,
        deviceFingerprint,
        activityType,
        expiresAt,
      },
      update: {
        sessionId,
        deviceFingerprint,
        activityType,
        expiresAt,
        updatedAt: now,
      },
    });
  }

  async pingLease(accountId: string, sessionId: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60);
    const lease = await db.activityLease.findUnique({
      where: { accountId },
    });
    if (lease && lease.sessionId === sessionId) {
      await db.activityLease.update({
        where: { accountId },
        data: { expiresAt },
      });
    }
  }

  async releaseLease(accountId: string, sessionId: string): Promise<void> {
    const lease = await db.activityLease.findUnique({
      where: { accountId },
    });
    if (lease && lease.sessionId === sessionId) {
      await db.activityLease.delete({
        where: { accountId },
      });
    }
  }

  async getDevices(accountId: string): Promise<any[]> {
    return db.studentDevice.findMany({
      where: { accountId },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  private normalizeFingerprint(deviceFingerprint: string): string {
    const fingerprint = String(deviceFingerprint ?? '').trim();
    if (!fingerprint) {
      throw new ForbiddenException({
        code: 'DEVICE_FINGERPRINT_MISSING',
        message: 'A valid device fingerprint is required.',
      });
    }
    return fingerprint;
  }
}

class BlockDeviceSignal {
  constructor(
    readonly deviceFingerprint: string,
    readonly userAgent?: string,
  ) {}
}