import {
  Body,
  Controller,
  Get,
  Param,
  Put,
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
import { UpsertLessonQuizDto } from './lesson-quiz.dto';
import { AdminV1LessonQuizService } from './lesson-quiz.service';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/lessons')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.CATALOG_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1LessonQuizController {
  constructor(private readonly lessonQuizService: AdminV1LessonQuizService) {}

  @Get(':lessonId/lesson-quiz')
  get(@Req() request: AdminRequest, @Param('lessonId') lessonId: string) {
    return this.lessonQuizService.get(request.account.organizationId, lessonId);
  }

  @Put(':lessonId/lesson-quiz')
  upsert(
    @Req() request: AdminRequest,
    @Param('lessonId') lessonId: string,
    @Body() input: UpsertLessonQuizDto,
  ) {
    return this.lessonQuizService.upsert(request.account, lessonId, input);
  }
}
