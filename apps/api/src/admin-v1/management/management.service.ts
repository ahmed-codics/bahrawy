import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { randomBytes } from 'node:crypto';
import { SecurityService } from '../../security/security.service';
import { AdminAuditService } from '../common/services/audit.service';
import {
  CreateStaffDto,
  UpdateOrganizationDto,
  UpdateStaffDto,
} from './management.dto';

type Actor = { id: string; organizationId: string };

@Injectable()
export class AdminV1ManagementService {
  constructor(
    private readonly security: SecurityService,
    private readonly audit: AdminAuditService,
  ) {}

  async staff(organizationId: string) {
    const profiles = await db.staffProfile.findMany({
      where: { account: { organizationId, deletedAt: null } },
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
    });
    return profiles.map((profile: any) => {
      let phone = 'HIDDEN';
      try {
        phone = this.security.decrypt(profile.account.phoneEncrypted);
      } catch {}
      return { ...profile, phone };
    });
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
    const phoneHmac = this.security.generatePhoneHmac(input.phone);
    const duplicate = await db.account.findFirst({
      where: {
        organizationId: actor.organizationId,
        phoneHmac,
        deletedAt: null,
      },
    });
    if (duplicate)
      throw new ConflictException('Phone number is already registered');
    const temporaryPassword = randomBytes(12).toString('base64url');
    const account = await db.account.create({
      data: {
        organizationId: actor.organizationId,
        kind: 'STAFF',
        phoneEncrypted: this.security.encrypt(input.phone),
        phoneHmac,
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

  auditEvents(
    organizationId: string,
    action?: string,
    actorId?: string,
    targetType?: string,
  ) {
    return db.auditEvent.findMany({
      where: {
        organizationId,
        ...(action
          ? { action: { contains: action, mode: 'insensitive' } }
          : {}),
        ...(actorId ? { actorId } : {}),
        ...(targetType ? { targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
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
}
