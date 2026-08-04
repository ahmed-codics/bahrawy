import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Get,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AdminContentService } from './admin-content.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { StorageService } from '../storage/storage.service';
import { StaffPermission } from '@bahrawy/types';

@Controller('admin')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermission(StaffPermission.CATALOG_MANAGE)
export class AdminContentController {
  constructor(
    private readonly adminContentService: AdminContentService,
    private readonly storageService: StorageService,
  ) {}

  @Get('grades/:gradeId/units')
  async listUnits(@Param('gradeId') gradeId: string) {
    const data = await this.adminContentService.listUnits(gradeId);
    return { status: 'SUCCESS', data };
  }

  @Post('grades/:gradeId/units')
  async createUnit(@Param('gradeId') gradeId: string, @Body() body: any) {
    const data = await this.adminContentService.createUnit(gradeId, body);
    return { status: 'SUCCESS', data };
  }

  @Patch('units/:unitId')
  async updateUnit(@Param('unitId') unitId: string, @Body() body: any) {
    const data = await this.adminContentService.updateUnit(unitId, body);
    return { status: 'SUCCESS', data };
  }

  @Delete('units/:unitId')
  async archiveUnit(@Param('unitId') unitId: string) {
    const data = await this.adminContentService.archiveUnit(unitId);
    return { status: 'SUCCESS', data };
  }

  @Patch('grades/:gradeId/units/reorder')
  async reorderUnits(
    @Param('gradeId') gradeId: string,
    @Body() body: { order: string[] },
  ) {
    const data = await this.adminContentService.reorderUnits(
      gradeId,
      body.order ?? [],
    );
    return { status: 'SUCCESS', data };
  }

  @Get('units/:unitId/lessons')
  async listLessons(@Param('unitId') unitId: string) {
    const data = await this.adminContentService.listLessons(unitId);
    return { status: 'SUCCESS', data };
  }

  @Post('units/:unitId/lessons')
  async createLesson(@Param('unitId') unitId: string, @Body() body: any) {
    const data = await this.adminContentService.createLesson(unitId, body);
    return { status: 'SUCCESS', data };
  }

  @Patch('lessons/:lessonId')
  async updateLesson(@Param('lessonId') lessonId: string, @Body() body: any) {
    const data = await this.adminContentService.updateLesson(lessonId, body);
    return { status: 'SUCCESS', data };
  }

  @Delete('lessons/:lessonId')
  async deleteLesson(@Param('lessonId') lessonId: string) {
    const data = await this.adminContentService.deleteLesson(lessonId);
    return { status: 'SUCCESS', data };
  }

  @Patch('units/:unitId/lessons/reorder')
  async reorderLessons(
    @Param('unitId') unitId: string,
    @Body() body: { order: string[] },
  ) {
    const data = await this.adminContentService.reorderLessons(
      unitId,
      body.order ?? [],
    );
    return { status: 'SUCCESS', data };
  }

  @Get('grades/:gradeId/bundles')
  async listBundles(@Param('gradeId') gradeId: string) {
    const data = await this.adminContentService.listBundles(gradeId);
    return { status: 'SUCCESS', data };
  }

  @Post('grades/:gradeId/bundles')
  async createBundle(@Param('gradeId') gradeId: string, @Body() body: any) {
    const data = await this.adminContentService.createBundle(gradeId, body);
    return { status: 'SUCCESS', data };
  }

  @Patch('bundles/:productId')
  async updateBundle(@Param('productId') productId: string, @Body() body: any) {
    const data = await this.adminContentService.updateBundle(productId, body);
    return { status: 'SUCCESS', data };
  }

  @Delete('bundles/:productId')
  async archiveBundle(@Param('productId') productId: string) {
    const data = await this.adminContentService.archiveBundle(productId);
    return { status: 'SUCCESS', data };
  }

  @Get('bundles/:productId/units')
  async listBundleUnits(@Param('productId') productId: string) {
    const data = await this.adminContentService.listBundleUnits(productId);
    return { status: 'SUCCESS', data };
  }

