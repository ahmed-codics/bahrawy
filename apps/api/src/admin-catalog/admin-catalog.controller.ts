import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Put,
  Patch,
  Delete,
  Req,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { AdminCatalogService } from './admin-catalog.service';
import { RequirePermission } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { db, PublishStatus } from '@bahrawy/db';
import { StaffPermission } from '@bahrawy/types';

type AssessmentUpdateBody = {
  titleAr?: string;
  type?: string;
  durationMinutes?: number;
  passingScore?: number | null;
  maxAttempts?: number | null;
  shuffleQuestions?: boolean;
  status?: PublishStatus;
  resultReleaseRule?: string;
};

type QuestionUpdateBody = {
  titleAr?: string;
  titleEn?: string;
  passage?: string;
  options?: Array<{ id: string; text: string }>;
  choices?: Array<{ id: string; text: string }>;
  correctOptionId?: string;
  explanation?: string;
  imageUrl?: string | null;
  points?: number;
  tags?: string[];
  sort?: number;
};

@Controller('admin/catalog')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermission(StaffPermission.CATALOG_MANAGE)
export class AdminCatalogController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  @Get('grades')
  async listGrades() {
    return this.adminCatalogService.listGrades();
  }

  @Get('courses')
  async listCourses(@Query('gradeId') gradeId?: string) {
    return this.adminCatalogService.listCourses(gradeId);
  }

  @Post('courses')
  async createCourse(
    @Body()
    data: {
      code: string;
      titleAr: string;
      titleEn?: string;
      descriptionAr?: string;
      gradeId?: string;
    },
  ) {
    return this.adminCatalogService.createCourse(data);
  }

  @Patch('courses/:id')
  async updateCourse(
    @Param('id') id: string,
    @Body()
    data: { titleAr?: string; titleEn?: string; descriptionAr?: string },
  ) {
    return this.adminCatalogService.updateCourse(id, data);
  }

  @Post('courses/:id/publish')
  async publishCourse(@Param('id') id: string) {
    return this.adminCatalogService.publishCourse(id);
  }

  @Post('courses/:id/archive')
  async archiveCourse(@Param('id') id: string) {
    return this.adminCatalogService.archiveCourse(id);
  }

  @Delete('lessons/:id')
  async deleteLesson(@Param('id') id: string) {
    return this.adminCatalogService.deleteLesson(id);
  }

  // --- Products ---
  @Get('products')
  async listProducts(@Req() req: any) {
    const orgId = req.account.organizationId || (await this.getDefaultOrgId());
    return this.adminCatalogService.listProducts(orgId);
  }

  @Post('products')
  async createProduct(@Req() req: any, @Body() data: any) {
    const orgId = req.account.organizationId || (await this.getDefaultOrgId());
    return this.adminCatalogService.createProduct(orgId, data);
  }

  private async getDefaultOrgId() {
    return 'default-org-id';
  }

  @Get('courses/:id')
  async getCourse(@Param('id') id: string) {
    return this.adminCatalogService.getCourseById(id);
  }

  @Get('courses/:id/with-assessments')
  async getCourseWithAssessments(@Param('id') id: string) {
    return this.adminCatalogService.getCourseWithAssessments(id);
  }

  @Post('courses/:courseId/chapters')
  async addChapter(
    @Param('courseId') courseId: string,
    @Body() data: { titleAr: string; titleEn?: string },
  ) {
    return this.adminCatalogService.addChapter(courseId, data);
  }

  @Post('chapters/:chapterId/units')
  async addUnit(
    @Param('chapterId') chapterId: string,
    @Body() data: { titleAr: string; titleEn?: string },
  ) {
    return this.adminCatalogService.addUnit(chapterId, data);
  }

  @Post('units/:unitId/lessons')
  async addLesson(
    @Param('unitId') unitId: string,
    @Body() data: { titleAr: string; titleEn?: string; contentType: string },
  ) {
    return this.adminCatalogService.addLesson(unitId, data);
  }
}

