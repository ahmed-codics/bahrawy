import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db, Prisma } from '@bahrawy/db';
import { DeviceLeaseService } from '../../device-lease/device-lease.service';
import { AdminAuditService } from '../common/services/audit.service';
import { DeviceLockListQueryDto } from './device-lock.dto';

type Actor = { id: string; organizationId: string };

const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;
const MAX_FETCH_ROWS = 2000;

const studentNumberFromSearch = (search: string): number | null => {
  const trimmed = search.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const maskFingerprint = (fingerprint: string | null | undefined): string => {
  const value = (fingerprint ?? '').trim();
  if (!value) return '';
  return value.length <= 8
    ? value
    : `${value.slice(0, 8)}…${value.slice(-4)}`;
};

@Injectable()
export class AdminV1DeviceLockService {
  constructor(
    private readonly deviceLeaseService: DeviceLeaseService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(organizationId: string, query: DeviceLockListQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(
      Math.max(query.pageSize ?? 25, 1),
      MAX_PAGE_SIZE,
    );
    const search = (query.search ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
    const studentNumber = studentNumberFromSearch(search);

    const accountWhere: Prisma.AccountWhereInput = {
      organizationId,
      kind: 'STUDENT',
      deletedAt: null,
      status: 'DEVICE_BLOCKED',
      ...(search
        ? {
            OR: [
              {
                studentProfile: {
                  displayName: { contains: search, mode: 'insensitive' },
                },
              },
              ...(studentNumber !== null
                ? [{ studentProfile: { studentNumber } }]
                : []),
            ],
          }
        : {}),
    };

    const profileWhere: Prisma.StudentProfileWhereInput = {
      account: accountWhere,
      ...(query.gradeId ? { gradeId: query.gradeId } : {}),
    };

    const [profiles, grades] = await Promise.all([
      db.studentProfile.findMany({
        where: profileWhere,
        orderBy: { updatedAt: 'desc' },
        take: MAX_FETCH_ROWS,
        select: {
          id: true,
          studentNumber: true,
          displayName: true,
          gradeId: true,
          account: {
            select: {
              id: true,
              status: true,
              version: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      db.grade.findMany({
        where: { organizationId, archivedAt: null },
        select: { id: true, nameAr: true },
        orderBy: { nameAr: 'asc' },
      }),
    ]);

    const accountIds = profiles.map((profile) => profile.account.id);

    type PrimaryDevice = {
      id: string;
      accountId: string;
      deviceFingerprint: string;
      label: string | null;
      lastUsedAt: Date;
    };
    type BlockRow = {
      id: string;
      accountId: string;
      deviceFingerprint: string;
      reason: string;
      blockedAt: Date;
      resolvedAt: Date | null;
      resolution: string | null;
    };
    let primaryDevices: PrimaryDevice[] = [];
    let blocks: BlockRow[] = [];
    if (accountIds.length) {
      [primaryDevices, blocks] = await Promise.all([
        db.studentDevice.findMany({
          where: { accountId: { in: accountIds }, isPrimary: true },
          select: {
            id: true,
            accountId: true,
            deviceFingerprint: true,
            label: true,
            lastUsedAt: true,
          },
        }),
        db.deviceBlock.findMany({
          where: { accountId: { in: accountIds } },
          orderBy: { blockedAt: 'desc' },
          take: MAX_FETCH_ROWS,
          select: {
            id: true,
            accountId: true,
            deviceFingerprint: true,
            reason: true,
            blockedAt: true,
            resolvedAt: true,
            resolution: true,
          },
        }),
      ]);
    }

    const primaryByAccount = new Map<string, PrimaryDevice>();
    for (const device of primaryDevices) {
      if (!primaryByAccount.has(device.accountId)) {
        primaryByAccount.set(device.accountId, device);
      }
    }
    const latestOpenBlockByAccount = new Map<string, BlockRow>();
    for (const block of blocks) {
      if (!block.resolvedAt && !latestOpenBlockByAccount.has(block.accountId)) {
        latestOpenBlockByAccount.set(block.accountId, block);
      }
    }

    const rawItems = profiles.map((profile) => {
      const primary = primaryByAccount.get(profile.account.id);
      const latestBlock = latestOpenBlockByAccount.get(profile.account.id);
      return {
        accountId: profile.account.id,
        studentNumber: profile.studentNumber,
        displayName: profile.displayName,
        gradeId: profile.gradeId,
        accountStatus: profile.account.status,
        version: profile.account.version,
        createdAt: profile.account.createdAt,
        primaryDevice: primary
          ? {
              id: primary.id,
              label: primary.label,
              fingerprint: maskFingerprint(primary.deviceFingerprint),
              lastUsedAt: primary.lastUsedAt,
            }
          : null,
        blockedAt: latestBlock?.blockedAt ?? null,
        blockReason: latestBlock?.reason ?? null,
        attemptedDevice: latestBlock
          ? {
              fingerprint: maskFingerprint(latestBlock.deviceFingerprint),
              reason: latestBlock.reason,
              blockedAt: latestBlock.blockedAt,
            }
          : null,
      };
    });

    const total = rawItems.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const items = rawItems.slice((page - 1) * pageSize, page * pageSize);

    return {
      items,
      meta: { page, pageSize, total, pageCount },
      grades,
    };
  }

  async unlock(actor: Actor, accountId: string) {
    const student = await this.loadBlockedStudent(
      actor.organizationId,
      accountId,
    );
    const updated = await db.$transaction(async (tx: any) => {
      const account = await tx.account.update({
        where: { id: accountId },
        data: { status: 'ACTIVE', version: { increment: 1 } },
      });
      await tx.deviceBlock.updateMany({
        where: { accountId, resolvedAt: null },
        data: {
          resolvedAt: new Date(),
          resolution: 'UNLOCK',
          resolvedBy: actor.id,
        },
      });
      return account;
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_DEVICE_UNLOCK',
      targetType: 'ACCOUNT',
      targetId: accountId,
      before: { status: student.status },
      after: { status: updated.status },
      reason: 'فتح حساب الطالب بعد إيقافه بسبب الجهاز',
    });
    return {
      id: updated.id,
      status: updated.status,
      version: updated.version,
    };
  }

  async allowDevice(actor: Actor, accountId: string) {
    const student = await this.loadBlockedStudent(
      actor.organizationId,
      accountId,
    );
    const latest = await db.deviceBlock.findFirst({
      where: { accountId, resolvedAt: null },
      orderBy: { blockedAt: 'desc' },
    });
    if (!latest) {
      throw new BadRequestException(
        'لا يوجد جهاز معلق للسماح به — الحساب لا يحتوي على سجل إيقاف جهاز',
      );
    }

    await this.deviceLeaseService.promoteDevice(
      accountId,
      latest.deviceFingerprint,
    );

    const updated = await db.$transaction(async (tx: any) => {
      const account = await tx.account.update({
        where: { id: accountId },
        data: { status: 'ACTIVE', version: { increment: 1 } },
      });
      await tx.deviceBlock.updateMany({
        where: { accountId, resolvedAt: null },
        data: {
          resolvedAt: new Date(),
          resolution: 'ALLOW_DEVICE',
          resolvedBy: actor.id,
        },
      });
      return account;
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_DEVICE_ALLOW',
      targetType: 'ACCOUNT',
      targetId: accountId,
      before: { status: student.status },
      after: { status: updated.status },
      reason: 'السماح بجهاز الطالب الحالي',
    });
    return {
      id: updated.id,
      status: updated.status,
      version: updated.version,
    };
  }

  async resetPrimary(actor: Actor, accountId: string) {
    const student = await this.loadBlockedStudent(
      actor.organizationId,
      accountId,
    );
    const updated = await db.$transaction(async (tx: any) => {
      await tx.studentDevice.deleteMany({
        where: { accountId },
      });
      const account = await tx.account.update({
        where: { id: accountId },
        data: { status: 'ACTIVE', version: { increment: 1 } },
      });
      await tx.deviceBlock.updateMany({
        where: { accountId, resolvedAt: null },
        data: {
          resolvedAt: new Date(),
          resolution: 'RESET_PRIMARY',
          resolvedBy: actor.id,
        },
      });
      return account;
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_DEVICE_RESET_PRIMARY',
      targetType: 'ACCOUNT',
      targetId: accountId,
      before: { status: student.status },
      after: { status: updated.status },
      reason: 'إعادة تعيين الجهاز الأساسي للطالب',
    });
    return {
      id: updated.id,
      status: updated.status,
      version: updated.version,
    };
  }

  private async loadBlockedStudent(organizationId: string, accountId: string) {
    const student = await db.account.findFirst({
      where: {
        id: accountId,
        organizationId,
        kind: 'STUDENT',
        deletedAt: null,
      },
      include: {
        studentProfile: {
          select: {
            id: true,
            displayName: true,
            studentNumber: true,
          },
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.status !== 'DEVICE_BLOCKED') {
      throw new ConflictException(
        `الطالب ليس موقوفاً بسبب الجهاز (الحالة الحالية: ${student.status})`,
      );
    }
    return student;
  }
}