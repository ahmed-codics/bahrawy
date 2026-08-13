import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { SecurityService } from '../security/security.service';
import { AdminAuditService } from '../admin-v1/common/services/audit.service';
import {
  generateOfflineCode,
  normalizeOfflineCode,
  maskOfflineCode,
} from './offline-codes.util';
import { Prisma } from '@bahrawy/db';

export type OfflineCodeActor = {
  id: string;
  organizationId: string;
  kind?: string;
};

@Injectable()
export class OfflineCodesService {
  constructor(
    private readonly securityService: SecurityService,
    private readonly auditService: AdminAuditService,
  ) {}

  async generateCodes(
    actor: OfflineCodeActor,
    input: {
      quantity: number;
      courseId: string;
      gradeId?: string;
      expiresAt?: string;
      maxUses?: number;
      reason?: string;
    },
  ) {
    const course = await db.course.findFirst({
      where: { id: input.courseId, organizationId: actor.organizationId },
    });
    if (!course) throw new NotFoundException('Course not found');

    if (input.gradeId) {
      const grade = await db.grade.findFirst({
        where: { id: input.gradeId, organizationId: actor.organizationId },
      });
      if (!grade) throw new NotFoundException('Grade not found');
    }

    let expiresAt: Date | undefined;
    if (input.expiresAt) {
      expiresAt = new Date(input.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new BadRequestException('Invalid expiry date');
      }
    }

    const maxUses = input.maxUses ?? 1;

    const codes: { id: string; code: string }[] = [];

    const batch = await db.$transaction(async (tx) => {
      const batchRecord = await tx.offlineAccessCodeBatch.create({
        data: {
          organizationId: actor.organizationId,
          createdByAccountId: actor.id,
          courseId: input.courseId,
          gradeId: input.gradeId ?? null,
          quantity: input.quantity,
          maxUses,
          expiresAt: expiresAt ?? null,
        },
      });

      for (let i = 0; i < input.quantity; i += 1) {
        const rawCode = generateOfflineCode();
        const normalized = normalizeOfflineCode(rawCode);
        const codeHash = this.securityService.hashOpaqueToken(normalized);
        const codeEncrypted = this.securityService.encrypt(normalized);
        const created = await tx.offlineAccessCode.create({
          data: {
            organizationId: actor.organizationId,
            batchId: batchRecord.id,
            codeHash,
            codePrefix: normalized.slice(0, 4),
            codeEncrypted,
            status: 'ACTIVE',
            courseId: input.courseId,
            gradeId: input.gradeId ?? null,
            createdByAccountId: actor.id,
            maxUses,
            expiresAt: expiresAt ?? null,
          },
          select: { id: true },
        });
        codes.push({ id: created.id, code: rawCode });
      }

      return batchRecord;
    });

    await this.auditService.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'OFFLINE_CODE_BATCH_GENERATED',
      targetType: 'OfflineAccessCodeBatch',
      targetId: batch.id,
      after: {
        quantity: input.quantity,
        courseId: input.courseId,
        gradeId: input.gradeId ?? null,
        maxUses,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      reason: input.reason,
    });

