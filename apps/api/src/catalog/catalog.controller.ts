import { Controller, Get, Post, Param, Req, UseGuards, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { StaffPermission } from '@bahrawy/types';
import { DeviceGuard } from '../device-lease/device.guard';
import { db } from '@bahrawy/db';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('settings')
  async getSettings() {
    const data = await this.catalogService.getOrganizationSettings();
    return { status: 'SUCCESS', data };
  }

  @Get('grades')
  async getPublicGrades() {
    // Re-use admin service or simple query
    const data = await this.catalogService.getGrades();
    return { status: 'SUCCESS', data };
  }

  @Get('grades/:gradeId/bundles')
  async getGradeBundles(@Param('gradeId') gradeId: string) {
    const data = await this.catalogService.getBundlesForGrade(gradeId);
    return { status: 'SUCCESS', data };
  }

  @Get('grades/:gradeId/units')
  async getGradeUnits(@Param('gradeId') gradeId: string) {
    const data = await this.catalogService.getUnitsForGrade(gradeId);
    return { status: 'SUCCESS', data };
  }

  @Get('products')
  async getPublicProducts(@Query('gradeId') gradeId?: string) {
    const data = await this.catalogService.getPublicProducts(gradeId);
    return { status: 'SUCCESS', data };
  }

  @Get('my-products')
  @UseGuards(SessionAuthGuard)
  async getMyProducts(@Req() req: any, @Query('gradeId') gradeId?: string) {
    const data = await this.catalogService.getProductsForAccount(
      req.account.id,
      gradeId,
    );
    return { status: 'SUCCESS', data };
  }

  @Post('fix-drafts')
  @UseGuards(SessionAuthGuard, PermissionsGuard)
  @RequirePermission(StaffPermission.CATALOG_MANAGE)
  async fixDrafts() {
    return this.catalogService.fixDrafts();
  }

  @Get('products/:id')
  async getPublicProduct(@Param('id') id: string) {
    const data = await this.catalogService.getPublicProduct(id);
    return { status: 'SUCCESS', data };
  }

  @Get('bundles/:productId')
  @UseGuards(SessionAuthGuard)
  async getBundleDetail(
    @Req() req: any,
    @Param('productId') productId: string,
  ) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.catalogService.getBundleDetail(
      productId,
      req.account.id,
      isStaff,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('units/:unitId')
  @UseGuards(SessionAuthGuard)
  async getUnitDetail(@Req() req: any, @Param('unitId') unitId: string) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.catalogService.getUnitDetail(
      unitId,
      req.account.id,
      isStaff,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('units/:unitId/access')
  @UseGuards(SessionAuthGuard)
  async getUnitAccess(@Req() req: any, @Param('unitId') unitId: string) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.catalogService.getUnitAccess(
      req.account.id,
      unitId,
      isStaff,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('courses')
  async getPublishedCourses() {
    const data = await db.course.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      include: {
        products: {
          include: {
            product: {
              include: { prices: { where: { status: 'ACTIVE' } } },
            },
          },
        },
        chapters: {
          where: { status: 'PUBLISHED' },
          include: {
            units: {
              where: { status: 'PUBLISHED' },
              include: {
                lessons: {
                  where: { status: 'PUBLISHED' },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    return { status: 'SUCCESS', data };
  }

  @Get('my-courses')
  @UseGuards(SessionAuthGuard)
  async getEntitledCourses(@Req() req: any) {
    const data = await this.catalogService.getEntitledCourses(req.account.id);
    return { status: 'SUCCESS', data };
  }

  @Get('courses/:id')
  @UseGuards(SessionAuthGuard)
  async getCourseDetail(@Req() req: any, @Param('id') courseId: string) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.catalogService.getCourseDetail(
      courseId,
      req.account.id,
      isStaff,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('courses/:courseId/lessons/:id')
  @UseGuards(SessionAuthGuard, DeviceGuard)
  async getCourseLessonDetail(@Req() req: any, @Param('id') lessonId: string) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.catalogService.getLessonDetail(
      lessonId,
      req.account.id,
      isStaff,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('lessons/:id')
  @UseGuards(SessionAuthGuard, DeviceGuard)
  async getLessonDetail(@Req() req: any, @Param('id') lessonId: string) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.catalogService.getLessonDetail(
      lessonId,
      req.account.id,
      isStaff,
    );
    return { status: 'SUCCESS', data };
  }
}
