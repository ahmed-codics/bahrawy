import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AdminAssessmentService } from './admin-assessment.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { StaffPermission } from '@bahrawy/types';

@Controller('admin/assessment')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermission(StaffPermission.ASSESSMENT_MANAGE)
export class AdminAssessmentController {
  constructor(private readonly assessmentService: AdminAssessmentService) {}

  @Get('questions')
  async listQuestions(@Req() req: any, @Query('gradeId') gradeId?: string) {
    const organizationId =
      req.account.organizationId || (await this.getDefaultOrgId());
    return this.assessmentService.listQuestions(organizationId, gradeId);
  }

  @Get('questions/:id')
  async getQuestion(@Param('id') id: string) {
    return this.assessmentService.getQuestionById(id);
  }

  @Post('questions')
  async createQuestion(@Req() req: any, @Body() data: any) {
    const organizationId =
      req.account.organizationId || (await this.getDefaultOrgId());
    return this.assessmentService.createQuestion(organizationId, data);
  }

  @Put('questions/:id')
  async updateQuestion(@Param('id') id: string, @Body() data: any) {
    return this.assessmentService.updateQuestion(id, data);
  }

  @Delete('questions/:id')
  async deleteQuestion(@Param('id') id: string) {
    return this.assessmentService.deleteQuestion(id);
  }

  // --- Assessments ---
  @Get('course/:courseId/assessments')
  async listAssessments(@Param('courseId') courseId: string) {
    return this.assessmentService.listAssessments(courseId);
  }

  @Get('lesson/:lessonId')
  async getAssessmentByLesson(@Param('lessonId') lessonId: string) {
    return this.assessmentService.getAssessmentByLesson(lessonId);
  }

  @Post('course/:courseId/assessments')
  async createAssessment(
    @Param('courseId') courseId: string,
    @Body() data: any,
  ) {
    return this.assessmentService.createAssessment(courseId, data);
  }

  @Get('assessments/:id')
  async getAssessment(@Param('id') id: string) {
    return this.assessmentService.getAssessmentById(id);
  }

  private async getDefaultOrgId() {
    const { db } = await import('@bahrawy/db');
    const org = await db.organization.findFirst();
    return org?.id || '';
  }
}
