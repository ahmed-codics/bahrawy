import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import type { AdminDeletionImpact } from '@bahrawy/types';
import { randomBytes } from 'node:crypto';
import { SecurityService } from '../../security/security.service';
import { AdminAuditService } from '../common/services/audit.service';
import {
  CreateStudentDto,
  GrantEntitlementDto,
  StudentStatusDto,
  UpdateEntitlementDto,
  UpdateStudentProfileDto,
} from './students.dto';
import { LifecycleMutationDto } from '../common/dto/lifecycle.dto';

type Actor = { id: string; organizationId: string };

@Injectable()
export class AdminV1StudentsService {
  constructor(
    private readonly securityService: SecurityService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(
    organizationId: string,
    search = '',
    status?: string,
    gradeId?: string,
    page = 1,
    pageSize = 25,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = Math.max(page - 1, 0) * take;
    const normalizedSearch = search.trim();
    const studentNumber = /^\d+$/.test(normalizedSearch)
      ? Number(normalizedSearch)
      : undefined;
    const phoneHmac = normalizedSearch
      ? this.securityService.generatePhoneHmac(normalizedSearch)
      : undefined;
    const where = {
      account: {
        organizationId,
        kind: 'STUDENT',
        deletedAt: null,
        ...(status === 'ARCHIVED'
          ? { archivedAt: { not: null } }
          : { archivedAt: null }),
        ...(status && status !== 'ARCHIVED' ? { status } : {}),
      },
      ...(gradeId ? { gradeId } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              ...(studentNumber !== undefined &&
              Number.isSafeInteger(studentNumber)
                ? [{ studentNumber }]
                : []),
              {
                displayName: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
              { account: { phoneHmac } },
            ],
          }
        : {}),
    };
    const [students, total] = await Promise.all([
      db.studentProfile.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          studentNumber: true,
          displayName: true,
          grade: true,
          account: {
            select: {
              id: true,
              status: true,
              version: true,
              createdAt: true,
              updatedAt: true,
              _count: { select: { devices: true, entitlements: true } },
            },
          },
        },
      }),
      db.studentProfile.count({ where }),
    ]);
    return {
      students,
      meta: {
        page,
        pageSize: take,
        total,
        pageCount: Math.ceil(total / take),
      },
    };
  }

  async detail(organizationId: string, studentId: string) {
    const student = await db.studentProfile.findFirst({
      where: { id: studentId, account: { organizationId, deletedAt: null } },
      include: {
        grade: true,
        account: {
          include: {
            devices: { orderBy: { lastUsedAt: 'desc' } },
            authSessions: { orderBy: { lastSeenAt: 'desc' }, take: 20 },
            entitlements: {
              orderBy: { createdAt: 'desc' },
              include: {
                product: {
                  include: { courses: { include: { course: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    const payments = await db.paymentOrder.findMany({
      where: { organizationId, accountId: student.accountId },
      orderBy: { createdAt: 'desc' },
      include: { ledgerEntries: { orderBy: { createdAt: 'desc' } } },
    });
    let phone = 'HIDDEN';
    try {
      if (student.account.phoneEncrypted) {
        phone = this.securityService.decrypt(student.account.phoneEncrypted);
      }
    } catch {
      // Keep the masked fallback when legacy encrypted data cannot be read.
    }
    let fatherPhone = '';
    let motherPhone = '';
    try {
      fatherPhone = student.fatherPhoneEncrypted
        ? this.securityService.decrypt(student.fatherPhoneEncrypted)
        : '';
      motherPhone = student.motherPhoneEncrypted
        ? this.securityService.decrypt(student.motherPhoneEncrypted)
        : '';
    } catch {
      // Older profiles may not have valid parent contact data.
    }
    const publicStudent = Object.fromEntries(
      Object.entries(student).filter(
        ([key]) =>
          key !== 'fatherPhoneEncrypted' && key !== 'motherPhoneEncrypted',
      ),
    );
    return { ...publicStudent, phone, fatherPhone, motherPhone, payments };
  }

  async create(actor: Actor, input: CreateStudentDto) {
    const phoneHmac = this.securityService.generatePhoneHmac(input.phone);
    const duplicate = await db.account.findFirst({
      where: {
        organizationId: actor.organizationId,
        phoneHmac,
        deletedAt: null,
      },
    });
    if (duplicate)
      throw new ConflictException('Phone number is already registered');
    if (input.gradeId) {
      const grade = await db.grade.findFirst({
        where: { id: input.gradeId, organizationId: actor.organizationId },
      });
      if (!grade) throw new BadRequestException('Grade not found');
    }
    const temporaryPassword = randomBytes(9).toString('base64url');
    const account = await db.account.create({
      data: {
        organizationId: actor.organizationId,
        kind: 'STUDENT',
        phoneEncrypted: this.securityService.encrypt(input.phone),
        phoneHmac,
        passwordHash:
          await this.securityService.hashPassword(temporaryPassword),
        mustChangePassword: true,
        studentProfile: {
          create: {
            displayName: input.displayName,
            gradeId: input.gradeId,
          },
        },
      },
      include: { studentProfile: true },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_CREATED',
      targetType: 'ACCOUNT',
      targetId: account.id,
      after: {
        studentNumber: account.studentProfile?.studentNumber,
        displayName: input.displayName,
        gradeId: input.gradeId,
      },
    });
    return {
      student: account.studentProfile,
      accountId: account.id,
      temporaryPassword,
    };
  }

  async setStatus(actor: Actor, studentId: string, input: StudentStatusDto) {
    const student = await this.findStudent(actor.organizationId, studentId);
    if (student.account.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This student was changed by another staff member',
        currentVersion: student.account.version,
      });
    }
    const updated = await db.$transaction(async (tx: any) => {
      const account = await tx.account.update({
        where: { id: student.accountId },
        data: { status: input.status, version: { increment: 1 } },
      });
      if (input.status === 'SUSPENDED') {
        await tx.authSession.updateMany({
          where: { accountId: student.accountId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: input.reason },
        });
      }
      return account;
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `STUDENT_${input.status}`,
      targetType: 'ACCOUNT',
      targetId: student.accountId,
      before: { status: student.account.status },
      after: { status: updated.status },
      reason: input.reason,
    });
    return updated;
  }

  async updateProfile(
    actor: Actor,
    studentId: string,
    input: UpdateStudentProfileDto,
  ) {
    const student = await this.findStudent(actor.organizationId, studentId);
    if (student.account.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This student was changed by another staff member',
        currentVersion: student.account.version,
      });
    }
    if (input.gradeId) {
      const grade = await db.grade.findFirst({
        where: {
          id: input.gradeId,
          organizationId: actor.organizationId,
          archivedAt: null,
        },
      });
      if (!grade) throw new BadRequestException('Grade not found');
    }
    let phoneData: { phoneEncrypted: string; phoneHmac: string } | undefined;
    if (input.phone) {
      const phoneHmac = this.securityService.generatePhoneHmac(input.phone);
      const duplicate = await db.account.findFirst({
        where: {
          organizationId: actor.organizationId,
          phoneHmac,
          id: { not: student.accountId },
          deletedAt: null,
        },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'PHONE_ALREADY_EXISTS',
          message: 'Phone number is already registered',
        });
      }
      phoneData = {
        phoneEncrypted: this.securityService.encrypt(input.phone),
        phoneHmac,
      };
    }
    const updated = await db.$transaction(async (tx: any) => {
      await tx.account.update({
        where: { id: student.accountId },
        data: { ...phoneData, version: { increment: 1 } },
      });
      return tx.studentProfile.update({
        where: { id: student.id },
        data: {
          displayName: input.displayName,
          gradeId: input.gradeId,
          schoolName: input.schoolName,
          city: input.city,
          fatherPhoneEncrypted:
            input.fatherPhone === undefined
              ? undefined
              : input.fatherPhone
                ? this.securityService.encrypt(input.fatherPhone)
                : null,
          motherPhoneEncrypted:
            input.motherPhone === undefined
              ? undefined
              : input.motherPhone
                ? this.securityService.encrypt(input.motherPhone)
                : null,
        },
      });
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_PROFILE_UPDATED',
      targetType: 'ACCOUNT',
      targetId: student.accountId,
      before: student,
      after: updated,
      reason: input.reason,
    });
    return updated;
  }

  async deletionImpact(
    organizationId: string,
    studentId: string,
  ): Promise<AdminDeletionImpact> {
    const student = await db.studentProfile.findFirst({
      where: {
        id: studentId,
        account: { organizationId, deletedAt: null },
      },
      include: {
        account: {
          include: {
            _count: {
              select: {
                entitlements: true,
                assessmentAttempts: true,
                authSessions: true,
              },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    const paymentCount = await db.paymentOrder.count({
      where: { organizationId, accountId: student.accountId },
    });
    const blockers = [
      {
        code: 'ENTITLEMENTS',
        label: 'اشتراكات محفوظة',
        count: student.account._count.entitlements,
      },
      {
        code: 'ATTEMPTS',
        label: 'محاولات اختبارات محفوظة',
        count: student.account._count.assessmentAttempts,
      },
      { code: 'PAYMENTS', label: 'سجلات دفع محفوظة', count: paymentCount },
    ].filter((item) => item.count > 0);
    return {
      id: student.id,
      resource: 'STUDENT',
      label: student.displayName,
      currentStatus: student.account.archivedAt
        ? 'ARCHIVED'
        : student.account.status,
      actions: [student.account.archivedAt ? 'RESTORE' : 'ARCHIVE'],
      blockers,
      affectedChildren: blockers.map(({ code, label, count }) => ({
        type: code,
        label,
        count,
      })),
      requiresReason: true,
      requiresTypedConfirmation: false,
    };
  }

  async setArchived(
    actor: Actor,
    studentId: string,
    archived: boolean,
    input: LifecycleMutationDto,
  ) {
    const student = await this.findStudent(actor.organizationId, studentId);
    if (student.account.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This student was changed by another staff member',
        currentVersion: student.account.version,
      });
    }
    const updated = await db.$transaction(async (tx: any) => {
      const account = await tx.account.update({
        where: { id: student.accountId },
        data: {
          status: archived ? 'ARCHIVED' : 'ACTIVE',
          archivedAt: archived ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (archived) {
        await tx.authSession.updateMany({
          where: { accountId: student.accountId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: input.reason },
        });
      }
      return account;
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: archived ? 'STUDENT_ARCHIVED' : 'STUDENT_RESTORED',
      targetType: 'ACCOUNT',
      targetId: student.accountId,
      before: student.account,
      after: updated,
      reason: input.reason,
    });
    return updated;
  }

  async revokeDevice(
    actor: Actor,
    studentId: string,
    deviceId: string,
    reason: string,
  ) {
    const student = await this.findStudent(actor.organizationId, studentId);
    const device = await db.studentDevice.findFirst({
      where: { id: deviceId, accountId: student.accountId },
    });
    if (!device) throw new NotFoundException('Device not found');
    await db.studentDevice.delete({ where: { id: device.id } });
    await db.authSession.updateMany({
      where: { accountId: student.accountId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_DEVICE_REVOKED',
      targetType: 'STUDENT_DEVICE',
      targetId: device.id,
      before: device,
      reason,
    });
    return { id: device.id };
  }

  async revokeSessions(actor: Actor, studentId: string, reason: string) {
    const student = await this.findStudent(actor.organizationId, studentId);
    const result = await db.authSession.updateMany({
      where: { accountId: student.accountId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'STUDENT_SESSIONS_REVOKED',
      targetType: 'ACCOUNT',
      targetId: student.accountId,
      after: { revokedSessions: result.count },
      reason,
    });
    return result;
  }

  async grantEntitlement(
    actor: Actor,
    studentId: string,
    input: GrantEntitlementDto,
  ) {
    const student = await this.findStudent(actor.organizationId, studentId);
    const product = await db.product.findFirst({
      where: { id: input.productId, organizationId: actor.organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');
    const entitlement = await db.entitlement.create({
      data: {
        accountId: student.accountId,
        productId: product.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: 'ACTIVE',
      },
      include: { product: true },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ENTITLEMENT_GRANTED',
      targetType: 'ENTITLEMENT',
      targetId: entitlement.id,
      after: entitlement,
      reason: input.reason,
    });
    return entitlement;
  }

  async updateEntitlement(
    actor: Actor,
    id: string,
    input: UpdateEntitlementDto,
  ) {
    const entitlement = await db.entitlement.findFirst({
      where: { id, account: { organizationId: actor.organizationId } },
    });
    if (!entitlement) throw new NotFoundException('Entitlement not found');
    const updated = await db.entitlement.update({
      where: { id },
      data: {
        status: input.status,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ENTITLEMENT_UPDATED',
      targetType: 'ENTITLEMENT',
      targetId: id,
      before: entitlement,
      after: updated,
      reason: input.reason,
    });
    return updated;
  }

  private async findStudent(organizationId: string, studentId: string) {
    const student = await db.studentProfile.findFirst({
      where: { id: studentId, account: { organizationId, deletedAt: null } },
      include: { account: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }
}
