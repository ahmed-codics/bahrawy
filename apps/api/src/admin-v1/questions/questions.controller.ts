import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import {
  AssignQuestionsDto,
  QuestionInputDto,
  UpdateQuestionDto,
} from './questions.dto';
import { AdminV1QuestionsService } from './questions.service';

type AdminRequest = Request & { account: { organizationId: string } };

@Controller('admin/v1/questions')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.ASSESSMENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1QuestionsController {
  constructor(private readonly questionsService: AdminV1QuestionsService) {}

  @Get()
  list(
    @Req() request: AdminRequest,
    @Query('search') search?: string,
    @Query('gradeId') gradeId?: string,
    @Query('archived') archived?: string,
  ) {
    return this.questionsService.list(
      request.account.organizationId,
      search,
      gradeId,
      archived === 'true',
    );
  }

  @Post()
  create(@Req() request: AdminRequest, @Body() input: QuestionInputDto) {
    return this.questionsService.create(request.account.organizationId, input);
  }

  @Patch(':id')
  update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateQuestionDto,
  ) {
    return this.questionsService.update(
      request.account.organizationId,
      id,
      input,
    );
  }

  @Patch(':id/archive')
  archive(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.questionsService.setArchived(
      request.account.organizationId,
      id,
      true,
    );
  }

  @Patch(':id/restore')
  restore(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.questionsService.setArchived(
      request.account.organizationId,
      id,
      false,
    );
  }

  @Post('assessments/:assessmentId/assign')
  assign(
    @Req() request: AdminRequest,
    @Param('assessmentId') assessmentId: string,
    @Body() input: AssignQuestionsDto,
  ) {
    return this.questionsService.assign(
      request.account.organizationId,
      assessmentId,
      input.questionIds,
    );
  }

  @Delete('assessments/:assessmentId/:questionId')
  unassign(
    @Req() request: AdminRequest,
    @Param('assessmentId') assessmentId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.questionsService.unassign(
      request.account.organizationId,
      assessmentId,
      questionId,
    );
  }
}
