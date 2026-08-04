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
import { LifecycleMutationDto } from '../common/dto/lifecycle.dto';
import { ReasonDto } from '../students/students.dto';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.questionsService.list(
      request.account.organizationId,
      search,
      gradeId,
      archived === 'true',
      Number(page) || 1,
      Number(pageSize) || 25,
    );
  }

  @Post()
  create(@Req() request: AdminRequest, @Body() input: QuestionInputDto) {
    return this.questionsService.create(request.account, input);
  }

  @Patch(':id')
  update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateQuestionDto,
  ) {
    return this.questionsService.update(request.account, id, input);
  }

  @Patch(':id/archive')
  archive(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.questionsService.setArchived(request.account, id, true, input);
  }

  @Patch(':id/restore')
  restore(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.questionsService.setArchived(request.account, id, false, input);
  }

  @Post('assessments/:assessmentId/assign')
  assign(
    @Req() request: AdminRequest,
    @Param('assessmentId') assessmentId: string,
    @Body() input: AssignQuestionsDto,
  ) {
    return this.questionsService.assign(
      request.account,
      assessmentId,
      input.questionIds,
    );
  }

  @Delete('assessments/:assessmentId/:questionId')
  unassign(
    @Req() request: AdminRequest,
    @Param('assessmentId') assessmentId: string,
    @Param('questionId') questionId: string,
    @Body() input: ReasonDto,
  ) {
    return this.questionsService.unassign(
      request.account,
      assessmentId,
      questionId,
      input.reason,
    );
  }
}
