import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import type { AdminDeletionImpact } from '@bahrawy/types';
import { randomBytes } from 'node:crypto';
import { SecurityService } from '../../security/security.service';
import { AdminAuditService } from '../common/services/audit.service';
import {
  CreateStaffDto,
  UpdateOrganizationDto,
  UpdateStaffDto,
} from './management.dto';
import { LifecycleMutationDto } from '../common/dto/lifecycle.dto';

type Actor = { id: string; organizationId: string };

@Injectable()
export class AdminV1ManagementService {
  constructor(
    private readonly security: SecurityService,
    private readonly audit: AdminAuditService,
  ) {}

  async staff(
    organizationId: string,
    search = '',
    status?: string,
    page = 1,
    pageSize = 25,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = Math.max(page - 1, 0) * take;
    const where = {
      displayName: search
        ? { contains: search.trim(), mode: 'insensitive' as const }
        : undefined,
      account: {
        organizationId,
        deletedAt: null,
        ...(status === 'ARCHIVED'
          ? { archivedAt: { not: null } }
          : {
              archivedAt: null,
              ...(status ? { status } : {}),
            }),
      },
    };
    const [profiles, total] = await Promise.all([
      db.staffProfile.findMany({
        where,
        skip,
        take,
        orderBy: { displayName: 'asc' },
        include: {
          account: {
            include: {
              accountRoles: {
                include: {
                  role: {
                    include: {
                      rolePermissions: { include: { permission: true } },
                    },
                  },
                },
              },
              authSessions: {
                where: { revokedAt: null },
                select: { id: true },
              },
            },
          },
        },
      }),
      db.staffProfile.count({ where }),
    ]);
    const items = profiles.map((profile: any) => {
      let email = 'HIDDEN';
      try {
        if (profile.account.emailEncrypted) {
          email = this.security.decrypt(profile.account.emailEncrypted);
        }
      } catch {
        // Keep the masked fallback when legacy encrypted data is unreadable.
      }
      return { ...profile, email };
    });
    return {
      items,
      meta: {
        page,
        pageSize: take,
        total,
        pageCount: Math.ceil(total / take),
      },
    };
  }

  roles() {
    return db.role.findMany({
      orderBy: { code: 'asc' },
      include: {
        rolePermissions: {
          include: { permission: true },
          orderBy: { permission: { code: 'asc' } },
        },
        _count: { select: { accountRoles: true } },
      },
    });
  }

  async createStaff(actor: Actor, input: CreateStaffDto) {
    await this.validateRoles(input.roleIds);
    const email = input.email.trim().toLowerCase();
    const emailHmac = this.security.generateEmailHmac(email);
    const duplicate = await db.account.findFirst({
      where: {
        organizationId: actor.organizationId,
        emailHmac,
        deletedAt: null,
      },
    });
    if (duplicate)
      throw new ConflictException('Email address is already registered');
    const temporaryPassword = randomBytes(12).toString('base64url');
    const account = await db.account.create({
      data: {
        organizationId: actor.organizationId,
        kind: 'STAFF',
        emailEncrypted: this.security.encrypt(email),
        emailHmac,
        passwordHash: await this.security.hashPassword(temporaryPassword),
        mustChangePassword: true,
        staffProfile: { create: { displayName: input.displayName } },
        accountRoles: {
          create: [...new Set(input.roleIds)].map((roleId) => ({
            roleId,
            grantedBy: actor.id,
          })),
        },
      },
      include: { staffProfile: true },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STAFF_CREATED',
      targetType: 'ACCOUNT',
      targetId: account.id,
      after: { displayName: input.displayName, roleIds: input.roleIds },
    });
    return { staff: account.staffProfile, temporaryPassword };
  }