@Controller('staff')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermission(StaffPermission.CATALOG_MANAGE)
export class StaffCatalogController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  @Post('courses')
  async createCourse(@Body() data: any) {
    return this.adminCatalogService.createCourse(data);
  }

  @Put('courses/:courseId')
  async updateCourse(@Param('courseId') courseId: string, @Body() data: any) {
    return this.adminCatalogService.updateCourse(courseId, data);
  }

  @Delete('courses/:courseId')
  async archiveCourse(@Param('courseId') courseId: string) {
    return this.adminCatalogService.archiveCourse(courseId);
  }

  @Post('courses/:courseId/chapters')
  async createChapter(@Param('courseId') courseId: string, @Body() data: any) {
    return this.adminCatalogService.addChapter(courseId, data);
  }

  @Put('courses/:courseId/chapters/:id')
  async updateChapter(@Param('id') id: string, @Body() data: any) {
    const chapter = await db.chapter.update({ where: { id }, data });
    return { status: 'SUCCESS', data: chapter };
  }

  @Delete('courses/:courseId/chapters/:id')
  async deleteChapter(@Param('id') id: string) {
    await db.chapter.delete({ where: { id } });
    return { status: 'SUCCESS' };
  }

  @Post('chapters/:chapterId/units')
  async createUnit(@Param('chapterId') chapterId: string, @Body() data: any) {
    return this.adminCatalogService.addUnit(chapterId, data);
  }

  @Put('chapters/:chapterId/units/:id')
  async updateUnit(@Param('id') id: string, @Body() data: any) {
    return this.adminCatalogService.updateUnit(id, data);
  }

  @Delete('chapters/:chapterId/units/:id')
  async deleteUnit(@Param('id') id: string) {
    await db.unit.delete({ where: { id } });
    return { status: 'SUCCESS' };
  }

  @Post('units/:unitId/lessons')
  async createLesson(@Param('unitId') unitId: string, @Body() data: any) {
    const result = await this.adminCatalogService.addLesson(unitId, data);
    if (data.storedObjectId && result.data?.id) {
      await db.lesson.update({
        where: { id: result.data.id },
        data: { contentUrl: data.storedObjectId },
      });
    }
    return result;
  }

  @Put('units/:unitId/lessons/:id')
  async updateLesson(@Param('id') id: string, @Body() data: any) {
    const lesson = await db.lesson.update({
      where: { id },
      data: {
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        contentType: data.contentType,
        contentUrl: data.storedObjectId ?? data.contentUrl,
        durationSeconds: data.durationSeconds,
        sort: data.sort,
        status: data.status,
      },
    });
    return { status: 'SUCCESS', data: lesson };
  }

  @Delete('units/:unitId/lessons/:id')
  async deleteLesson(@Param('id') id: string) {
    return this.adminCatalogService.deleteLesson(id);
  }

  @Post('lessons/:lessonId/assessment')
  async createLessonAssessment(
    @Param('lessonId') lessonId: string,
    @Body() data: any,
  ) {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: { unit: { include: { chapter: true } } },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    const assessment = await db.assessment.create({
      data: {
        courseId: lesson.unit.chapter.courseId,
        lessonId,
        unitId: lesson.unitId,
        titleAr: data.titleAr ?? lesson.titleAr,
        titleEn: data.titleEn ?? lesson.titleEn,
        durationMinutes:
          data.durationMinutes !== undefined
            ? Number(data.durationMinutes)
            : 30,
        passingScore:
          data.passingScore === null
            ? null
            : data.passingScore === undefined
              ? undefined
              : Number(data.passingScore),
        maxAttempts:
          data.maxAttempts === null
            ? null
            : data.maxAttempts === undefined
              ? undefined
              : Number(data.maxAttempts),
        shuffleQuestions: Boolean(data.shuffleQuestions),
        status: data.status ?? 'DRAFT',
        type: data.type ?? 'QUIZ',
        resultReleaseRule: data.resultReleaseRule ?? 'IMMEDIATE',
      },
    });
    return { status: 'SUCCESS', data: assessment };
  }

  @Patch('assessments/:assessmentId')
  async updateAssessment(
    @Param('assessmentId') assessmentId: string,
    @Body() data: AssessmentUpdateBody,
  ) {
    const assessment = await db.assessment.update({
      where: { id: assessmentId },
      data: {
        titleAr: data.titleAr,
        type: data.type,
        durationMinutes:
          data.durationMinutes !== undefined
            ? Number(data.durationMinutes)
            : undefined,
        passingScore:
          data.passingScore === null
            ? null
            : data.passingScore === undefined
              ? undefined
              : Number(data.passingScore),
        maxAttempts:
          data.maxAttempts === null
            ? null
            : data.maxAttempts === undefined
              ? undefined
              : Number(data.maxAttempts),
        shuffleQuestions: data.shuffleQuestions,
        status: data.status,
        resultReleaseRule: data.resultReleaseRule,
      },
    });
    return { status: 'SUCCESS', data: assessment };
  }

  @Post('assessments/:assessmentId/questions')
  async addQuestion(
    @Param('assessmentId') assessmentId: string,
    @Body() data: QuestionUpdateBody,
  ) {
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      include: { course: true, questions: true },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    if (!data.titleAr || !data.correctOptionId) {
      throw new BadRequestException(
        'Question title and correct option are required',
      );
    }
    const question = await db.question.create({
      data: {
        organizationId: assessment.course.organizationId,
        gradeId: assessment.course.gradeId,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        passage: data.passage,
        options: data.options ?? data.choices ?? [],
        correctOptionId: data.correctOptionId,
        explanation: data.explanation,
        imageUrl: data.imageUrl,
        points: Number(data.points) || 1,
        tags: data.tags ?? [],
      },
    });
    await db.assessmentQuestion.create({
      data: {
        assessmentId,
        questionId: question.id,
        sort: data.sort ?? assessment.questions.length,
      },
    });
    return { status: 'SUCCESS', data: question };
  }

  @Patch('assessments/:assessmentId/questions/:questionId')
  async updateAssessmentQuestion(
    @Param('questionId') questionId: string,
    @Body() data: QuestionUpdateBody,
  ) {
    const question = await db.question.update({
      where: { id: questionId },
      data: {
        titleAr: data.titleAr,
        options: data.options,
        correctOptionId: data.correctOptionId,
        explanation: data.explanation,
        imageUrl: data.imageUrl,
        points: data.points !== undefined ? Number(data.points) : undefined,
      },
    });
    return { status: 'SUCCESS', data: question };
  }

  @Delete('assessments/:assessmentId/questions/:questionId')
  async removeAssessmentQuestion(
    @Param('assessmentId') assessmentId: string,
    @Param('questionId') questionId: string,
  ) {
    await db.assessmentQuestion.delete({
      where: { assessmentId_questionId: { assessmentId, questionId } },
    });
    const otherUses = await db.assessmentQuestion.count({
      where: { questionId },
    });
    if (otherUses === 0) {
      await db.question.delete({ where: { id: questionId } });
    }
    return { status: 'SUCCESS' };
  }
}