    return {
      batch: {
        id: batch.id,
        quantity: batch.quantity,
        courseId: batch.courseId,
        gradeId: batch.gradeId,
        maxUses: batch.maxUses,
        expiresAt: batch.expiresAt,
        createdAt: batch.createdAt,
      },
      codes,
    };
  }

  private buildCodeWhere(organizationId: string, query: any) {
    const where: Prisma.OfflineAccessCodeWhereInput = {
      organizationId,
      deletedAt: null,
    };
    if (query.search) {
      const search = query.search.trim();
      const phoneHmac = search
        ? this.securityService.generatePhoneHmac(search)
        : undefined;
      where.OR = [
        { codePrefix: { contains: search.toUpperCase() } },
        {
          account: {
            OR: [
              { studentProfile: { displayName: { contains: search } } },
              ...(phoneHmac ? [{ phoneHmac }] : []),
            ],
          },
        },
      ];
    }
    if (query.gradeId) where.gradeId = query.gradeId;
    if (query.courseId) where.courseId = query.courseId;
    if (query.batchId) where.batchId = query.batchId;
    if (query.status === 'EXPIRED') {
      where.status = 'ACTIVE';
      where.expiresAt = { lt: new Date() };
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.used === 'true') {
      where.OR = [{ accountId: { not: null } }, { useCount: { gt: 0 } }];
    } else if (query.used === 'false') {
      where.accountId = null;
      where.useCount = 0;
    }
    if (query.expired === 'true') {
      where.status = 'ACTIVE';
      where.expiresAt = { lt: new Date() };
    }
    if (query.createdFrom) {
      where.createdAt = {
        ...((where.createdAt as any) ?? {}),
        gte: new Date(query.createdFrom),
      };
    }
    if (query.createdTo) {
      where.createdAt = {
        ...((where.createdAt as any) ?? {}),
        lte: new Date(query.createdTo),
      };
    }
    if (query.activatedFrom) {
      where.activatedAt = {
        ...((where.activatedAt as any) ?? {}),
        gte: new Date(query.activatedFrom),
      };
    }
    if (query.activatedTo) {
      where.activatedAt = {
        ...((where.activatedAt as any) ?? {}),
        lte: new Date(query.activatedTo),
      };
    }
    return where;
  }

  private toView(code: any) {
    const now = new Date();
    const isExpired =
      code.status === 'ACTIVE' &&
      code.expiresAt !== null &&
      code.expiresAt.getTime() <= now.getTime();
    const status = isExpired
      ? 'EXPIRED'
      : code.useCount >= code.maxUses
        ? 'USED'
        : code.status;
    return {
      id: code.id,
      code: maskOfflineCode(`${code.codePrefix}XXXX-XXXX-XXXX`),
      status,
      courseId: code.courseId,
      gradeId: code.gradeId,
      batchId: code.batchId,
      maxUses: code.maxUses,
      useCount: code.useCount,
      expiresAt: code.expiresAt,
      activatedAt: code.activatedAt,
      createdAt: code.createdAt,
      updatedAt: code.updatedAt,
      accountId: code.accountId,
      createdByAccountId: code.createdByAccountId,
      student: code.account?.studentProfile
        ? {
            id: code.account.studentProfile.id,
            displayName: code.account.studentProfile.displayName,
            accountId: code.accountId,
          }
        : null,
    };
  }

  async listCodes(organizationId: string, query: any) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const where = this.buildCodeWhere(organizationId, query);

    const [total, items] = await Promise.all([
      db.offlineAccessCode.count({ where }),
      db.offlineAccessCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          account: {
            select: {
              id: true,
              studentProfile: { select: { id: true, displayName: true } },
            },
          },
          course: { select: { id: true, titleAr: true, titleEn: true } },
          grade: { select: { id: true, nameAr: true, nameEn: true } },
          batch: { select: { id: true, createdAt: true } },
        },
      }),
    ]);

    return {
      items: items.map((item) => this.toView(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getCode(organizationId: string, id: string) {
    const code = await db.offlineAccessCode.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        account: {
          select: {
            id: true,
            studentProfile: { select: { id: true, displayName: true } },
          },
        },
        course: { select: { id: true, titleAr: true, titleEn: true } },
        grade: { select: { id: true, nameAr: true, nameEn: true } },
        batch: { select: { id: true, createdAt: true } },
      },
    });
    if (!code) throw new NotFoundException('Offline code not found');
    return this.toView(code);
  }

  async setCodeStatus(
    actor: OfflineCodeActor,
    id: string,
    status: 'ACTIVE' | 'DISABLED',
    reason?: string,
  ) {
    const code = await db.offlineAccessCode.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!code) throw new NotFoundException('Offline code not found');
    if (code.status === status) {
      throw new ConflictException(`Offline code is already ${status}`);
    }

    const updated = await db.offlineAccessCode.update({
      where: { id },
      data: {
        status,
        disabledAt: status === 'DISABLED' ? new Date() : null,
        disabledByAccountId: status === 'DISABLED' ? actor.id : null,
      },
    });

    await this.auditService.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'OFFLINE_CODE_STATUS_CHANGED',
      targetType: 'OfflineAccessCode',
      targetId: id,
      before: { status: code.status },
      after: { status: updated.status },
      reason,
    });

    return this.toView(updated);
  }

  async bulkSetCodeStatus(
    actor: OfflineCodeActor,
    ids: string[],
    status: 'ACTIVE' | 'DISABLED',
    reason?: string,
  ) {
    const codes = await db.offlineAccessCode.findMany({
      where: {
        id: { in: ids },
        organizationId: actor.organizationId,
        deletedAt: null,
      },
    });
    if (codes.length !== ids.length) {
      throw new NotFoundException('One or more offline codes not found');
    }

    const result = await db.offlineAccessCode.updateMany({
      where: {
        id: { in: ids },
        organizationId: actor.organizationId,
        status: { not: status },
      },
      data: {
        status,
        disabledAt: status === 'DISABLED' ? new Date() : null,
        disabledByAccountId: status === 'DISABLED' ? actor.id : null,
      },
    });

    await this.auditService.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'OFFLINE_CODE_BULK_STATUS_CHANGED',
      targetType: 'OfflineAccessCode',
      targetId: ids.join(','),
      after: { status, count: result.count },
      reason,
    });

    return { count: result.count };
  }

  async bulkDeleteCodes(
    actor: OfflineCodeActor,
    ids: string[],
    reason?: string,
  ) {
    const codes = await db.offlineAccessCode.findMany({
      where: {
        id: { in: ids },
        organizationId: actor.organizationId,
        deletedAt: null,
      },
    });
    if (codes.length !== ids.length) {
      throw new NotFoundException('One or more offline codes not found');
    }

    const used = codes.filter((code) => code.useCount > 0 || code.accountId);
    if (used.length > 0) {
      throw new ConflictException(
        `Cannot delete ${used.length} offline code(s) that are already used`,
      );
    }

    const result = await db.offlineAccessCode.updateMany({
      where: {
        id: { in: ids },
        organizationId: actor.organizationId,
        useCount: 0,
        accountId: null,
      },
      data: { deletedAt: new Date() },
    });

    await this.auditService.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'OFFLINE_CODE_BULK_DELETED',
      targetType: 'OfflineAccessCode',
      targetId: ids.join(','),
      after: { count: result.count },
      reason,
    });

    return { count: result.count };
  }

  async listBatches(organizationId: string, query: any) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const where: Prisma.OfflineAccessCodeBatchWhereInput = { organizationId };
    if (query.courseId) where.courseId = query.courseId;
    if (query.gradeId) where.gradeId = query.gradeId;

    const [total, items] = await Promise.all([
      db.offlineAccessCodeBatch.count({ where }),
      db.offlineAccessCodeBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          course: { select: { id: true, titleAr: true, titleEn: true } },
          grade: { select: { id: true, nameAr: true, nameEn: true } },
          _count: {
            select: { codes: { where: { deletedAt: null } } },
          },
        },
      }),
    ]);

    const withStats = await Promise.all(
      items.map(async (batch) => {
        const used = await db.offlineAccessCode.count({
          where: {
            batchId: batch.id,
            deletedAt: null,
            OR: [{ accountId: { not: null } }, { useCount: { gt: 0 } }],
          },
        });
        return { ...batch, usedCount: used };
      }),
    );

    return {
      items: withStats,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getBatch(organizationId: string, batchId: string) {
    const batch = await db.offlineAccessCodeBatch.findFirst({
      where: { id: batchId, organizationId },
      include: {
        course: { select: { id: true, titleAr: true, titleEn: true } },
        grade: { select: { id: true, nameAr: true, nameEn: true } },
        codes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            account: {
              select: {
                id: true,
                studentProfile: { select: { id: true, displayName: true } },
              },
            },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return {
      ...batch,
      codes: batch.codes.map((code) => this.toView(code)),
    };
  }

  async activateCode(
    accountId: string,
    organizationId: string,
    input: { code: string },
  ) {
    const normalized = normalizeOfflineCode(input.code);
    if (normalized.length < 8 || normalized.length > 32) {
      throw new BadRequestException('الكود غير صحيح');
    }
    const codeHash = this.securityService.hashOpaqueToken(normalized);

    const code = await db.offlineAccessCode.findFirst({
      where: { organizationId, codeHash, deletedAt: null },
    });
    if (!code) {
      throw new BadRequestException('الكود غير صحيح');
    }

    const now = new Date();
    if (code.status === 'DISABLED') {
      throw new BadRequestException('الكود غير مفعل');
    }
    if (code.status === 'USED' || (code.maxUses === 1 && code.accountId)) {
      throw new BadRequestException('الكود مستخدم بالفعل');
    }
    if (code.expiresAt && code.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('انتهت صلاحية الكود');
    }
    if (code.useCount >= code.maxUses) {
      throw new BadRequestException('الكود مستخدم بالفعل');
    }
    if (code.courseId) {
      const course = await db.course.findFirst({
        where: { id: code.courseId, organizationId },
      });
      if (!course) {
        throw new BadRequestException('هذا الكود غير متاح لهذا الحساب');
      }
    }

    const entitlement = await db.$transaction(async (tx) => {
      const consumed = await tx.offlineAccessCode.updateMany({
        where: {
          id: code.id,
          organizationId,
          status: 'ACTIVE',
          useCount: { lt: code.maxUses },
          ...(code.expiresAt ? { expiresAt: { gt: now } } : {}),
          ...(code.maxUses === 1 ? { accountId: null } : {}),
        },
        data: {
          useCount: { increment: 1 },
          accountId: code.maxUses === 1 ? accountId : undefined,
          activatedAt: code.maxUses === 1 ? now : undefined,
        },
      });
      if (consumed.count === 0) {
        throw new ConflictException('الكود مستخدم بالفعل');
      }

      const courseProduct = await this.findOrCreateCourseProduct(
        tx,
        organizationId,
        code.courseId,
      );

      const existingEntitlement = await tx.entitlement.findFirst({
        where: {
          accountId,
          productId: courseProduct.id,
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });

      if (!existingEntitlement) {
        await tx.entitlement.create({
          data: {
            accountId,
            productId: courseProduct.id,
            grantedAt: now,
            expiresAt: code.expiresAt ?? null,
            status: 'ACTIVE',
          },
        });
      }

      const useCountAfter = code.useCount + 1;
      if (useCountAfter >= code.maxUses) {
        await tx.offlineAccessCode.update({
          where: { id: code.id },
          data: { status: 'USED', accountId, activatedAt: now },
        });
      }

      return courseProduct;
    });

    await this.auditService.logEvent({
      organizationId,
      actorType: 'STUDENT',
      actorId: accountId,
      action: 'OFFLINE_CODE_ACTIVATED',
      targetType: 'OfflineAccessCode',
      targetId: code.id,
      after: { courseId: code.courseId },
    });

    return {
      courseId: code.courseId,
      productId: entitlement.id,
    };
  }

  private async findOrCreateCourseProduct(
    tx: Prisma.TransactionClient,
    organizationId: string,
    courseId: string,
  ) {
    const existing = await tx.productCourse.findFirst({
      where: { courseId, product: { type: 'COURSE', organizationId } },
      select: { product: { select: { id: true } } },
    });
    if (existing) return { id: existing.product.id };

    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new BadRequestException('هذا الكود غير متاح لهذا الحساب');
    }

    const product = await tx.product.create({
      data: {
        organizationId,
        gradeId: course.gradeId ?? null,
        code: `course-${courseId}`,
        type: 'COURSE',
        titleAr: course.titleAr,
        titleEn: course.titleEn ?? undefined,
        descriptionAr: course.descriptionAr ?? undefined,
        coverImageUrl: course.coverImageUrl ?? undefined,
        status: 'ACTIVE',
      },
    });
    await tx.productCourse.create({
      data: { productId: product.id, courseId },
    });
    return { id: product.id };
  }

  async exportBatch(organizationId: string, batchId: string) {
    const batch = await db.offlineAccessCodeBatch.findFirst({
      where: { id: batchId, organizationId },
      include: {
        course: { select: { id: true, titleAr: true, titleEn: true } },
        grade: { select: { id: true, nameAr: true, nameEn: true } },
        codes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            codeEncrypted: true,
            status: true,
            accountId: true,
            useCount: true,
            maxUses: true,
            createdAt: true,
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    return {
      batchId: batch.id,
      course: batch.course,
      grade: batch.grade,
      createdAt: batch.createdAt,
      quantity: batch.quantity,
      codes: batch.codes.map((code) => {
        const normalized = this.securityService.decrypt(code.codeEncrypted);
        const groups = normalized.match(/.{1,4}/g) ?? [];
        return {
          id: code.id,
          code: groups.join('-'),
          status: code.status,
          accountId: code.accountId,
          useCount: code.useCount,
          maxUses: code.maxUses,
          createdAt: code.createdAt,
        };
      }),
    };
  }
}
