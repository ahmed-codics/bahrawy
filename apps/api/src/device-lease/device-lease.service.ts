import { Injectable, ForbiddenException } from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class DeviceLeaseService {
  async validateOrRegisterDevice(
    accountId: string,
    deviceFingerprint: string,
    userAgent?: string,
  ): Promise<void> {
    const existing = await db.studentDevice.findUnique({
      where: {
        accountId_deviceFingerprint: {
          accountId,
          deviceFingerprint,
        },
      },
    });
    if (existing) {
      await db.studentDevice.update({
        where: { id: existing.id },
        data: { lastUsedAt: new Date() },
      });
      return;
    }
    const count = await db.studentDevice.count({
      where: { accountId },
    });
    if (count >= 2) {
      throw new ForbiddenException({
        code: 'DEVICE_LIMIT_REACHED',
        message: 'Two-device limit exceeded. Reset requires staff assistance.',
      });
    }
    await db.studentDevice.create({
      data: {
        accountId,
        deviceFingerprint,
        label: userAgent ? userAgent.substring(0, 100) : 'Registered Device',
      },
    });
  }

  async resetStudentDevices(accountId: string): Promise<void> {
    await db.studentDevice.deleteMany({
      where: { accountId },
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
}
