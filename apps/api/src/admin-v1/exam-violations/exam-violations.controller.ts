import {
  Controller,
  Get,
  Param,
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
import { AdminV1ExamViolationsService } from './exam-violations.service';
import { ExamViolationsListQueryDto } from './exam-violations.dto';

type AdminRequest = Request & {
  account: { id: string; organizationId: string; kind: string };
};

@Controller('admin/v1/exam-violations')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.ASSESSMENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1ExamViolationsController {
  constructor(private readonly violations: AdminV1ExamViolationsService) {}

  @Get()
  list(
    @Req() request: AdminRequest,
    @Query() query: ExamViolationsListQueryDto,
  ) {
    return this.violations.list(request.account.organizationId, {
      search: query.search,
      gradeId: query.gradeId,
      courseId: query.courseId,
      assessmentId: query.assessmentId,
      status: query.status,
      caseType: query.caseType,
      sortBy: query.sortBy,
      direction: query.direction,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    });
  }

  @Get(':sessionId/events')
  events(@Req() request: AdminRequest, @Param('sessionId') sessionId: string) {
    return this.violations.events(request.account.organizationId, sessionId);
  }

  @Post(':sessionId/reopen')
  reopen(@Req() request: AdminRequest, @Param('sessionId') sessionId: string) {
    return this.violations.reopen(request.account, sessionId);
  }

  /**
   * Admin "فتح الامتحان للطالب" for FAILED quiz cases: grants the student ONE
   * fresh attempt beyond maxAttempts. The previous FAILED attempt stays intact
   * in history. Requires the student account + assessment to belong to the
   * caller's organization.
   */
  @Post('assessments/:assessmentId/students/:accountId/unlock')
  unlock(
    @Req() request: AdminRequest,
    @Param('assessmentId') assessmentId: string,
    @Param('accountId') accountId: string,
  ) {
    return this.violations.unlock(request.account, accountId, assessmentId);
  }
}
