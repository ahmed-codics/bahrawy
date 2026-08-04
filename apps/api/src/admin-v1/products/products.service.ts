import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import type { AdminDeletionImpact } from '@bahrawy/types';
import {
  ProductInputDto,
  UpdateProductDto,
  UpsertCommerceDto,
} from './products.dto';
import { AdminAuditService } from '../common/services/audit.service';
import {
  LifecycleMutationDto,
  PermanentDeleteDto,
} from '../common/dto/lifecycle.dto';

@Injectable()
export class AdminV1ProductsService {
  constructor(private readonly audit: AdminAuditService) {}

  async list(
    organizationId: string,
    search?: string,
    status?: string,
    gradeId?: string,
    page = 1,
    pageSize = 24,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const currentPage = Math.max(page, 1);
    const normalizedSearch = search?.trim();
    const where = {
      organizationId,
      ...(status ? { status } : {}),
      ...(gradeId ? { gradeId } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              {
                titleAr: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
              {
                titleEn: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
              {
                code: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        skip: (currentPage - 1) * take,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          grade: true,
          prices: { orderBy: { createdAt: 'desc' } },
          courses: { include: { course: true } },
          unitEntries: {
            include: {
              unit: { include: { chapter: { include: { course: true } } } },
            },
          },
          _count: { select: { entitlements: true } },
        },
      }),
      db.product.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: currentPage,
        pageSize: take,
        total,
        pageCount: Math.max(1, Math.ceil(total / take)),
      },
    };
  }

  async create(
    actor: { id: string; organizationId: string },
    input: ProductInputDto,
  ) {
    await this.validateMembership(
      actor.organizationId,
      input.gradeId,
      input.courseIds,
      input.unitIds,
    );
    const created = await db.product.create({
      data: {
        organizationId: actor.organizationId,
        gradeId: input.gradeId,
        code: input.code,
        titleAr: input.titleAr,
        titleEn: input.titleEn,
        descriptionAr: input.descriptionAr,
        coverImageUrl: input.coverImageUrl,
        type: input.type ?? 'BUNDLE',
        status: input.status ?? 'DRAFT',
        publishAt: input.publishAt ? new Date(input.publishAt) : undefined,
        unpublishAt: input.unpublishAt
          ? new Date(input.unpublishAt)
          : undefined,
        courses: {
          create: [...new Set(input.courseIds ?? [])].map((courseId) => ({
            courseId,
          })),
        },
        unitEntries: {
          create: [...new Set(input.unitIds ?? [])].map((unitId) => ({
            unitId,
          })),
        },
        ...(input.priceAmount !== undefined
          ? {
              prices: {
                create: {
                  amount: input.priceAmount,
                  currency: input.currency ?? 'EGP',
                  billingPeriod: input.billingPeriod ?? 'ONCE',
                  status: 'ACTIVE',
                },
              },
            }
          : {}),
      },
      include: { grade: true, prices: true, courses: true, unitEntries: true },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'PRODUCT_CREATED',
      targetType: 'PRODUCT',
      targetId: created.id,
      after: created,
    });
    return created;
  }

