import {
  Controller,
  Get,
  Param,
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
import { AdminV1StudentProgressService } from './student-progress.service';

type AdminRequest = Request & {
  account: { id: string; organizationId: string; kind: string };
};

@Controller('admin/v1/students/:id/progress')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.STUDENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1StudentProgressController {
  constructor(
    private readonly progressService: AdminV1StudentProgressService,
  ) {}

  @Get()
  progress(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.progressService.progress(request.account.organizationId, id);
  }
}