  async updateStaff(actor: Actor, staffId: string, input: UpdateStaffDto) {
    const profile = await db.staffProfile.findFirst({
      where: { id: staffId, account: { organizationId: actor.organizationId } },
      include: {
        account: { include: { accountRoles: { include: { role: true } } } },
      },
    });
    if (!profile) throw new NotFoundException('Staff member not found');
    if (profile.account.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This staff account was changed by another administrator',
        currentVersion: profile.account.version,
      });
    }
    if (profile.accountId === actor.id && input.status === 'SUSPENDED') {
      throw new ForbiddenException('You cannot suspend your own account');
    }
    await this.validateRoles(input.roleIds);
    const wasOwner = profile.account.accountRoles.some(
      (assignment: any) => assignment.role.code === 'OWNER',
    );
    const ownerRole = await db.role.findUnique({ where: { code: 'OWNER' } });
    const remainsOwner = ownerRole
      ? input.roleIds.includes(ownerRole.id)
      : false;
    if (profile.accountId === actor.id && wasOwner && !remainsOwner) {
      throw new ForbiddenException('You cannot remove your own owner role');
    }
    if (wasOwner && (!remainsOwner || input.status === 'SUSPENDED')) {
      await this.assertAnotherActiveOwner(
        actor.organizationId,
        profile.accountId,
      );
    }
    const updated = await db.$transaction(async (tx: any) => {
      const account = await tx.account.update({
        where: { id: profile.accountId },
        data: { status: input.status, version: { increment: 1 } },
      });
      await tx.accountRole.deleteMany({
        where: { accountId: profile.accountId },
      });
      if (input.roleIds.length) {
        await tx.accountRole.createMany({
          data: [...new Set(input.roleIds)].map((roleId) => ({
            accountId: profile.accountId,
            roleId,
            grantedBy: actor.id,
          })),
        });
      }
      if (input.status === 'SUSPENDED') {
        await tx.authSession.updateMany({
          where: { accountId: profile.accountId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: input.reason },
        });
      }
      return account;
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STAFF_ACCESS_UPDATED',
      targetType: 'ACCOUNT',
      targetId: profile.accountId,
      before: {
        status: profile.account.status,
        roleIds: profile.account.accountRoles.map(
          (assignment: any) => assignment.roleId,
        ),
      },
      after: { status: input.status, roleIds: input.roleIds },
      reason: input.reason,
    });
    return updated;
  }

  async staffDeletionImpact(
    organizationId: string,
    staffId: string,
  ): Promise<AdminDeletionImpact> {
    const profile = await db.staffProfile.findFirst({
      where: {
        id: staffId,
        account: { organizationId, deletedAt: null },
      },
      include: {
        account: {
          include: {
            accountRoles: { include: { role: true } },
            _count: { select: { authSessions: true } },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Staff member not found');
    return {
      id: profile.id,
      resource: 'STAFF',
      label: profile.displayName,
      currentStatus: profile.account.archivedAt
        ? 'ARCHIVED'
        : profile.account.status,
      actions: [profile.account.archivedAt ? 'RESTORE' : 'ARCHIVE'],
      blockers: profile.account.accountRoles.some(
        (assignment: any) => assignment.role.code === 'OWNER',
      )
        ? [{ code: 'OWNER_ROLE', label: 'حساب مالك للأكاديمية', count: 1 }]
        : [],
      affectedChildren: [
        {
          type: 'AUTH_SESSIONS',
          label: 'جلسات دخول مرتبطة',
          count: profile.account._count.authSessions,
        },
      ],
      requiresReason: true,
      requiresTypedConfirmation: false,
    };
  }

  async setStaffArchived(
    actor: Actor,
    staffId: string,
    archived: boolean,
    input: LifecycleMutationDto,
  ) {
    const profile = await db.staffProfile.findFirst({
      where: {
        id: staffId,
        account: { organizationId: actor.organizationId, deletedAt: null },
      },
      include: {
        account: { include: { accountRoles: { include: { role: true } } } },
      },
    });
    if (!profile) throw new NotFoundException('Staff member not found');
    if (profile.account.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This staff account was changed by another administrator',
        currentVersion: profile.account.version,
      });
    }
    if (archived && profile.accountId === actor.id) {
      throw new ForbiddenException('You cannot archive your own account');
    }
    if (
      archived &&
      profile.account.accountRoles.some(
        (assignment: any) => assignment.role.code === 'OWNER',
      )
    ) {
      await this.assertAnotherActiveOwner(
        actor.organizationId,
        profile.accountId,
      );
    }
    const updated = await db.$transaction(async (tx: any) => {
      const account = await tx.account.update({
        where: { id: profile.accountId },
        data: {
          status: archived ? 'ARCHIVED' : 'ACTIVE',
          archivedAt: archived ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (archived) {
        await tx.authSession.updateMany({
          where: { accountId: profile.accountId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: input.reason },
        });
      }
      return account;
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: archived ? 'STAFF_ARCHIVED' : 'STAFF_RESTORED',
      targetType: 'ACCOUNT',
      targetId: profile.accountId,
      before: profile.account,
      after: updated,
      reason: input.reason,
    });
    return updated;
  }

  auditEvents(
    organizationId: string,
    action?: string,
    actorId?: string,
    targetType?: string,
    page = 1,
    pageSize = 50,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = Math.max(page - 1, 0) * take;
    const where = {
      organizationId,
      ...(action
        ? { action: { contains: action, mode: 'insensitive' as const } }
        : {}),
      ...(actorId ? { actorId } : {}),
      ...(targetType ? { targetType } : {}),
    };
    return Promise.all([
      db.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      db.auditEvent.count({ where }),
    ]).then(([items, total]) => ({
      items,
      meta: {
        page,
        pageSize: take,
        total,
        pageCount: Math.ceil(total / take),
      },
    }));
  }

  async organization(organizationId: string) {
    const organization = await db.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  async updateOrganization(actor: Actor, input: UpdateOrganizationDto) {
    const organization = await this.organization(actor.organizationId);
    if (organization.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'Organization settings were changed by another administrator',
        currentVersion: organization.version,
      });
    }
    try {
      Intl.DateTimeFormat('en', { timeZone: input.timezone }).format();
    } catch {
      throw new BadRequestException('Invalid IANA timezone');
    }
    if (!/^[A-Z]{3}$/.test(input.currency)) {
      throw new BadRequestException('Currency must be a 3-letter ISO code');
    }
    const updated = await db.organization.update({
      where: { id: actor.organizationId },
      data: {
        name: input.name,
        timezone: input.timezone,
        currency: input.currency,
        paymentInstapay: input.paymentInstapay,
        paymentWallet: input.paymentWallet,
        version: { increment: 1 },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      targetType: 'ORGANIZATION',
      targetId: actor.organizationId,
      before: organization,
      after: updated,
    });
    return updated;
  }

  private async validateRoles(roleIds: string[]) {
    const unique = [...new Set(roleIds)];
    if (!unique.length)
      throw new BadRequestException('At least one role is required');
    const count = await db.role.count({ where: { id: { in: unique } } });
    if (count !== unique.length)
      throw new BadRequestException('One or more roles are invalid');
  }

  private async assertAnotherActiveOwner(
    organizationId: string,
    excludedAccountId: string,
  ) {
    const activeOwners = await db.account.count({
      where: {
        organizationId,
        kind: 'STAFF',
        status: 'ACTIVE',
        archivedAt: null,
        id: { not: excludedAccountId },
        accountRoles: { some: { role: { code: 'OWNER' } } },
      },
    });
    if (activeOwners === 0) {
      throw new ForbiddenException(
        'The last active Owner cannot be suspended, archived, or stripped of ownership',
      );
    }
  }
}