  async detail(organizationId: string, id: string) {
    const product = await db.product.findFirst({
      where: { id, organizationId },
      include: {
        grade: true,
        prices: { orderBy: { createdAt: 'desc' } },
        courses: {
          include: {
            course: {
              select: {
                id: true,
                code: true,
                titleAr: true,
                status: true,
                gradeId: true,
              },
            },
          },
        },
        unitEntries: {
          include: {
            unit: {
              include: {
                chapter: {
                  include: {
                    course: {
                      select: {
                        id: true,
                        code: true,
                        titleAr: true,
                        gradeId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: { select: { entitlements: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(
    actor: { id: string; organizationId: string },
    id: string,
    input: UpdateProductDto,
  ) {
    const product = await db.product.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { prices: { where: { status: 'ACTIVE' } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (input.version !== product.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This product was changed by another staff member',
        conflict: { currentVersion: product.version },
      });
    }
    await this.validateMembership(
      actor.organizationId,
      input.gradeId,
      input.courseIds,
      input.unitIds,
    );

    const updated = await db.$transaction(async (tx: any) => {
      await tx.product.update({
        where: { id },
        data: {
          titleAr: input.titleAr,
          gradeId: input.gradeId,
          titleEn: input.titleEn,
          descriptionAr: input.descriptionAr,
          coverImageUrl: input.coverImageUrl,
          type: input.type,
          status: input.status,
          publishAt: input.publishAt
            ? new Date(input.publishAt)
            : input.publishAt === '' || input.publishAt === null
              ? null
              : undefined,
          unpublishAt: input.unpublishAt
            ? new Date(input.unpublishAt)
            : input.unpublishAt === '' || input.unpublishAt === null
              ? null
              : undefined,
          archivedAt:
            input.status === 'ARCHIVED'
              ? new Date()
              : input.status
                ? null
                : undefined,
          version: { increment: 1 },
        },
      });
      if (input.courseIds) {
        await tx.productCourse.deleteMany({ where: { productId: id } });
        if (input.courseIds.length) {
          await tx.productCourse.createMany({
            data: [...new Set(input.courseIds)].map((courseId) => ({
              productId: id,
              courseId,
            })),
          });
        }
      }
      if (input.unitIds) {
        await tx.productUnit.deleteMany({ where: { productId: id } });
        if (input.unitIds.length) {
          await tx.productUnit.createMany({
            data: [...new Set(input.unitIds)].map((unitId) => ({
              productId: id,
              unitId,
            })),
          });
        }
      }
      if (input.priceAmount !== undefined) {
        await tx.price.updateMany({
          where: { productId: id, status: 'ACTIVE' },
          data: {
            status: 'RETIRED',
            archivedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.price.create({
          data: {
            productId: id,
            amount: input.priceAmount,
            currency: input.currency ?? product.prices[0]?.currency ?? 'EGP',
            billingPeriod:
              input.billingPeriod ?? product.prices[0]?.billingPeriod ?? 'ONCE',
            status: 'ACTIVE',
          },
        });
      }
      return tx.product.findUnique({
        where: { id },
        include: {
          grade: true,
          prices: { orderBy: { createdAt: 'desc' } },
          courses: { include: { course: true } },
          unitEntries: true,
        },
      });
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'PRODUCT_UPDATED',
      targetType: 'PRODUCT',
      targetId: id,
      before: product,
      after: updated,
    });
    return updated;
  }

  async deletionImpact(
    organizationId: string,
    id: string,
  ): Promise<AdminDeletionImpact> {
    const product = await db.product.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { entitlements: true, courses: true, unitEntries: true },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    const payments = await db.paymentOrder.count({ where: { productId: id } });
    const blockers = [
      {
        code: 'ENTITLEMENTS',
        label: 'صلاحيات وصول للطلاب',
        count: product._count.entitlements,
      },
      { code: 'PAYMENTS', label: 'طلبات دفع مرتبطة', count: payments },
    ].filter((item) => item.count > 0);
    const canPermanentlyDelete = blockers.length === 0;
    return {
      id,
      resource: 'product',
      label: product.titleAr,
      currentStatus: product.status,
      actions: [
        product.status === 'ARCHIVED' ? 'RESTORE' : 'ARCHIVE',
        ...(canPermanentlyDelete ? (['PERMANENT_DELETE'] as const) : []),
      ],
      blockers,
      affectedChildren: [
        {
          type: 'course',
          label: 'كورسات مشمولة',
          count: product._count.courses,
        },
        {
          type: 'unit',
          label: 'وحدات مشمولة',
          count: product._count.unitEntries,
        },
      ].filter((item) => item.count > 0),
      requiresReason: true,
      requiresTypedConfirmation: canPermanentlyDelete,
    };
  }

  async setArchived(
    actor: { id: string; organizationId: string },
    id: string,
    archived: boolean,
    input: LifecycleMutationDto,
  ) {
    const product = await this.assertProduct(actor.organizationId, id);
    this.assertVersion(product.version, input.version);
    const updated = await db.product.update({
      where: { id },
      data: {
        status: archived ? 'ARCHIVED' : 'DRAFT',
        archivedAt: archived ? new Date() : null,
        version: { increment: 1 },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: archived ? 'PRODUCT_ARCHIVED' : 'PRODUCT_RESTORED',
      targetType: 'PRODUCT',
      targetId: id,
      before: product,
      after: updated,
      reason: input.reason,
    });
    return updated;
  }

  async permanentlyDelete(
    actor: { id: string; organizationId: string },
    id: string,
    input: PermanentDeleteDto,
  ) {
    const product = await this.assertProduct(actor.organizationId, id);
    this.assertVersion(product.version, input.version);
    if (![product.titleAr, product.code].includes(input.confirmation.trim())) {
      throw new BadRequestException('Confirmation does not match the product');
    }
    const impact = await this.deletionImpact(actor.organizationId, id);
    if (!impact.actions.includes('PERMANENT_DELETE')) {
      throw new ForbiddenException({
        code: 'DELETE_BLOCKED',
        message: 'This product has payment or entitlement history',
        blockers: impact.blockers,
      });
    }
    await db.product.delete({ where: { id } });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'PRODUCT_PERMANENTLY_DELETED',
      targetType: 'PRODUCT',
      targetId: id,
      before: product,
      reason: input.reason,
    });
    return { id };
  }

  async upsertCourseCommerce(
    actor: { id: string; organizationId: string },
    courseId: string,
    input: UpsertCommerceDto,
  ) {
    const course = await db.course.findFirst({
      where: { id: courseId, organizationId: actor.organizationId },
      include: {
        products: {
          include: {
            product: {
              include: {
                prices: {
                  where: { status: 'ACTIVE' },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    const existing = course.products
      .map((entry: any) => entry.product)
      .find((product: any) => product.type === 'COURSE');
    return this.upsertCommerceProduct(actor, {
      existing,
      type: 'COURSE',
      titleAr: input.titleAr ?? course.titleAr,
      titleEn: input.titleEn ?? course.titleEn ?? undefined,
      descriptionAr: input.descriptionAr ?? course.descriptionAr ?? undefined,
      coverImageUrl: input.coverImageUrl ?? course.coverImageUrl ?? undefined,
      gradeId: course.gradeId ?? undefined,
      priceAmount: input.priceAmount,
      currency: input.currency,
      version: input.version,
      membership: { courseId },
    });
  }

  async upsertUnitCommerce(
    actor: { id: string; organizationId: string },
    unitId: string,
    input: UpsertCommerceDto,
  ) {
    const unit = await db.unit.findFirst({
      where: {
        id: unitId,
        chapter: { course: { organizationId: actor.organizationId } },
      },
      include: {
        chapter: { include: { course: true } },
        productEntries: {
          include: {
            product: {
              include: {
                prices: {
                  where: { status: 'ACTIVE' },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const existing = unit.productEntries
      .map((entry: any) => entry.product)
      .find((product: any) => product.type === 'LESSON');
    return this.upsertCommerceProduct(actor, {
      existing,
      type: 'LESSON',
      titleAr: input.titleAr ?? unit.titleAr,
      titleEn: input.titleEn ?? unit.titleEn ?? undefined,
      descriptionAr: input.descriptionAr,
      coverImageUrl: input.coverImageUrl,
      gradeId: unit.chapter.course.gradeId ?? undefined,
      priceAmount: input.priceAmount,
      currency: input.currency,
      version: input.version,
      membership: { unitId },
    });
  }

  private async upsertCommerceProduct(
    actor: { id: string; organizationId: string },
    input: {
      existing?: {
        id: string;
        version: number;
        prices: Array<{ currency: string }>;
      };
      type: 'COURSE' | 'LESSON';
      titleAr: string;
      titleEn?: string;
      descriptionAr?: string;
      coverImageUrl?: string;
      gradeId?: string;
      priceAmount: number;
      currency?: string;
      version?: number;
      membership: { courseId?: string; unitId?: string };
    },
  ) {
    if (input.existing) {
      if (!input.version) {
        throw new BadRequestException('Version is required');
      }
      this.assertVersion(input.existing.version, input.version);
    }
    const before = input.existing ?? null;
    const product = await db.$transaction(async (tx: any) => {
      let productId = input.existing?.id;
      if (!productId) {
        const created = await tx.product.create({
          data: {
            organizationId: actor.organizationId,
            gradeId: input.gradeId,
            code: `${input.type.toLowerCase()}-${input.membership.courseId ?? input.membership.unitId}`,
            type: input.type,
            titleAr: input.titleAr,
            titleEn: input.titleEn,
            descriptionAr: input.descriptionAr,
            coverImageUrl: input.coverImageUrl,
            status: 'ACTIVE',
            ...(input.membership.courseId
              ? { courses: { create: { courseId: input.membership.courseId } } }
              : {
                  unitEntries: { create: { unitId: input.membership.unitId } },
                }),
          },
        });
        productId = created.id;
      } else {
        await tx.product.update({
          where: { id: productId },
          data: {
            titleAr: input.titleAr,
            titleEn: input.titleEn,
            descriptionAr: input.descriptionAr,
            coverImageUrl: input.coverImageUrl,
            version: { increment: 1 },
          },
        });
        await tx.price.updateMany({
          where: { productId, status: 'ACTIVE' },
          data: {
            status: 'RETIRED',
            archivedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }
      await tx.price.create({
        data: {
          productId,
          amount: input.priceAmount,
          currency:
            input.currency ?? input.existing?.prices[0]?.currency ?? 'EGP',
          billingPeriod: 'ONCE',
          status: 'ACTIVE',
        },
      });
      return tx.product.findUnique({
        where: { id: productId },
        include: { prices: { orderBy: { createdAt: 'desc' } } },
      });
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: input.existing ? 'COMMERCE_UPDATED' : 'COMMERCE_CREATED',
      targetType: 'PRODUCT',
      targetId: product.id,
      before,
      after: product,
    });
    return product;
  }

  private async assertProduct(organizationId: string, id: string) {
    const product = await db.product.findFirst({
      where: { id, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private assertVersion(currentVersion: number, requestedVersion: number) {
    if (currentVersion !== requestedVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This product was changed by another staff member',
        conflict: { currentVersion },
      });
    }
  }

  private async validateMembership(
    organizationId: string,
    gradeId?: string,
    courseIds?: string[],
    unitIds?: string[],
  ) {
    if (gradeId) {
      const grade = await db.grade.findFirst({
        where: { id: gradeId, organizationId, archivedAt: null },
        select: { id: true },
      });
      if (!grade) {
        throw new BadRequestException('Grade is invalid');
      }
    }
    if (courseIds) {
      const count = await db.course.count({
        where: { organizationId, id: { in: [...new Set(courseIds)] } },
      });
      if (count !== new Set(courseIds).size) {
        throw new BadRequestException('One or more courses are invalid');
      }
    }
    if (unitIds) {
      const count = await db.unit.count({
        where: {
          id: { in: [...new Set(unitIds)] },
          chapter: { course: { organizationId } },
        },
      });
      if (count !== new Set(unitIds).size) {
        throw new BadRequestException('One or more lessons are invalid');
      }
    }
  }
}
