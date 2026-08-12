import {
  Controller,
  Get,
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
import { AdminV1ExamResultsService } from './exam-results.service';
import { ExamResultsListQueryDto } from './exam-results.dto';

type AdminRequest = Request & {
  account: { id: string; organizationId: string; kind: string };
};

@Controller('admin/v1/exam-results')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.ASSESSMENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1ExamResultsController {
  constructor(private readonly examResults: AdminV1ExamResultsService) {}

  @Get()
  list(@Req() request: AdminRequest, @Query() query: ExamResultsListQueryDto) {
    return this.examResults.list(request.account.organizationId, {
      search: query.search,
      gradeId: query.gradeId,
      assessmentId: query.assessmentId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    });
  }
}