  @Post('bundles/:productId/units')
  async addUnitToBundle(
    @Param('productId') productId: string,
    @Body() body: { unitId: string },
  ) {
    const data = await this.adminContentService.addUnitToBundle(
      productId,
      body.unitId,
    );
    return { status: 'SUCCESS', data };
  }

  @Delete('bundles/:productId/units/:unitId')
  async removeUnitFromBundle(
    @Param('productId') productId: string,
    @Param('unitId') unitId: string,
  ) {
    const data = await this.adminContentService.removeUnitFromBundle(
      productId,
      unitId,
    );
    return { status: 'SUCCESS', data };
  }

  @Post('bundles/:productId/cover')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBundleCover(
    @Req() req: any,
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    this.storageService.validateMimeAndSize(
      file.mimetype,
      file.size,
      file.originalname,
    );
    const uploadDir = path.join(process.cwd(), '.uploads', 'bundle-covers');
    fs.mkdirSync(uploadDir, { recursive: true });
    const objectKey = `${randomUUID()}-${file.originalname}`;
    const filePath = path.join(uploadDir, objectKey);
    fs.writeFileSync(filePath, file.buffer);
    try {
      const stored = await this.storageService.registerUpload({
        organizationId: req.account.organizationId ?? 'org_1',
        uploadedBy: req.account.id,
        bucket: 'bundle-covers',
        objectKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256: this.storageService.computeSha256(file.buffer),
      });
      await this.storageService.markScanResult(stored.id, 'CLEAN');
      const data = await this.adminContentService.updateBundle(productId, {
        coverImageUrl: `/storage/${stored.id}`,
      });
      return { status: 'SUCCESS', data, storedObjectId: stored.id };
    } catch (error) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  @Post('units/:unitId/product')
  async createLessonProduct(
    @Param('unitId') unitId: string,
    @Body() body: any,
  ) {
    const data = await this.adminContentService.createOrUpdateLessonProduct(
      unitId,
      body,
    );
    return { status: 'SUCCESS', data };
  }

  @Patch('units/:unitId/product')
  async updateLessonProduct(
    @Param('unitId') unitId: string,
    @Body() body: any,
  ) {
    const data = await this.adminContentService.createOrUpdateLessonProduct(
      unitId,
      body,
    );
    return { status: 'SUCCESS', data };
  }

  @Post('courses/:courseId/product')
  async createCourseProduct(
    @Param('courseId') courseId: string,
    @Body() body: any,
  ) {
    const data = await this.adminContentService.createOrUpdateCourseProduct(
      courseId,
      body,
    );
    return { status: 'SUCCESS', data };
  }

  @Patch('courses/:courseId/product')
  async updateCourseProduct(
    @Param('courseId') courseId: string,
    @Body() body: any,
  ) {
    const data = await this.adminContentService.createOrUpdateCourseProduct(
      courseId,
      body,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('units/:unitId/assessment')
  async getUnitAssessment(@Param('unitId') unitId: string) {
    const data = await this.adminContentService.getUnitAssessment(unitId);
    return { status: 'SUCCESS', data };
  }

  @Post('units/:unitId/assessment')
  async createUnitAssessment(
    @Param('unitId') unitId: string,
    @Body() body: any,
  ) {
    const data = await this.adminContentService.createUnitAssessment(
      unitId,
      body,
    );
    return { status: 'SUCCESS', data };
  }

  @Patch('assessments/:assessmentId')
  async updateAssessment(
    @Param('assessmentId') assessmentId: string,
    @Body() body: any,
  ) {
    const data = await this.adminContentService.updateAssessment(
      assessmentId,
      body,
    );
    return { status: 'SUCCESS', data };
  }

  @Post('assessments/:assessmentId/questions')
  async addQuestion(
    @Param('assessmentId') assessmentId: string,
    @Body() body: any,
  ) {
    const data = await this.adminContentService.addQuestion(assessmentId, body);
    return { status: 'SUCCESS', data };
  }

  @Delete('assessments/:assessmentId/questions/:questionId')
  async removeQuestion(
    @Param('assessmentId') assessmentId: string,
    @Param('questionId') questionId: string,
  ) {
    const data = await this.adminContentService.removeQuestion(
      assessmentId,
      questionId,
    );
    return { status: 'SUCCESS', data };
  }
}
