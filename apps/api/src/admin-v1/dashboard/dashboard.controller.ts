import {
  Controller,
  Get,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffPermission } from '@bahrawy/types';
import { AdminV1DashboardService } from './dashboard.service';
import { AdminApiResponseInterceptor } from '../common/interceptors/admin-response.interceptor';
import { AdminApiErrorFilter } from '../common/filters/admin-error.filter';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequireAdminPermission } from '../common/decorators/require-permission.decorator';

type StaffRequest = Request & {
  account: {
    id: string;
    organizationId: string;
    kind: string;
  };
};

@Controller('admin/v1/dashboard')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(
  StaffPermission.PAYMENT_MANAGE,
  StaffPermission.SUPPORT_MANAGE,
  StaffPermission.CATALOG_MANAGE,
  StaffPermission.STUDENT_MANAGE,
  StaffPermission.ASSESSMENT_MANAGE,
)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1DashboardController {
  constructor(private readonly dashboardService: AdminV1DashboardService) {}

  @Get()
  async getDashboard(@Req() request: StaffRequest) {
    return this.dashboardService.getMetrics(request.account.organizationId);
  }
}
