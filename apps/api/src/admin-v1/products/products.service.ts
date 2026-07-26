import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { ProductInputDto, UpdateProductDto } from './products.dto';

@Injectable()
export class AdminV1ProductsService {
  list(organizationId: string) {
    return db.product.findMany({
      where: { organizationId },
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
    });
  }

  async create(organizationId: string, input: ProductInputDto) {
    await this.validateMembership(
      organizationId,
      input.gradeId,
      input.courseIds,
      input.unitIds,
    );
    return db.product.create({
      data: {
        organizationId,
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
  }

  async update(organizationId: string, id: string, input: UpdateProductDto) {
    const product = await db.product.findFirst({
      where: { id, organizationId },
      include: { prices: { where: { status: 'ACTIVE' } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (input.version && input.version !== product.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This product was changed by another staff member',
      });
    }
    await this.validateMembership(
      organizationId,
      input.gradeId,
      input.courseIds,
      input.unitIds,
    );

    return db.$transaction(async (tx: any) => {
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
