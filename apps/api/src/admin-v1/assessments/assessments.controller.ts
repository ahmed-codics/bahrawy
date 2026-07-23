import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffPermission } from '@bahrawy/types';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequireAdminPermission } from '../common/decorators/require-permission.decorator';
import { AdminApiErrorFilter } from '../common/filters/admin-error.filter';
import { AdminApiResponseInterceptor } from '../common/interceptors/admin-response.interceptor';
import { CreateAssessmentDto, UpdateAssessmentDto } from './assessments.dto';
import { AdminV1AssessmentsService } from './assessments.service';

type AdminRequest = Request & { account: { organizationId: string } };

@Controller('admin/v1/assessments')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.ASSESSMENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1AssessmentsController {
  constructor(private readonly assessmentsService: AdminV1AssessmentsService) {}

  @Get(':id')
  detail(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.assessmentsService.detail(request.account.organizationId, id);
  }

  @Post('lessons/:lessonId')
  create(
    @Req() request: AdminRequest,
    @Param('lessonId') lessonId: string,
    @Body() input: CreateAssessmentDto,
  ) {
    return this.assessmentsService.createForLesson(
      request.account.organizationId,
      lessonId,
      input,
    );
  }

  @Patch(':id')
  update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateAssessmentDto,
  ) {
    return this.assessmentsService.update(
      request.account.organizationId,
      id,
      input,
    );
  }
}
